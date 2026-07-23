part of 'delivery_session_bloc.dart';

abstract class DeliverySessionState {}

class DeliverySessionInitial extends DeliverySessionState {}

class DeliverySessionLoading extends DeliverySessionState {}

class DeliverySessionError extends DeliverySessionState {
  final String message;
  DeliverySessionError(this.message);
}

/// The primary loaded state — all UI reads from this.
class DeliverySessionLoaded extends DeliverySessionState {
  // ── Profile ─────────────────────────────────────────────────────────────────
  final String driverName;
  final double todayBasePay;
  final bool isOnline;
  final bool isVerified;
  final String accountStatus;
  final bool isSosActive;

  // ── Run / Orders ─────────────────────────────────────────────────────────────
  final DeliveryRun? currentRun;
  final List<DeliveryOrderModel> orders;

  DeliverySessionLoaded({
    required this.driverName,
    required this.todayBasePay,
    required this.isOnline,
    required this.isVerified,
    required this.accountStatus,
    required this.isSosActive,
    required this.currentRun,
    required this.orders,
  });

  // ── Computed Getters (mirrors the old MockDataService getters) ───────────────

  bool get isAccountActive => accountStatus.toLowerCase() == 'active';

  List<GroupedStop> get groupedStops {
    final Map<String, List<DeliveryOrderModel>> groups = {};
    for (final order in orders) {
      groups.putIfAbsent(order.customerId, () => []).add(order);
    }
    final List<GroupedStop> grouped = [];
    groups.forEach((customerId, list) {
      list.sort((a, b) => a.stop.compareTo(b.stop));
      final primary = list.first;
      grouped.add(GroupedStop(
        customerId: customerId,
        customerName: primary.customerName,
        customerPhone: primary.customerPhone,
        address: primary.address,
        addressLat: primary.addressLat,
        addressLng: primary.addressLng,
        stop: primary.stop,
        deliverySlot: primary.deliverySlot,
        orders: list,
      ));
    });
    grouped.sort((a, b) => a.stop.compareTo(b.stop));
    return grouped;
  }

  List<GroupedStop> get pendingGroupedStops => groupedStops
      .where((s) => s.status == 'pending' || s.status == 'out_for_delivery')
      .toList();

  int get totalGroupedStopsCount => groupedStops.length;
  int get deliveredGroupedStopsCount =>
      groupedStops.where((s) => s.status == 'delivered').length;
  int get failedGroupedStopsCount =>
      groupedStops.where((s) => s.status == 'failed').length;
  int get pendingGroupedStopsCount => pendingGroupedStops.length;

  GroupedStop? get nextGroupedDelivery {
    final pending = pendingGroupedStops;
    if (pending.isEmpty) return null;
    return pending.first;
  }

  int get totalOrdersCount => orders.length;
  int get deliveredOrdersCount =>
      orders.where((o) => o.status == 'delivered').length;
  int get failedOrdersCount =>
      orders.where((o) => o.status == 'failed').length;

  double get completionRate {
    if (totalOrdersCount == 0) return 0.0;
    return (deliveredOrdersCount / totalOrdersCount) * 100.0;
  }

  // Earnings
  static const double _performanceBonus = 150.0;
  static const double _subscriptionBonus = 200.0;
  static const double _distanceBonus = 150.0;

  double get performanceBonus => _performanceBonus;
  double get subscriptionBonus => _subscriptionBonus;
  double get distanceBonus => _distanceBonus;

  double get todayEarnings =>
      todayBasePay + _performanceBonus + _subscriptionBonus + _distanceBonus + (deliveredOrdersCount * 15.0);
  double get weekEarnings => 5450.0 + (deliveredOrdersCount * 15.0);
  double get monthEarnings => 21850.0 + (deliveredOrdersCount * 15.0);

  // Bottle stats
  int get expectedBottlesCount =>
      orders.fold(0, (sum, o) => sum + (o.emptyBottlesExpected ?? 0));
  int get collectedBottlesCount =>
      orders.fold(0, (sum, o) => sum + (o.emptyBottlesCollected ?? 0));
  int get bottlesStillOutstanding {
    final sum = orders
        .where((o) => o.status != 'delivered')
        .fold(0, (currentSum, o) {
      final val = o.bottlesWithCustomer ?? 0;
      return currentSum + (val > 0 ? val : 0);
    });
    return -sum;
  }

  // Item lists for handover
  List<DeliveryOrderItem> get failedItems => _consolidate(
      orders.where((o) => o.status == 'failed').expand((o) => o.products).toList());

  List<DeliveryOrderItem> get remainingItems => _consolidate(orders
      .where((o) =>
          o.status == 'pending' ||
          o.status == 'out_for_delivery' ||
          o.status == 'assigned' ||
          o.status == 'packed')
      .expand((o) => o.products)
      .toList());

  List<DeliveryOrderItem> get itemsToReturn => _consolidate(
      orders.where((o) => o.status != 'delivered').expand((o) => o.products).toList());

  List<DeliveryOrderItem> _consolidate(List<DeliveryOrderItem> items) {
    final Map<String, DeliveryOrderItem> m = {};
    for (final item in items) {
      final key = '${item.productName}_${item.unit}';
      m[key] = m.containsKey(key)
          ? DeliveryOrderItem(
              productName: item.productName,
              quantity: m[key]!.quantity + item.quantity,
              unit: item.unit,
              price: item.price,
            )
          : item;
    }
    return m.values.toList();
  }

  DeliverySessionLoaded copyWith({
    String? driverName,
    double? todayBasePay,
    bool? isOnline,
    bool? isVerified,
    String? accountStatus,
    bool? isSosActive,
    DeliveryRun? currentRun,
    List<DeliveryOrderModel>? orders,
    bool clearRun = false,
  }) {
    return DeliverySessionLoaded(
      driverName: driverName ?? this.driverName,
      todayBasePay: todayBasePay ?? this.todayBasePay,
      isOnline: isOnline ?? this.isOnline,
      isVerified: isVerified ?? this.isVerified,
      accountStatus: accountStatus ?? this.accountStatus,
      isSosActive: isSosActive ?? this.isSosActive,
      currentRun: clearRun ? null : (currentRun ?? this.currentRun),
      orders: orders ?? this.orders,
    );
  }
}
