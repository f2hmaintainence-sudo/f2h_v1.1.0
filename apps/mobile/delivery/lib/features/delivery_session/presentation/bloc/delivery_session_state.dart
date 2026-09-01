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
  final bool isOnline;
  final bool isVerified;
  final String accountStatus;
  final bool isSosActive;
  final String vehicleType;

  // ── Run / Orders ─────────────────────────────────────────────────────────────
  final DeliveryRun? currentRun;
  final List<DeliveryOrderModel> orders;

  DeliverySessionLoaded({
    required this.driverName,
    required this.isOnline,
    required this.isVerified,
    required this.accountStatus,
    required this.isSosActive,
    this.vehicleType = 'bike',
    required this.currentRun,
    required this.orders,
  });

  // ── Computed Getters (mirrors the old MockDataService getters) ───────────────

  bool get isAccountActive => accountStatus.toLowerCase() == 'active';

  bool get isPickupConfirmed {
    if (currentRun != null) {
      return currentRun!.pickupConfirmed ||
          currentRun!.status == 'in_progress' ||
          currentRun!.status == 'completed' ||
          currentRun!.status == 'handed_over';
    }
    return orders.isNotEmpty &&
        orders.every((o) =>
            o.status.toLowerCase() == 'out_for_delivery' ||
            o.status.toLowerCase() == 'delivered' ||
            o.status.toLowerCase() == 'failed');
  }

  List<GroupedStop> get groupedStops {
    // Group orders by address_id — the delivery stop is defined by WHERE we deliver,
    // not WHO the customer is. The same customer at two different addresses must be
    // two separate stops.
    final Map<String, List<DeliveryOrderModel>> groups = {};
    for (final order in orders) {
      final key = order.addressId.isNotEmpty ? order.addressId : order.customerId;
      groups.putIfAbsent(key, () => []).add(order);
    }
    final List<GroupedStop> grouped = [];
    groups.forEach((addressKey, list) {
      list.sort((a, b) => a.stop.compareTo(b.stop));
      final primary = list.first;
      grouped.add(GroupedStop(
        customerId: primary.customerId,
        addressId: primary.addressId,
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



  // Bottle stats
  int get expectedBottlesCount =>
      orders.fold(0, (sum, o) => sum + (o.emptyBottlesExpected ?? 0));
  int get collectedBottlesCount =>
      orders.fold(0, (sum, o) => sum + (o.emptyBottlesCollected ?? 0));
  int get bottlesStillOutstanding {
    // Sum the outstanding bottle balance at customer homes across all stops in the session.
    return orders.fold(0, (currentSum, o) {
      final val = o.bottlesWithCustomer ?? 0;
      return currentSum + (val > 0 ? val : 0);
    });
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
    bool? isOnline,
    bool? isVerified,
    String? accountStatus,
    bool? isSosActive,
    String? vehicleType,
    DeliveryRun? currentRun,
    List<DeliveryOrderModel>? orders,
    bool clearRun = false,
  }) {
    return DeliverySessionLoaded(
      driverName: driverName ?? this.driverName,
      isOnline: isOnline ?? this.isOnline,
      isVerified: isVerified ?? this.isVerified,
      accountStatus: accountStatus ?? this.accountStatus,
      isSosActive: isSosActive ?? this.isSosActive,
      vehicleType: vehicleType ?? this.vehicleType,
      currentRun: clearRun ? null : (currentRun ?? this.currentRun),
      orders: orders ?? this.orders,
    );
  }
}
