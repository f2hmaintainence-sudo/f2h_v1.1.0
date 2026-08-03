double _toDouble(dynamic value, [double defaultValue = 0.0]) {
  if (value == null) return defaultValue;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? defaultValue;
  return defaultValue;
}

int _toInt(dynamic value, [int defaultValue = 0]) {
  if (value == null) return defaultValue;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? defaultValue;
  return defaultValue;
}

class DeliveryOrderModel {
  final String orderId;
  final String? subscriptionId;
  final String orderType;
  final String customerId;
  final int stop;
  final String customerName;
  final String customerPhone;
  final String addressId;
  final String address;
  final String? landmark;
  final double addressLat;
  final double addressLng;
  final String? zoneId;
  final String? routeId;
  final String? routeName;
  final String? branchId;
  final String deliverySlot;
  final String? scheduledDate;
  final String status;
  final double subtotal;
  final double discountAmount;
  final double gstAmount;
  final String paymentMode;
  final String paymentStatus;
  final bool isCod;
  final double? codAmount;
  final double totalAmount;
  final String? deliveryPartnerId;
  final String? deliverySessionId;
  final String? specialInstructions;
  final String? invoiceImage;
  final String? deliveryImage;
  final String? deliveryNotes;
  final String? paymentScreenshot;
  final String? createdAt;
  final String? updatedAt;
  final String? frequency;
  final int? emptyBottlesCollected;
  final int? emptyBottlesExpected;
  final int? bottlesWithCustomer;
  final List<DeliveryOrderItem> products;
  final String? runId;
  final int? addressRowId;
  final List<CustomerContainerBalance> containerBalances;

  const DeliveryOrderModel({
    required this.orderId,
    this.subscriptionId,
    required this.orderType,
    required this.customerId,
    required this.stop,
    required this.customerName,
    required this.customerPhone,
    required this.addressId,
    required this.address,
    this.landmark,
    required this.addressLat,
    required this.addressLng,
    this.zoneId,
    this.routeId,
    this.routeName,
    this.branchId,
    required this.deliverySlot,
    this.scheduledDate,
    required this.status,
    required this.subtotal,
    required this.discountAmount,
    required this.gstAmount,
    required this.paymentMode,
    required this.paymentStatus,
    required this.isCod,
    this.codAmount,
    required this.totalAmount,
    this.deliveryPartnerId,
    this.deliverySessionId,
    this.specialInstructions,
    this.invoiceImage,
    this.deliveryImage,
    this.deliveryNotes,
    this.paymentScreenshot,
    this.createdAt,
    this.updatedAt,
    this.frequency,
    this.emptyBottlesCollected,
    this.emptyBottlesExpected,
    this.bottlesWithCustomer,
    required this.products,
    this.runId,
    this.addressRowId,
    this.containerBalances = const [],
  });

