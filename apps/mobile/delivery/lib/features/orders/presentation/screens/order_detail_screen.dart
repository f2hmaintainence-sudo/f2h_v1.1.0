import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/report_issue_screen.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/core/config/app_config.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class OrderDetailScreen extends StatefulWidget {
  final GroupedStop stop;

  const OrderDetailScreen({super.key, required this.stop});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final LocationService _locationService = LocationService();
  late GroupedStop _currentStop;
  String _calculatedDistanceText = 'Calculating distance...';
  String _calculatedEtaText = 'Calculating ETA...';

  @override
  void initState() {
    super.initState();
    _currentStop = widget.stop;
    _calculateDynamicEta();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _calculateDynamicEta() async {
    try {
      final position = await _locationService.getCurrentPosition();
      if (position != null && mounted) {
        final dist = _locationService.haversineDistanceKm(
          position.latitude,
          position.longitude,
          _currentStop.addressLat,
          _currentStop.addressLng,
        );
        setState(() {
          if (dist < 1) {
            _calculatedDistanceText = '${(dist * 1000).round()} meters away';
          } else {
            _calculatedDistanceText = '${dist.toStringAsFixed(1)} km away';
          }
          final mins = (dist / 25 * 60).round();
          _calculatedEtaText = 'Estimated ETA: ${mins > 0 ? mins : 1} mins';
        });
      } else {
        setState(() {
          _calculatedDistanceText = '500 meters away';
          _calculatedEtaText = 'Estimated ETA: 3 mins';
        });
      }
    } catch (e) {
      print('Error calculating dynamic ETA: $e');
      if (mounted) {
        setState(() {
          _calculatedDistanceText = '500 meters away';
          _calculatedEtaText = 'Estimated ETA: 3 mins';
        });
      }
    }
  }


  void _callPhone(String phone) async {
    final url = Uri.parse('tel:$phone');
    if (await launchUrl(url)) {
      // success
    }
  }

  void _openNav(double lat, double lng) async {
    final url = Uri.parse('google.navigation:q=$lat,$lng');
    if (await launchUrl(url)) {
      // success
    } else {
      final webUrl = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
      await launchUrl(webUrl, mode: LaunchMode.externalApplication);
    }
  }

  void _showConfirmation(BuildContext context) async {
    final position = await _locationService.getCurrentPosition();
    if (position != null) {
      final dist = _locationService.haversineDistanceKm(
        position.latitude,
        position.longitude,
        _currentStop.addressLat,
        _currentStop.addressLng,
      );
      print('[DEBUG] Rider is $dist km away from stop.');
      // Bypassed 300 meters check to allow testing locally
      /*
      if (dist > 0.3) { // 300 meters threshold
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Please reach the location to mark as delivered.'),
              backgroundColor: kDanger,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
        return;
      }
      */
    }

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DeliveryConfirmationSheet(
        stop: _currentStop,
        onConfirm: (status, emptyBottles, returnedContainers, damagedContainers, lostContainers, notes, paymentMode, paymentStatus, deliveryImage, containerReturns) {
          if (_currentStop.orders.isEmpty) return;
          final orderId = _currentStop.orders.first.orderId;

          context.read<DeliverySessionBloc>().add(UpdateStopStatusEvent(
            orderId: orderId,
            newStatus: status,
            emptyBottles: emptyBottles,
            returnedContainers: returnedContainers,
            damagedContainers: damagedContainers,
            lostContainers: lostContainers,
            notes: notes,
            paymentMode: paymentMode,
            paymentStatus: paymentStatus,
            deliveryImage: deliveryImage,
            containerReturns: containerReturns,
          ));
          if (mounted && Navigator.canPop(context)) {
            Navigator.pop(context); // Pop order detail screen if still open
          }

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Stop #${_currentStop.stop} marked as $status!'),
              backgroundColor: status == 'delivered' ? kSuccess : kDanger,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
          if (status == 'delivered') {
            MockDataService().tabNavigationNotifier.value = 2; // Switch to Map tab
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = context.watch<DeliverySessionBloc>().state;
    if (sessionState is DeliverySessionLoaded) {
      final updated = sessionState.groupedStops.firstWhere(
        (s) => s.customerId == _currentStop.customerId,
        orElse: () => _currentStop,
      );
      _currentStop = updated;
    }
    final statusLower = _currentStop.status.toLowerCase();
    final isDone = statusLower == 'delivered' || 
                   statusLower == 'failed' || 
                   statusLower == 'completed' || 
                   statusLower == 'cancelled';
    final hasSubscription = _currentStop.orders.any((o) => o.orderType == 'subscription');
    final hasOneTime = _currentStop.orders.any((o) => o.orderType == 'one-time' || o.orderType == 'single');
    return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(
        title: 'Stop Details #${_currentStop.stop}',
        actions: [
          if (hasSubscription)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: kPrimaryPl,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'SUBSCRIPTION',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: kPrimary),
              ),
            ),
          if (hasOneTime)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: kAccentLt,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'ONE-TIME',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: kAccent),
              ),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, isDone ? 24 : 110),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status bar indicator
            _buildStatusBanner(),
            const SizedBox(height: 16),

            if (isDone) ...[
              _buildDeliveryReceiptCard(),
              const SizedBox(height: 16),
            ],

            // Customer Profile Card
            _buildCustomerProfileCard(),
            const SizedBox(height: 16),

            // Bottle Returns Ledger Card
            _buildBottleLedgerCard(),
            const SizedBox(height: 16),
            // Map Route Preview
            if (!isDone) ...[
              _buildMapRoutePreviewCard(),
              const SizedBox(height: 16),
            ],

            // Order Details (Items + Slot + Payment Status)
            _buildOrderDetailsCard(),
            const SizedBox(height: 16),

            // Delivery Notes Card
            if (_currentStop.specialInstructions != null && _currentStop.specialInstructions!.isNotEmpty)
              _buildSpecialInstructionsCard(),
          ],
        ),
      ),
      bottomSheet: isDone
          ? null
          : Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSurface,
                border: const Border(top: BorderSide(color: kBorderLt)),
                boxShadow: [
                  BoxShadow(
                    color: kText.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  )
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => ReportIssueScreen(order: _currentStop.orders.first)),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: kDanger, width: 1.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text(
                        'REPORT ISSUE',
                        style: TextStyle(color: kDanger, fontWeight: FontWeight.w900, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () => _showConfirmation(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 2,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_rounded, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'MARK DELIVER',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusBanner() {
    Color color;
    IconData icon;
    String title;
    String sub;

    switch (_currentStop.status.toLowerCase()) {
      case 'delivered':
        color = kSuccess;
        icon = Icons.task_alt_rounded;
        title = 'Delivery Completed';
        sub = 'Order handed over successfully.';
        break;
      case 'failed':
        color = kDanger;
        icon = Icons.cancel_outlined;
        title = 'Delivery Failed';
        sub = 'Issue reported. Returned to hub.';
        break;
      case 'out_for_delivery':
        color = kAccent;
        icon = Icons.directions_bike_rounded;
        title = 'Out For Delivery';
        sub = 'You are currently routing to this stop.';
        break;
      default:
        color = kPrimary;
        icon = Icons.assignment_turned_in_rounded;
        title = 'Stop Assigned';
        sub = 'Morning delivery slot scheduled.';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: color),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryReceiptCard() {
    final firstOrder = _currentStop.orders.first;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _currentStop.status == 'delivered'
            ? kSuccess.withValues(alpha: 0.05)
            : kDanger.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _currentStop.status == 'delivered'
              ? kSuccess.withValues(alpha: 0.15)
              : kDanger.withValues(alpha: 0.15),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _currentStop.status == 'delivered'
                    ? Icons.check_circle_rounded
                    : Icons.cancel_rounded,
                color: _currentStop.status == 'delivered' ? kSuccess : kDanger,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                _currentStop.status == 'delivered'
                    ? 'DELIVERED SUCCESSFULLY'
                    : 'DELIVERY FAILED',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                  color: _currentStop.status == 'delivered' ? kSuccess : kDanger,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Row 1: Payment Method & Bottles Collected
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                       'PAYMENT METHOD',
                      style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          firstOrder.paymentMode == 'prepaid'
                              ? Icons.payment_rounded
                              : (firstOrder.paymentMode == 'upi' ? Icons.qr_code_rounded : Icons.money_rounded),
                          size: 16,
                          color: kText,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          firstOrder.paymentMode == 'prepaid'
                              ? 'Prepaid Online'
                              : (firstOrder.paymentMode == 'upi' ? 'UPI QR Code' : (firstOrder.paymentMode == 'cash' ? 'Cash' : 'COD')),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'BOTTLES COLLECTED',
                      style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.opacity_rounded, size: 16, color: kText),
                        const SizedBox(width: 6),
                        Text(
                          '${_currentStop.emptyBottlesCollected} bottles',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Row 2: Proof Photo & Handover Details
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PROOF PHOTO',
                      style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          firstOrder.deliveryImage != null && firstOrder.deliveryImage!.isNotEmpty
                              ? Icons.photo_camera_back_rounded
                              : Icons.no_photography_rounded,
                          size: 16,
                          color: firstOrder.deliveryImage != null && firstOrder.deliveryImage!.isNotEmpty ? kSuccess : kTextSub,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          firstOrder.deliveryImage != null && firstOrder.deliveryImage!.isNotEmpty
                              ? 'Uploaded ✅'
                              : 'Not Uploaded',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: firstOrder.deliveryImage != null && firstOrder.deliveryImage!.isNotEmpty ? kSuccess : kTextSub,
                          ),
                        ),
                      ],
                    ),
                    if (firstOrder.deliveryImage != null && firstOrder.deliveryImage!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          firstOrder.deliveryImage!.startsWith('http')
                              ? firstOrder.deliveryImage!
                              : '${ApiEndpoints.host}${firstOrder.deliveryImage!.startsWith('/') ? '' : '/'}${firstOrder.deliveryImage!}',
                          height: 100,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              height: 100,
                              color: kBgDeep,
                              child: const Center(
                                child: Icon(Icons.broken_image_rounded, color: kTextSub, size: 20),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'HANDOVER DETAILS',
                      style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      (firstOrder.deliveryNotes != null && firstOrder.deliveryNotes!.isNotEmpty)
                          ? firstOrder.deliveryNotes!.split(' · ').first
                          : 'No details available',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerProfileCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CUSTOMER PROFILE',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.8),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              CircleAvatar(
                backgroundColor: kPrimary.withValues(alpha: 0.1),
                radius: 26,
                child: Text(
                  _currentStop.customerName.isNotEmpty ? _currentStop.customerName[0].toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.w900, color: kPrimary, fontSize: 20),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _currentStop.customerName,
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: kText),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _currentStop.customerPhone,
                      style: const TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
                ),
                child: IconButton(
                  icon: const Icon(Icons.phone_in_talk_rounded, color: Colors.blue, size: 22),
                  onPressed: () => _callPhone(_currentStop.customerPhone),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(color: kBorderLt, height: 1),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_rounded, color: kPrimary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Delivery Address',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kText),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _currentStop.address,
                      style: const TextStyle(fontSize: 12.5, color: kTextSub, height: 1.4),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.apartment_rounded, color: kAccent, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Landmark',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kText),
                    ),
                    const SizedBox(height: 4),
                    Text(
                     _currentStop.landmark != null && _currentStop.landmark!.isNotEmpty
                          ? _currentStop.landmark!
                          : _currentStop.address,
                      style: const TextStyle(fontSize: 12.5, color: kTextSub),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottleLedgerCard() {
    // outstanding = bottles already at customer's home (min 0, negatives mean over-collected earlier)
    final outstanding = (_currentStop.bottlesWithCustomer).clamp(0, 9999);
    // deliveredToday = containers being delivered in this order (from backend)
    final deliveredToday = _currentStop.emptyBottlesExpected;
    final statusLower = _currentStop.status.toLowerCase();
    final isDone = statusLower == 'delivered' ||
                   statusLower == 'failed' ||
                   statusLower == 'completed' ||
                   statusLower == 'cancelled';
    final collected = isDone ? _currentStop.emptyBottlesCollected : 0;
    // Projected = outstanding + delivered today - collected today
    final projectedBalance = outstanding + deliveredToday - collected;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.opacity_rounded, color: Colors.teal, size: 20),
              SizedBox(width: 8),
              Text(
                'BOTTLE RETURNS LEDGER',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.8),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildBottleIndicator(
                  'Outstanding at Home',
                  '$outstanding',
                  Colors.teal,
                ),
              ),
              Container(width: 1, height: 40, color: kBorderLt),
              Expanded(
                child: _buildBottleIndicator(
                  'Delivered Today',
                  '+$deliveredToday',
                  kPrimary,
                ),
              ),
              Container(width: 1, height: 40, color: kBorderLt),
              Expanded(
                child: _buildBottleIndicator(
                  isDone ? 'Collected Today' : 'Expected Today',
                  isDone ? '$collected' : '$deliveredToday',
                  isDone ? kSuccess : kAccent,
                ),
              ),
            ],
          ),
          const Divider(height: 24, color: kBorder),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Projected Outstanding Balance',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kText),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: projectedBalance > 0 ? Colors.teal.shade50 : Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$projectedBalance bottle${projectedBalance == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: projectedBalance > 0 ? Colors.teal.shade800 : Colors.orange.shade800,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottleIndicator(String title, String count, Color color) {
    return Column(
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          count,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color),
        ),
      ],
    );
  }

  Widget _buildMapRoutePreviewCard() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          fit: StackFit.expand,
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(_currentStop.addressLat, _currentStop.addressLng),
                initialZoom: 16.0,
                maxZoom: 18.0,
                minZoom: 12.0,
              ),
              children: [
                TileLayer(
                  urlTemplate: AppConfig.mapTileUrlTemplate,
                  userAgentPackageName: 'com.f2h.delivery',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(_currentStop.addressLat, _currentStop.addressLng),
                      width: 44,
                      height: 44,
                      child: Container(
                        decoration: BoxDecoration(
                          color: kSuccess,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 6,
                              offset: const Offset(0, 3),
                            )
                          ],
                        ),
                        child: const Icon(Icons.location_on_rounded, color: Colors.white, size: 18),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            
            // ETA Overlay Card
            Positioned(
              bottom: 12,
              left: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.directions_bike_rounded, color: kPrimary, size: 20),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _calculatedDistanceText,
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kText),
                            ),
                            Text(
                              _calculatedEtaText,
                              style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                    ),
                    GestureDetector(
                      onTap: () => _openNav(_currentStop.addressLat, _currentStop.addressLng),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: kPrimary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.navigation_rounded, color: Colors.white, size: 14),
                            SizedBox(width: 6),
                            Text(
                              'NAVIGATE',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderDetailsCard() {
    final subOrders = _currentStop.orders.where((o) => o.orderType.toLowerCase() == 'subscription').toList();
    final oneTimeOrders = _currentStop.orders.where((o) => o.orderType.toLowerCase() == 'one-time' || o.orderType.toLowerCase() == 'single').toList();
    final subscriptionItems = _consolidateOrderItems(subOrders);
    final oneTimeItems = _consolidateOrderItems(oneTimeOrders);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ORDER DETAILS',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.8),
          ),
          const SizedBox(height: 14),
          Text(
            _currentStop.itemCountLabel,
            style: const TextStyle(fontSize: 12, color: kText, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          
          // Items Ordered List separated by type
          if (subscriptionItems.isNotEmpty) ...[
            const Row(
              children: [
                Icon(Icons.cached_rounded, color: Colors.blue, size: 15),
                SizedBox(width: 6),
                Text(
                  'SUBSCRIPTION ITEMS',
                  style: TextStyle(fontSize: 10, color: Colors.blue, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...subscriptionItems.map((p) => _buildProductRow(p, true)),
          ],
          if (subscriptionItems.isNotEmpty && oneTimeItems.isNotEmpty) ...[
            const SizedBox(height: 6),
            const Divider(color: kBorderLt, height: 1),
            const SizedBox(height: 12),
          ],
          if (oneTimeItems.isNotEmpty) ...[
            const Row(
              children: [
                Icon(Icons.shopping_bag_rounded, color: Colors.purple, size: 15),
                SizedBox(width: 6),
                Text(
                  'ONE-TIME ITEMS',
                  style: TextStyle(fontSize: 10, color: Colors.purple, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...oneTimeItems.map((p) => _buildProductRow(p, false)),
          ],
          const Divider(height: 24, color: kBorder),
          
          // Slot info
          _buildInfoRow('Delivery Time Slot', _currentStop.deliverySlot.toLowerCase() == 'morning' ? 'Morning' : 'Evening'),
          const SizedBox(height: 12),
          
          // Payment mode
          _buildInfoRow(
            'Payment Status', 
            _currentStop.isCod 
                ? 'Cash on Delivery (Collect ₹${_currentStop.codAmount.round()})' 
                : 'Prepaid Order',
            isAlert: _currentStop.isCod,
          ),
          const SizedBox(height: 12),

          // Total Value
          _buildInfoRow('Total Value', '₹${_currentStop.totalAmount.round()}', isHighlight: true),
        ],
      ),
    );
  }

  List<DeliveryOrderItem> _consolidateOrderItems(List<DeliveryOrderModel> orders) {
    final Map<String, DeliveryOrderItem> items = {};
    for (final order in orders) {
      for (final item in order.products) {
        final key = '${item.productName}_${item.unit}';
        final existing = items[key];
        if (existing == null) {
          items[key] = item;
        } else {
          items[key] = DeliveryOrderItem(
            productName: existing.productName,
            quantity: existing.quantity + item.quantity,
            unit: existing.unit,
            price: existing.price + item.price,
          );
        }
      }
    }
    return items.values.toList();
  }

  Widget _buildInfoRow(String label, String val, {bool isAlert = false, bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w800),
        ),
        Flexible(
          child: Text(
            val,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: isAlert ? kDanger : (isHighlight ? kPrimary : kText),
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }

  Widget _buildSpecialInstructionsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kAccentLt.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kAccent.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.campaign_rounded, color: kAccent, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'DELIVER INSTRUCTIONS',
                  style: TextStyle(fontWeight: FontWeight.w900, color: kAccent, fontSize: 10, letterSpacing: 0.5),
                ),
                const SizedBox(height: 4),
                Text(
                  _currentStop.specialInstructions!,
                  style: const TextStyle(color: kText, fontWeight: FontWeight.w700, fontSize: 12.5, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductRow(DeliveryOrderItem p, bool isSub) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: kBgDeep,
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                  ),
                  child: Text(
                    isSub ? '🥛' : '📦',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.productName,
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: kText),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        isSub ? 'Unit: ${p.unit}' : 'Unit: ${p.unit} · ₹${p.price.round()}',
                        style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Text(
            'Qty: ${p.quantity}',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: kText),
          ),
        ],
      ),
    );
  }
}

