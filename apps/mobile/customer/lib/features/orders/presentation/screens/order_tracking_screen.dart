// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : order_tracking_screen.dart
// Description : Realtime live order tracking screen with ETA, driver info, and stops-away countdown
//
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/widgets/cow_loading_widget.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;
  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  bool _isLoading = true;
  String? _error;
  Timer? _pollingTimer;

  Map<String, dynamic>? _trackingData;

  @override
  void initState() {
    super.initState();
    _fetchTracking();
    // Poll location & ETA every 15 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 15), (_) => _fetchTracking());
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchTracking() async {
    try {
      final response = await DioClient().dio.get(ApiEndpoints.orderTracking(widget.orderId));
      if (mounted) {
        setState(() {
          _trackingData = response.data;
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _isLoading) {
        setState(() {
          _error = 'Unable to load live tracking details';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Delivery Tracking'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CowLoadingWidget(size: 140, message: 'Tracking live delivery...'))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchTracking,
                        child: const Text('Retry'),
                      )
                    ],
                  ),
                )
              : _buildTrackingContent(),
    );
  }

  Widget _buildTrackingContent() {
    final driver = _trackingData?['driver'];
    final eta = _trackingData?['eta_minutes'] ?? 0;
    final stopsAway = _trackingData?['stops_away'] ?? 0;
    final status = _trackingData?['order_status'] ?? 'pending';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Simulated Map Box / Status Header
          Container(
            height: 220,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.teal.shade800, Colors.teal.shade600],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.teal.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ],
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: Opacity(
                    opacity: 0.1,
                    child: Icon(Icons.map, size: 300, color: Colors.white),
                  ),
                ),
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.directions_bike, size: 64, color: Colors.amber),
                      const SizedBox(height: 12),
                      Text(
                        status == 'delivered'
                            ? 'Delivered ✅'
                            : 'Arriving in ~$eta mins',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        stopsAway > 0
                            ? '$stopsAway stop${stopsAway > 1 ? 's' : ''} away'
                            : 'Driver is nearby your location',
                        style: const TextStyle(color: Colors.white70, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Driver Information Card
          if (driver != null && driver['name'] != null) ...[
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: driver['photo'] != null && driver['photo'].toString().trim().isNotEmpty
                      ? ClipOval(
                          child: Image.network(
                            driver['photo'].toString(),
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Text(
                              (driver['name']?.toString().trim().isNotEmpty ?? false)
                                  ? driver['name'].toString().trim()[0].toUpperCase()
                                  : 'D',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w900,
                                fontSize: 18,
                              ),
                            ),
                          ),
                        )
                      : Text(
                          (driver['name']?.toString().trim().isNotEmpty ?? false)
                              ? driver['name'].toString().trim()[0].toUpperCase()
                              : 'D',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                ),
                title: Text(
                  driver['name'] ?? 'Delivery Partner',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: const Text('F2H Delivery Hero'),
                trailing: driver['phone'] != null
                    ? IconButton(
                        icon: const Icon(Icons.phone, color: Colors.green),
                        onPressed: () {
                          // Call driver
                        },
                      )
                    : null,
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Order Status Stepper Card
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Delivery Progress',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  _buildStepRow('Order Confirmed', 'Packed & ready', true),
                  _buildStepLine(true),
                  _buildStepRow('Out for Delivery', 'Driver is on the route', status == 'out_for_delivery' || status == 'delivered'),
                  _buildStepLine(status == 'delivered'),
                  _buildStepRow('Delivered', 'Enjoy your fresh products!', status == 'delivered'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepRow(String title, String subtitle, bool isDone) {
    return Row(
      children: [
        Icon(
          isDone ? Icons.check_circle : Icons.radio_button_unchecked,
          color: isDone ? Colors.green : Colors.grey,
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isDone ? Colors.black : Colors.grey,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        )
      ],
    );
  }

  Widget _buildStepLine(bool isDone) {
    return Container(
      margin: const EdgeInsets.only(left: 11, top: 4, bottom: 4),
      height: 24,
      width: 2,
      color: isDone ? Colors.green : Colors.grey.shade300,
    );
  }
}