  factory DeliveryOrderModel.fromJson(Map<String, dynamic> json) {
    final items = (json['products'] as List<dynamic>? ?? [])
        .map((e) => DeliveryOrderItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    final containerBalancesList = (json['container_balances'] as List<dynamic>? ?? [])
        .map((e) => CustomerContainerBalance.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return DeliveryOrderModel(
      orderId: json['order_id']?.toString() ?? '',
      subscriptionId: json['subscription_id']?.toString(),
      orderType: json['order_type']?.toString() ?? 'subscription',
      customerId: json['customer_id']?.toString() ?? '',
      stop: _toInt(json['stop']),
      customerName: json['customer_name']?.toString() ?? '',
      customerPhone: json['customer_phone']?.toString() ?? '',
      addressId: json['address_id']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      landmark: json['landmark']?.toString(),
      addressLat: _toDouble(json['address_lat']),
      addressLng: _toDouble(json['address_lng']),
      zoneId: json['zone_id']?.toString(),
      routeId: json['route_id']?.toString(),
      routeName: json['route_name']?.toString(),
      branchId: json['branch_id']?.toString(),
      deliverySlot: json['delivery_slot']?.toString() ?? 'morning',
      scheduledDate: json['scheduled_date']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      subtotal: _toDouble(json['subtotal']),
      discountAmount: _toDouble(json['discount_amount']),
      gstAmount: _toDouble(json['gst_amount']),
      paymentMode: json['payment_mode']?.toString() ?? 'prepaid',
      paymentStatus: json['payment_status']?.toString() ?? 'pending',
      isCod: json['is_cod'] == true || json['is_cod'] == 1 || json['is_cod']?.toString().toLowerCase() == 'true',
      codAmount: json['cod_amount'] != null ? _toDouble(json['cod_amount']) : null,
      totalAmount: _toDouble(json['total_amount']),
      deliveryPartnerId: json['delivery_partner_id']?.toString(),
      deliverySessionId: json['delivery_session_id']?.toString(),
      specialInstructions: json['special_instructions']?.toString(),
      invoiceImage: json['invoice_image']?.toString(),
      deliveryImage: json['delivery_image']?.toString(),
      deliveryNotes: json['delivery_notes']?.toString(),
      paymentScreenshot: json['payment_screenshot']?.toString(),
      createdAt: json['created_at']?.toString(),
      updatedAt: json['updated_at']?.toString(),
      frequency: json['frequency']?.toString(),
      emptyBottlesCollected: _toInt(json['empty_bottles_collected']),
      emptyBottlesExpected: _toInt(json['empty_bottles_expected']),
      bottlesWithCustomer: _toInt(json['bottles_with_customer']),
      products: items,
      runId: json['run_id']?.toString(),
      addressRowId: _toInt(json['address_row_id']),
      containerBalances: containerBalancesList,
    );
  }

  DeliveryOrderModel copyWith({
    String? status,
    int? emptyBottlesCollected,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    String? deliveryNotes,
    int? bottlesWithCustomer,
    List<CustomerContainerBalance>? containerBalances,
  }) {
    return DeliveryOrderModel(
      orderId: orderId,
      subscriptionId: subscriptionId,
      orderType: orderType,
      customerId: customerId,
      stop: stop,
      customerName: customerName,
      customerPhone: customerPhone,
      addressId: addressId,
      address: address,
      landmark: landmark,
      addressLat: addressLat,
      addressLng: addressLng,
      zoneId: zoneId,
      routeId: routeId,
      routeName: routeName,
      branchId: branchId,
      deliverySlot: deliverySlot,
      scheduledDate: scheduledDate,
      status: status ?? this.status,
      subtotal: subtotal,
      discountAmount: discountAmount,
      gstAmount: gstAmount,
      paymentMode: paymentMode ?? this.paymentMode,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      isCod: isCod,
      codAmount: codAmount,
      totalAmount: totalAmount,
      deliveryPartnerId: deliveryPartnerId,
      deliverySessionId: deliverySessionId,
      specialInstructions: specialInstructions,
      invoiceImage: invoiceImage,
      deliveryImage: deliveryImage ?? this.deliveryImage,
      deliveryNotes: deliveryNotes ?? this.deliveryNotes,
      paymentScreenshot: paymentScreenshot,
      createdAt: createdAt,
      updatedAt: updatedAt,
      frequency: frequency,
      emptyBottlesCollected: emptyBottlesCollected ?? this.emptyBottlesCollected,
      emptyBottlesExpected: emptyBottlesExpected,
      bottlesWithCustomer: bottlesWithCustomer ?? this.bottlesWithCustomer,
      products: products,
      runId: runId,
      addressRowId: addressRowId,
      containerBalances: containerBalances ?? this.containerBalances,
    );
  }

  bool get isDelivered => status == 'delivered';
  bool get isOutForDelivery => status == 'out_for_delivery';
}

class DeliveryOrderItem {
  final String productName;
  final int quantity;
  final String unit;
  final double price;

  const DeliveryOrderItem({
    required this.productName,
    required this.quantity,
    required this.unit,
    required this.price,
  });

  factory DeliveryOrderItem.fromJson(Map<String, dynamic> json) {
    return DeliveryOrderItem(
      productName: json['product_name']?.toString() ?? '',
      quantity: _toInt(json['quantity'], 1),
      unit: json['unit']?.toString() ?? '',
      price: _toDouble(json['price']),
    );
  }
}

class GroupedStop {
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String address;
  final double addressLat;
  final double addressLng;
  final int stop;
  final String deliverySlot;
  final List<DeliveryOrderModel> orders;

  GroupedStop({
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    required this.addressLat,
    required this.addressLng,
    required this.stop,
    required this.deliverySlot,
    required this.orders,
  });

  String get status {
    if (orders.every((o) => o.status == 'delivered' || o.status == 'completed')) return 'delivered';
    if (orders.any((o) => o.status == 'failed' || o.status == 'cancelled')) return 'failed';
    if (orders.any((o) => o.status == 'out_for_delivery')) return 'out_for_delivery';
    return 'pending';
  }

  bool get isCod => orders.any((o) => o.isCod);

  double get totalAmount => orders.fold(0.0, (sum, o) => sum + o.totalAmount);

  double get codAmount => orders.where((o) => o.isCod).fold(0.0, (sum, o) => sum + (o.codAmount ?? o.totalAmount));

  int get emptyBottlesExpected => orders.fold(0, (sum, o) => sum + (o.emptyBottlesExpected ?? 0));

  int get emptyBottlesCollected => orders.fold(0, (sum, o) => sum + (o.emptyBottlesCollected ?? 0));

  String? get landmark => orders.isEmpty ? null : orders.first.landmark;

  int get bottlesWithCustomer => orders.isEmpty ? 0 : (orders.first.bottlesWithCustomer ?? 0);

  List<CustomerContainerBalance> get containerBalances => orders.isEmpty ? const [] : orders.first.containerBalances;

  List<DeliveryOrderItem> get products {
    final List<DeliveryOrderItem> items = [];
    for (var o in orders) {
      items.addAll(o.products);
    }
    return items;
  }

  List<DeliveryOrderItem> get consolidatedProducts {
    final Map<String, DeliveryOrderItem> items = {};
    for (final item in products) {
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
    return items.values.toList();
  }

  int get totalProductUnits =>
      products.fold(0, (sum, item) => sum + item.quantity);

  String get itemCountLabel {
    final types = consolidatedProducts.length;
    final units = totalProductUnits;
    return '$types Type${types == 1 ? '' : 's'} · $units Unit${units == 1 ? '' : 's'}';
  }

  String get orderType {
    final types = orders.map((o) => o.orderType).toSet();
    final hasSubscription = types.contains('subscription');
    final hasOneTime = types.contains('one-time') || types.contains('single');
    if (hasSubscription && hasOneTime) {
      return 'subscription & one-time';
    }
    if (hasSubscription) return 'subscription';
    if (hasOneTime) return 'one-time';
    return types.isEmpty ? 'one-time' : types.first;
  }

  String? get specialInstructions {
    final instructions = orders
        .map((o) => o.specialInstructions)
        .where((i) => i != null && i.isNotEmpty)
        .join(' | ');
    return instructions.isEmpty ? null : instructions;
  }
}

class DeliveryRun {
  final String runId;
  final String status;
  final String slot;
  final String runDate;
  final List<DeliveryOrderModel> orders;

  const DeliveryRun({
    required this.runId,
    required this.status,
    required this.slot,
    required this.runDate,
    required this.orders,
  });

  factory DeliveryRun.fromJson(Map<String, dynamic> json) {
    final ordersList = (json['deliveries'] as List<dynamic>? ?? [])
        .map((e) => DeliveryOrderModel.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return DeliveryRun(
      runId: json['run_id']?.toString() ?? '',
      status: json['run_status']?.toString() ?? 'pending',
      slot: json['slot']?.toString() ?? '',
      runDate: json['date']?.toString() ?? '',
      orders: ordersList,
    );
  }
}

class CustomerContainerBalance {
  final String containerId;
  final String name;
  final int balance;

  const CustomerContainerBalance({
    required this.containerId,
    required this.name,
    required this.balance,
  });

  factory CustomerContainerBalance.fromJson(Map<String, dynamic> json) {
    return CustomerContainerBalance(
      containerId: json['container_id']?.toString() ?? json['packaging_type_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      balance: _toInt(json['balance']),
    );
  }
}
