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

class MockDataService extends ChangeNotifier {
  static final MockDataService _instance = MockDataService._internal();
  factory MockDataService() => _instance;
  MockDataService._internal();

  // Active status
  bool _isOnline = false;
  bool get isOnline => _isOnline;

  bool _isVerified = true;
  bool get isVerified => _isVerified;
  
  String _accountStatus = "active";
  String get accountStatus => _accountStatus;
  
  String _driverName = "User";
  String get driverName => _driverName;

  bool _isSosActive = false;
  bool get isSosActive => _isSosActive;

  // Tab navigation notifier to trigger page transitions in the app shell
  final ValueNotifier<int?> tabNavigationNotifier = ValueNotifier<int?>(null);
  
  // Track if we need to open the KYC section when profile page is shown
  bool shouldOpenKycOnProfile = false;

  // Earnings details
  double _todayBasePay = 300.0;
  final double _performanceBonus = 150.0;
  final double _subscriptionBonus = 200.0;
  final double _distanceBonus = 150.0;
  
  double get todayBasePay => _todayBasePay;
  double get performanceBonus => _performanceBonus;
  double get subscriptionBonus => _subscriptionBonus;
  double get distanceBonus => _distanceBonus;

  double get todayEarnings {
    double deliveryPay = deliveredOrdersCount * 15.0;
    return _todayBasePay + _performanceBonus + _subscriptionBonus + _distanceBonus + deliveryPay;
  }

  double get weekEarnings => 5450.0 + (deliveredOrdersCount * 15.0);
  double get monthEarnings => 21850.0 + (deliveredOrdersCount * 15.0);

  // App global orders state
  List<DeliveryOrderModel> _orders = [];
  List<DeliveryOrderModel> get orders => _orders;

  DeliveryRun? _currentRun;
  DeliveryRun? get currentRun => _currentRun;

  /// Load backend profile and orders data
  Future<void> loadBackendData() async {
    try {
      // 1. Fetch profile to check online status and salary
      final profileRepo = sl<ProfileRepository>();
      final profile = await profileRepo.fetchProfile();
      _driverName = profile.fullName;
      _todayBasePay = profile.dailySalary ?? 300.0;
      _isOnline = profile.isActive;
      _isVerified = profile.isVerified;
      _accountStatus = profile.accountStatus ?? 'active';

      // Sync location tracking service status
      final trackingService = sl<LocationTrackingService>();
      if (_isOnline) {
        trackingService.startTracking();
      } else {
        trackingService.stopTracking();
      }
    } catch (e) {
      print('MockDataService: Error loading profile: $e');
    }

    try {
      // 2. Fetch today's run or orders
      final ordersRepo = sl<OrdersRepository>();
      final loadedRun = await ordersRepo.fetchTodayRun();
      _currentRun = loadedRun;
      if (loadedRun != null) {
        _orders = loadedRun.orders;
      } else {
        final loaded = await ordersRepo.fetchTodayOrders();
        _orders = loaded;
      }
      notifyListeners();
    } catch (e) {
      print('MockDataService: Error loading today orders/run from database: $e');
      _orders = [];
      _currentRun = null;
      notifyListeners();
    }
  }

 

