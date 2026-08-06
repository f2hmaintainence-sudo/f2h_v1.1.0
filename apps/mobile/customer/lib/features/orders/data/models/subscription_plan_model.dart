// Real subscription plan model built from the subscriptions + subscription_items tables.
// Replaces the old mock-only Subscription model for the orders history screen.

class SubscriptionItem {
  final String id;
  final String subscriptionId;
  final String productVariantId;
  final double defaultMQty;
  final double defaultEQty;
  final double unitPrice;
  final double finalPrice;
  final String status;
  final String variantName;
  final String sku;
  final String productName;
  final String productId;
  final String? imageUrl;

  const SubscriptionItem({
    required this.id,
    required this.subscriptionId,
    required this.productVariantId,
    required this.defaultMQty,
    required this.defaultEQty,
    required this.unitPrice,
    required this.finalPrice,
    required this.status,
    required this.variantName,
    required this.sku,
    required this.productName,
    required this.productId,
    this.imageUrl,
  });

  factory SubscriptionItem.fromJson(Map<String, dynamic> json) {
    return SubscriptionItem(
      id:
          json['subscription_item_id']?.toString() ??
          json['id']?.toString() ??
          '',
      subscriptionId: json['subscription_id']?.toString() ?? '',
      productVariantId: json['product_variant_id']?.toString() ?? '',
      defaultMQty:
          double.tryParse(json['default_m_quantity']?.toString() ?? '0') ?? 0,
      defaultEQty:
          double.tryParse(json['default_e_quantity']?.toString() ?? '0') ?? 0,
      unitPrice: double.tryParse(json['unit_price']?.toString() ?? '0') ?? 0,
      finalPrice: double.tryParse(json['final_price']?.toString() ?? '0') ?? 0,
      status: (json['status']?.toString() ?? 'active').toLowerCase() == 'paused'
          ? 'active'
          : (json['status']?.toString() ?? 'active'),
      variantName: json['variant_name']?.toString() ?? '',
      sku: json['sku']?.toString() ?? '',
      productName: json['product_name']?.toString() ?? 'Product',
      productId: json['product_id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ??
          json['image_path']?.toString() ??
          json['url']?.toString() ??
          json['product_image']?.toString() ??
          json['variant_image']?.toString(),
    );
  }

  String get emoji {
    final n = productName.toLowerCase();
    if (n.contains('milk')) return '🥛';
    if (n.contains('ghee')) return '🫙';
    if (n.contains('curd')) return '🍶';
    if (n.contains('paneer')) return '🧀';
    return '📦';
  }
}

class SubscriptionPlan {
  final String id;
  final String subscriptionNumber;
  final String customerId;
  final String scheduleType;
  final String branchId;
  final String addressId;
  final String paymentType;
  final String billingCycle;
  final String startDate;
  final String endDate;
  final bool autoRenew;
  final String status;
  final String pauseStartDate;
  final String pauseEndDate;
  final String createdAt;
  final String updatedAt;
  final List<SubscriptionItem> items;

  const SubscriptionPlan({
    required this.id,
    required this.subscriptionNumber,
    required this.customerId,
    required this.scheduleType,
    required this.branchId,
    required this.addressId,
    required this.paymentType,
    required this.billingCycle,
    required this.startDate,
    required this.endDate,
    required this.autoRenew,
    required this.status,
    required this.pauseStartDate,
    required this.pauseEndDate,
    required this.createdAt,
    required this.updatedAt,
    required this.items,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return SubscriptionPlan(
      id: json['id']?.toString() ?? '',
      subscriptionNumber: json['subscription_number']?.toString() ?? '',
      customerId: json['customer_id']?.toString() ?? '',
      scheduleType: json['schedule_type']?.toString() ?? '',
      branchId: json['branch_id']?.toString() ?? '',
      addressId:
          json['address_id']?.toString() ??
          json['addressId']?.toString() ??
          json['action_id']?.toString() ??
          '',
      paymentType: json['payment_type']?.toString() ?? '',
      billingCycle: json['billing_cycle']?.toString() ?? 'monthly',
      startDate: json['start_date']?.toString() ?? '',
      endDate: json['end_date']?.toString() ?? '',
      autoRenew:
          json['auto_renew'] == true || json['auto_renew'].toString() == 'true',
      status: (json['status']?.toString() ?? 'active').toLowerCase() == 'expired' ||
              (json['status']?.toString() ?? 'active').toLowerCase() == 'expaired'
          ? 'expired'
          : (json['status']?.toString() ?? 'active').toLowerCase() == 'paused'
              ? 'active'
              : (json['status']?.toString() ?? 'active'),
      pauseStartDate:
          json['pause_start_date']?.toString() ??
          json['pause_from_date']?.toString() ??
          '',
      pauseEndDate:
          json['pause_end_date']?.toString() ??
          json['pause_to_date']?.toString() ??
          '',
      createdAt: json['created_at']?.toString() ?? '',
      updatedAt: json['updated_at']?.toString() ?? '',
      items: rawItems
          .map((e) => SubscriptionItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  bool get isPaused => false;
  bool get isActive =>
      status.toLowerCase() == 'active' || status.toLowerCase() == 'paused';

  /// Display name: first product or "{n} products"
  String get displayName {
    if (items.isEmpty) return 'Subscription';
    if (items.length == 1) return items[0].productName;
    return '${items[0].productName} + ${items.length - 1} more';
  }

  String get primaryEmoji => items.isEmpty ? '📦' : items[0].emoji;
  String? get primaryImageUrl => items.isNotEmpty ? items[0].imageUrl : null;

  /// Total morning qty cost per day
  double get dailyMorningCost {
    return items.fold(0.0, (sum, i) => sum + i.finalPrice * i.defaultMQty);
  }

  /// Total evening qty cost per day
  double get dailyEveningCost {
    return items.fold(0.0, (sum, i) => sum + i.finalPrice * i.defaultEQty);
  }
}
