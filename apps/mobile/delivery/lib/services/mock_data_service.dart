import 'package:flutter/material.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
import 'package:f2h_delivery/services/location_tracking_service.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';

/// Legacy singleton service — bridges the old ChangeNotifier world with the
/// new [DeliverySessionBloc].
///
/// Only a minimal set of members are kept here. Everything that is now owned
/// by [DeliverySessionBloc] (profile fields, SOS, earnings, stop counts,
/// bottle stats, item lists …) has been removed. Remaining members are still
/// referenced by screens that have not yet been migrated to the BLoC.
///
/// TODO: Migrate remaining callers to [DeliverySessionBloc] and delete this class.
class MockDataService extends ChangeNotifier {
  static final MockDataService _instance = MockDataService._internal();
  factory MockDataService() => _instance;
  MockDataService._internal();

  // ── Tab navigation ──────────────────────────────────────────────────────────
  /// Triggers a bottom-tab switch from anywhere in the widget tree.
  final ValueNotifier<int?> tabNavigationNotifier = ValueNotifier<int?>(null);

  // ── KYC deep-link flag ──────────────────────────────────────────────────────
  /// Set to true before navigating to the Profile tab so the screen auto-opens
  /// the KYC section.
  bool shouldOpenKycOnProfile = false;

  // ── Orders / Run state ──────────────────────────────────────────────────────
  List<DeliveryOrderModel> _orders = [];
  List<DeliveryOrderModel> get orders => _orders;

  DeliveryRun? _currentRun;
  DeliveryRun? get currentRun => _currentRun;

  // ── Data loading ────────────────────────────────────────────────────────────

  /// Refreshes the local order list from the backend.
  /// Also syncs the profile (online status, name, salary) and location tracking.
  Future<void> loadBackendData() async {
    try {
      final profileRepo = sl<ProfileRepository>();
      final profile = await profileRepo.fetchProfile();

      // Sync location tracking with the rider's active-shift status.
      final trackingService = sl<LocationTrackingService>();
      if (profile.isActive) {
        trackingService.startTracking();
      } else {
        trackingService.stopTracking();
      }
    } catch (e) {
      print('MockDataService: Error loading profile: $e');
    }

    try {
      final ordersRepo = sl<OrdersRepository>();
      final loadedRun = await ordersRepo.fetchTodayRun();
      _currentRun = loadedRun;
      if (loadedRun != null) {
        _orders = loadedRun.orders;
      } else {
        _orders = await ordersRepo.fetchTodayOrders();
      }
      notifyListeners();
    } catch (e) {
      print('MockDataService: Error loading today orders/run: $e');
      _orders = [];
      _currentRun = null;
      notifyListeners();
    }
  }

  // ── Order status ────────────────────────────────────────────────────────────

  /// Updates the status of [orderId] both locally (optimistic) and on the backend.
  Future<void> updateOrderStatus(
    String orderId,
    String newStatus, {
    int emptyBottles = 0,
    int returnedContainers = 0,
    int damagedContainers = 0,
    int lostContainers = 0,
    String? notes,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
  }) async {
    final index = _orders.indexWhere((o) => o.orderId == orderId);
    if (index == -1) return;

    final existing = _orders[index];
    final targetAddressId = existing.addressId;
    final targetCustomerId = existing.customerId;

    // Optimistic local update for all orders at the same address/customer stop.
    for (int i = 0; i < _orders.length; i++) {
      final matches = targetAddressId.isNotEmpty
          ? (_orders[i].addressId == targetAddressId)
          : (_orders[i].customerId == targetCustomerId && targetCustomerId.isNotEmpty);
      if (matches) {
        _orders[i] = _orders[i].copyWith(
          status: newStatus,
          emptyBottlesCollected: emptyBottles,
          paymentMode: paymentMode ?? _orders[i].paymentMode,
          paymentStatus: paymentStatus ?? _orders[i].paymentStatus,
          deliveryImage: deliveryImage ?? _orders[i].deliveryImage,
        );
      }
    }
    notifyListeners();

    try {
      final ordersRepo = sl<OrdersRepository>();
      bool success = false;

      if (existing.runId != null && existing.addressId.isNotEmpty) {
        double? lat;
        double? lng;
        try {
          final locationService = sl<LocationService>();
          final position = await locationService.getCurrentPosition();
          if (position != null) {
            lat = position.latitude;
            lng = position.longitude;
          }
        } catch (e) {
          print('MockDataService: location not available: $e');
        }

        success = await ordersRepo.markStopDelivered(
          runId: existing.runId!,
          addressId: existing.addressId,
          status: newStatus,
          orderId: existing.orderId,
          remarks: notes,
          emptyBottlesCollected: emptyBottles,
          returnedContainers: returnedContainers,
          damagedContainers: damagedContainers,
          lostContainers: lostContainers,
          paymentMode: paymentMode,
          paymentStatus: paymentStatus,
          deliveryImage: deliveryImage,
          latitude: lat,
          longitude: lng,
        );
      } else {
        success = await ordersRepo.updateOrderStatus(
          orderId,
          newStatus,
          notes: notes,
          emptyBottlesCollected: emptyBottles,
          returnedContainers: returnedContainers,
          damagedContainers: damagedContainers,
          lostContainers: lostContainers,
          paymentMode: paymentMode,
          paymentStatus: paymentStatus,
          deliveryImage: deliveryImage,
        );
      }

      if (success) {
        await loadBackendData();
      }
    } catch (e) {
      print('MockDataService: Error updating order status: $e');
    }
  }

  // ── Handover ────────────────────────────────────────────────────────────────

  Future<HandoverResult> handoverRun(String runId) async {
    final oldRun = _currentRun;

    // Optimistic update.
    if (_currentRun != null && _currentRun!.runId == runId) {
      _currentRun = DeliveryRun(
        runId: _currentRun!.runId,
        status: 'handed_over',
        slot: _currentRun!.slot,
        runDate: _currentRun!.runDate,
        orders: _currentRun!.orders,
      );
      notifyListeners();
    }

    try {
      final ordersRepo = sl<OrdersRepository>();
      final result = await ordersRepo.handoverRun(runId);

      if (!result.success) {
        _currentRun = oldRun;
        notifyListeners();
      } else {
        await loadBackendData();
      }
      return result;
    } catch (e) {
      print('MockDataService: Error during handover: $e');
      _currentRun = oldRun;
      notifyListeners();
      return HandoverResult(
        success: false,
        message: e.toString(),
        status: '',
        emptyBottlesReturned: 0,
        returnedItems: [],
      );
    }
  }

  // ── Support ─────────────────────────────────────────────────────────────────

  Future<void> raiseSupportTicket({
    required String category,
    required String subject,
    required String description,
    required String priority,
  }) async {
    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post(
        ApiEndpoints.supportTickets,
        data: {
          'category': category,
          'subject': subject,
          'description': description,
          'priority': priority,
        },
      );
    } catch (e) {
      print('MockDataService: Error raising support ticket: $e');
      rethrow;
    }
  }
}