  Future<void> toggleOnline(bool val) async {
    _isOnline = val;
    notifyListeners();

    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post('/DeliveryPartner/auth/shift-toggle');
      
      final trackingService = sl<LocationTrackingService>();
      if (val) {
        await trackingService.startTracking();
      } else {
        await trackingService.stopTracking();
      }
    } catch (e) {
      print('Error toggling shift status: $e');
    }
  }

  List<GroupedStop> getGroupedStops() {
    final Map<String, List<DeliveryOrderModel>> groups = {};
    for (var order in _orders) {
      groups.putIfAbsent(order.customerId, () => []).add(order);
    }

    final List<GroupedStop> grouped = [];
    groups.forEach((customerId, list) {
      list.sort((a, b) => a.stop.compareTo(b.stop));
      final primary = list.first;
      grouped.add(
        GroupedStop(
          customerId: customerId,
          customerName: primary.customerName,
          customerPhone: primary.customerPhone,
          address: primary.address,
          addressLat: primary.addressLat,
          addressLng: primary.addressLng,
          stop: primary.stop,
          deliverySlot: primary.deliverySlot,
          orders: list,
        ),
      );
    });

    grouped.sort((a, b) => a.stop.compareTo(b.stop));
    return grouped;
  }

  List<GroupedStop> get pendingGroupedStops =>
      getGroupedStops().where((s) => s.status == 'pending' || s.status == 'out_for_delivery').toList();

  int get totalGroupedStopsCount => getGroupedStops().length;
  int get deliveredGroupedStopsCount => getGroupedStops().where((s) => s.status == 'delivered').length;
  int get failedGroupedStopsCount => getGroupedStops().where((s) => s.status == 'failed').length;
  int get pendingGroupedStopsCount => pendingGroupedStops.length;

  GroupedStop? get nextGroupedDelivery {
    final pending = pendingGroupedStops;
    if (pending.isEmpty) return null;
    return pending.first;
  }

  List<DeliveryOrderModel> get pendingOrders =>
      _orders.where((o) => o.status == 'pending' || o.status == 'out_for_delivery').toList();

  int get totalOrdersCount => _orders.length;
  int get deliveredOrdersCount => _orders.where((o) => o.status == 'delivered').length;
  int get failedOrdersCount => _orders.where((o) => o.status == 'failed').length;
  int get pendingOrdersCount => pendingOrders.length;
  
  double get completionRate {
    if (totalOrdersCount == 0) return 0.0;
    return (deliveredOrdersCount / totalOrdersCount) * 100.0;
  }

  // Bottle returns statistics
  int get expectedBottlesCount =>
      _orders.fold(0, (sum, o) => sum + (o.emptyBottlesExpected ?? 0));
      
  int get collectedBottlesCount =>
      _orders.fold(0, (sum, o) => sum + (o.emptyBottlesCollected ?? 0));
      
  int get pendingBottlesCount => expectedBottlesCount - collectedBottlesCount;

  // Next Pending Delivery
  DeliveryOrderModel? get nextDelivery {
    final pending = _orders.where((o) => o.status != 'delivered' && o.status != 'failed').toList();
    if (pending.isEmpty) return null;
    pending.sort((a, b) => a.stop.compareTo(b.stop));
    return pending.first;
  }

  // Update order status on the backend
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
    // Proactively update local state in-memory first
    final index = _orders.indexWhere((o) => o.orderId == orderId);
    if (index != -1) {
      final existing = _orders[index];
      final targetAddressId = existing.addressId;
      final targetCustomerId = existing.customerId;

      // Update all orders at this address/customer stop in local memory
      for (int i = 0; i < _orders.length; i++) {
        if ((_orders[i].addressId == targetAddressId && targetAddressId.isNotEmpty) ||
            (_orders[i].customerId == targetCustomerId && targetCustomerId.isNotEmpty)) {
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
            print('MockDataService: location coordinates not available: $e');
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
        print('Error updating order status in MockDataService: $e');
      }
    }
  }

  Future<bool> startRun(String runId) async {
    try {
      final ordersRepo = sl<OrdersRepository>();
      final success = await ordersRepo.startRun(runId);
      if (success) {
        if (_currentRun != null && _currentRun!.runId == runId) {
          _currentRun = DeliveryRun(
            runId: _currentRun!.runId,
            status: 'in_progress',
            slot: _currentRun!.slot,
            runDate: _currentRun!.runDate,
            orders: _currentRun!.orders.map((o) => o.copyWith(status: 'out_for_delivery')).toList(),
          );
          _orders = _currentRun!.orders;
        }
        notifyListeners();
        await loadBackendData();
        return true;
      }
      return false;
    } catch (e) {
      print('MockDataService: Error starting run: $e');
      return false;
    }
  }

  // Reset data/handover bottles at hub

  /// Mark pending orders as out for delivery for the current run
  Future<void> markOrdersOutForDelivery() async {
    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post(ApiEndpoints.markOutForDelivery);
      // Refresh data after marking
      await loadBackendData();
    } catch (e) {
      print('Error marking orders out for delivery: $e');
    }
  }

