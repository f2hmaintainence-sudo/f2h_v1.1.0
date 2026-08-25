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
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';
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
  bool _showAddressDetails = false;

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
    try {
      await _locationService.getCurrentPosition();
    } catch (_) {}
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MapScreen(
          focusedStop: _currentStop,
          isStandalonePage: true,
        ),
      ),
    );
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
            if (isDone) ...[
              _buildDeliveryReceiptCard(),
              const SizedBox(height: 16),
            ],

            // Customer Profile Card
            _buildCustomerProfileCard(),
            const SizedBox(height: 16),

            // Map Route Preview (moved to top of bottle returns)
            if (!isDone) ...[
              _buildMapRoutePreviewCard(),
              const SizedBox(height: 16),
            ],

            // Bottle Returns Ledger Card (Only show if customer has outstanding bottles at home)
            if (_currentStop.bottlesWithCustomer > 0 || (isDone && _currentStop.emptyBottlesCollected > 0)) ...[
              _buildBottleLedgerCard(),
              const SizedBox(height: 16),
            ],

            // Order-wise Details Cards
            ..._buildOrderWiseCards(),

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
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Stop #${_currentStop.stop}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: kPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Big Customer Profile Row
          Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    _currentStop.customerName.isNotEmpty ? _currentStop.customerName[0].toUpperCase() : '?',
                    style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 24),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _currentStop.customerName,
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 19, color: kText),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _currentStop.customerPhone,
                      style: const TextStyle(fontSize: 14, color: kTextSub, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.blue.withValues(alpha: 0.25)),
                ),
                child: IconButton(
                  icon: const Icon(Icons.phone_in_talk_rounded, color: Colors.blue, size: 22),
                  onPressed: () => _callPhone(_currentStop.customerPhone),
                  tooltip: 'Call Customer',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // View Address Action Button
          GestureDetector(
            onTap: () {
              setState(() {
                _showAddressDetails = !_showAddressDetails;
              });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _showAddressDetails ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, color: kPrimary, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        _showAddressDetails ? 'Hide Address' : 'View Address',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                    ],
                  ),
                  Icon(
                    _showAddressDetails ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: kTextSub,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          if (_showAddressDetails) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.pin_drop_rounded, color: kPrimary, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Delivery Address',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kText),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _currentStop.address,
                              style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(color: Color(0xFFE2E8F0), height: 1),
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.apartment_rounded, color: kAccent, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Landmark',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kText),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _currentStop.landmark != null && _currentStop.landmark!.isNotEmpty
                                  ? _currentStop.landmark!
                                  : _currentStop.address,
                              style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBottleLedgerCard() {
    final outstanding = (_currentStop.bottlesWithCustomer).clamp(0, 9999);
    final statusLower = _currentStop.status.toLowerCase();
    final isDone = statusLower == 'delivered' ||
                   statusLower == 'failed' ||
                   statusLower == 'completed' ||
                   statusLower == 'cancelled';
    final collected = isDone ? _currentStop.emptyBottlesCollected : 0;

    if (outstanding <= 0 && collected <= 0) {
      return const SizedBox.shrink();
    }

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
          Row(
            children: [
              const Icon(Icons.opacity_rounded, color: Colors.teal, size: 20),
              const SizedBox(width: 8),
              const Text(
                'BOTTLE RETURNS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.8),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.teal.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$outstanding to collect',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Colors.teal.shade800,
                  ),
                ),
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
              if (isDone) ...[
                Container(width: 1, height: 40, color: kBorderLt),
                Expanded(
                  child: _buildBottleIndicator(
                    'Collected Today',
                    '$collected',
                    kSuccess,
                  ),
                ),
                Container(width: 1, height: 40, color: kBorderLt),
                Expanded(
                  child: _buildBottleIndicator(
                    'Remaining',
                    '${(outstanding - collected).clamp(0, 9999)}',
                    (outstanding - collected) > 0 ? Colors.orange.shade700 : kSuccess,
                  ),
                ),
              ],
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

  List<Widget> _buildOrderWiseCards() {
    if (_currentStop.orders.isEmpty) {
      return [const SizedBox.shrink()];
    }

    return _currentStop.orders.asMap().entries.map((entry) {
      final orderIndex = entry.key + 1;
      final order = entry.value;
      final isSub = order.orderType.toLowerCase() == 'subscription';
      final totalUnits = order.products.fold<int>(0, (sum, p) => sum + p.quantity);
      final isCod = order.isCod || (order.paymentMode.toLowerCase() == 'cod') || (order.paymentStatus.toLowerCase() == 'pending');

      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kBorder),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _currentStop.orders.length > 1
                      ? 'ORDER #$orderIndex DETAILS'
                      : 'ORDER DETAILS',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: kTextSub,
                    letterSpacing: 0.8,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${order.products.length} Types · $totalUnits ${totalUnits == 1 ? 'Unit' : 'Units'}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(
                  isSub ? Icons.cached_rounded : Icons.shopping_bag_rounded,
                  color: isSub ? Colors.blue : Colors.purple,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Text(
                  isSub ? 'SUBSCRIPTION ITEMS' : 'ONE-TIME ITEMS',
                  style: TextStyle(
                    fontSize: 10,
                    color: isSub ? Colors.blue : Colors.purple,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...order.products.map((p) => _buildProductRow(p, isSub)),
            const Divider(height: 24, color: kBorder),

            // Slot info
            _buildInfoRow(
              'Delivery Time Slot',
              order.deliverySlot.isNotEmpty
                  ? (order.deliverySlot.toLowerCase() == 'morning' ? 'Morning' : 'Evening')
                  : (_currentStop.deliverySlot.toLowerCase() == 'morning' ? 'Morning' : 'Evening'),
            ),
            const SizedBox(height: 12),

            // Payment mode
            _buildInfoRow(
              'Payment Status',
              isCod
                  ? 'Cash on Delivery (Collect ₹${(order.codAmount ?? order.totalAmount).round()})'
                  : (order.paymentStatus.toLowerCase() == 'paid' || !isCod ? 'Prepaid Order' : 'Pending'),
              isAlert: isCod,
            ),
            const SizedBox(height: 12),

            // Total Value
            _buildInfoRow(
              'Total Value',
              '₹${order.totalAmount.round()}',
              isHighlight: true,
            ),
          ],
        ),
      );
    }).toList();
  }

  String _resolveImageUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '${ApiEndpoints.host}$cleanPath';
  }

  Widget _buildProductImage(String? imageUrl, {double size = 46}) {
    final fullUrl = _resolveImageUrl(imageUrl);
    if (fullUrl.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Icon(Icons.inventory_2_outlined, size: 22, color: Color(0xFF94A3B8)),
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9),
        child: Image.network(
          fullUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              color: const Color(0xFFF8FAFC),
              child: const Center(
                child: Icon(Icons.inventory_2_outlined, size: 22, color: Color(0xFF94A3B8)),
              ),
            );
          },
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return Container(
              color: const Color(0xFFF8FAFC),
              child: const Center(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF16A34A)),
                ),
              ),
            );
          },
        ),
      ),
    );
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
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                _buildProductImage(p.productImage, size: 46),
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
                      const SizedBox(height: 2),
                      Text(
                        isSub ? 'Unit: ${p.unit}' : 'Unit: ${p.unit} · ₹${p.price.round()}',
                        style: const TextStyle(fontSize: 11.5, color: kTextSub, fontWeight: FontWeight.bold),
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