// Reset data/handover bottles at hub
  Future<void> resetData() async {
    try {
      final dioClient = sl<DioClient>();
      // Clear SOS or perform equivalent session refresh
      await dioClient.dio.post(ApiEndpoints.clearSos);
      _isSosActive = false;
      await loadBackendData();
    } catch (e) {
      print('Error resetting/clearing session: $e');
    }
  }

  Future<void> triggerSos() async {
    _isSosActive = true;
    notifyListeners();

    try {
      final dioClient = sl<DioClient>();
      final locationService = sl<LocationService>();
      final position = await locationService.getCurrentPosition();

      await dioClient.dio.post(
        ApiEndpoints.sos,
        data: {
          if (position != null) 'latitude': position.latitude,
          if (position != null) 'longitude': position.longitude,
        },
      );
    } catch (e) {
      print('Error triggering SOS: $e');
    }
  }

  Future<void> clearSos() async {
    _isSosActive = false;
    notifyListeners();

    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post(ApiEndpoints.clearSos);
    } catch (e) {
      print('Error clearing SOS: $e');
    }
  }

  int get bottlesStillOutstanding {
    final sum = _orders.where((o) => o.status != 'delivered').fold(0, (currentSum, o) {
      final val = o.bottlesWithCustomer ?? 0;
      return currentSum + (val > 0 ? val : 0);
    });
    return -sum;
  }

  List<DeliveryOrderItem> _consolidateItems(List<DeliveryOrderItem> items) {
    final Map<String, DeliveryOrderItem> consolidated = {};
    for (var item in items) {
      final key = '${item.productName}_${item.unit}';
      if (!consolidated.containsKey(key)) {
        consolidated[key] = item;
      } else {
        consolidated[key] = DeliveryOrderItem(
          productName: item.productName,
          quantity: consolidated[key]!.quantity + item.quantity,
          unit: item.unit,
          price: item.price,
        );
      }
    }
    return consolidated.values.toList();
  }

  List<DeliveryOrderItem> get failedItems {
    final List<DeliveryOrderItem> returned = [];
    for (var order in _orders) {
      if (order.status == 'failed') {
        returned.addAll(order.products);
      }
    }
    return _consolidateItems(returned);
  }

  List<DeliveryOrderItem> get remainingItems {
    final List<DeliveryOrderItem> returned = [];
    for (var order in _orders) {
      if (order.status == 'pending' || order.status == 'out_for_delivery' || order.status == 'assigned' || order.status == 'packed') {
        returned.addAll(order.products);
      }
    }
    return _consolidateItems(returned);
  }

  // Helper to compute returned / undelivered items from failed, skipped or pending orders
  List<DeliveryOrderItem> get itemsToReturn {
    final List<DeliveryOrderItem> returned = [];
    for (var order in _orders) {
      if (order.status != 'delivered') {
        returned.addAll(order.products);
      }
    }
    return _consolidateItems(returned);
  }

  Future<HandoverResult> handoverRun(String runId) async {
    final oldRun = _currentRun;
    
    // Optimistic update
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
        // Roll back if failed
        _currentRun = oldRun;
        notifyListeners();
      } else {
        await loadBackendData();
      }
      return result;
    } catch (e) {
      print('MockDataService: Error during handover: $e');
      // Roll back on error
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

  void clearActiveRun() {
    _currentRun = null;
    _orders = [];
    notifyListeners();
  }

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
