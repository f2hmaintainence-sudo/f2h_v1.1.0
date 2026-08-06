import 'package:f2h_customer/core/utils/extensions.dart';

class OrderItem {
  final String variantId;
  final String productId; // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  final String productName;
  final String variantName;
  final int quantity;
  final double unitPrice;
  final double finalPrice;
  final String sku;
  final String? imagePath;
  final int? rating;          // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  final String? ratingFeedback; // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]

  const OrderItem({
    required this.variantId,
    required this.productId,
    required this.productName,
    required this.variantName,
    required this.quantity,
    required this.unitPrice,
    required this.finalPrice,
    required this.sku,
    this.imagePath,
    this.rating,
    this.ratingFeedback,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      variantId: json['variant_id']?.toString() ?? '',
      productId: json['product_id']?.toString() ?? '', // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      productName: (json['product_name']?.toString() ?? 'Product').toTitleCase(),
      variantName: json['variant_name']?.toString() ?? '',
      quantity: (double.tryParse(json['quantity']?.toString() ?? '1',) ?? 1.0).toInt(),
      unitPrice: double.tryParse(json['unit_price']?.toString() ?? '0.0') ?? 0.0,
      finalPrice: double.tryParse(json['final_price']?.toString() ?? '0.0') ?? 0.0,
      sku: json['sku']?.toString() ?? '',
      imagePath: json['image_path']?.toString(),
      rating: json['rating'] != null ? int.tryParse(json['rating'].toString()) : null, // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      ratingFeedback: json['rating_feedback']?.toString(), // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
    );
  }
}

class Order {
  final String id;
  final String productName;
  final String status;
  final String date;
  final String vendorName;
  final String emoji;
  final double amount;

  // Additional DB fields
  final String customerId;
  final String addressId;
  final String zoneId;
  final String branchId;
  final String routeId;
  final String deliverySlot;
  final String scheduledDate;
  final String paymentMode;
  final String paymentStatus;
  final String orderType;
  final String orderSource;   // 'one_time' | 'subscription' | ''
  final String subscriptionId;
  final String createdAt;
  final String updatedAt;
  final List<OrderItem> items;
  final int? rating;
  final String? ratingFeedback;

  const Order({
    required this.id,
    required this.productName,
    required this.status,
    required this.date,
    required this.vendorName,
    required this.emoji,
    required this.amount,
    this.customerId = '',
    this.addressId = '',
    this.zoneId = '',
    this.branchId = '',
    this.routeId = '',
    this.deliverySlot = '',
    this.scheduledDate = '',
    this.paymentMode = '',
    this.paymentStatus = '',
    this.orderType = '',
    this.orderSource = '',
    this.subscriptionId = '',
    this.createdAt = '',
    this.updatedAt = '',
    this.items = const [],
    this.rating,
    this.ratingFeedback,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final items = <OrderItem>[];
    final seenKeys = <String>{};
    for (final item in rawItems) {
      final parsed = OrderItem.fromJson(item as Map<String, dynamic>);
      final key = '${parsed.variantId}_${parsed.productName}_${parsed.quantity}_${parsed.unitPrice}';
      if (seenKeys.contains(key)) continue;
      seenKeys.add(key);
      items.add(parsed);
    }

    // Derive productName
    String pName = 'Order';
    if (items.isNotEmpty) {
      if (items.length == 1) {
        final variantSuffix = items[0].variantName.isNotEmpty && items[0].variantName.toLowerCase() != 'standard'
            ? ' (${items[0].variantName})'
            : '';
        pName = '${items[0].productName}$variantSuffix × ${items[0].quantity}';
      } else {
        pName = '${items[0].productName} & ${items.length - 1} more items';
      }
    }

    // Derive date format for UI: E.g., scheduled_date or created_at
    final scheduledDateStr = json['scheduled_date']?.toString() ?? '';
    String displayDate = scheduledDateStr;
    String normalizedScheduledDate = '';

    try {
      final d = DateTime.parse(scheduledDateStr).toLocal();

      normalizedScheduledDate =
          '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';
    } catch (_) {
      normalizedScheduledDate = scheduledDateStr;
    }
    try {
      final parsedDate = DateTime.parse(scheduledDateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));
      final yesterday = today.subtract(const Duration(days: 1));
      final compareDate = DateTime(parsedDate.year, parsedDate.month, parsedDate.day);

      if (compareDate == today) {
        displayDate = 'Today';
      } else if (compareDate == tomorrow) {
        displayDate = 'Tomorrow';
      } else if (compareDate == yesterday) {
        displayDate = 'Yesterday';
      } else {
        final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        displayDate = '${parsedDate.day} ${months[parsedDate.month - 1]}';
      }
    } catch (_) {}

    // Derive vendorName (use SKU or default F2H Partner)
    final vName = items.isNotEmpty && items[0].sku.isNotEmpty ? items[0].sku : 'F2H Partner';

    // Emoji logic
    String emoji = '📦';
    if (items.isNotEmpty) {
      final lowerName = items[0].productName.toLowerCase();
      if (lowerName.contains('milk')) {
        emoji = '🥛';
      } else if (lowerName.contains('ghee')) {
        emoji = '🫙';
      } else if (lowerName.contains('curd')) {
        emoji = '🍶';
      } else if (lowerName.contains('paneer')) {
        emoji = '🧀';
      }
    }

    return Order(
      id: json['order_id']?.toString() ?? '',
      productName: pName,
      status: json['status']?.toString() ?? 'placed',
      date: displayDate,
      vendorName: vName,
      emoji: emoji,
      amount: double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0,
      customerId: json['customer_id']?.toString() ?? '',
      addressId: json['address_id']?.toString() ?? json['addressId']?.toString() ?? json['action_id']?.toString() ?? '',
      zoneId: json['zone_id']?.toString() ?? '',
      branchId: json['branch_id']?.toString() ?? '',
      routeId: json['route_id']?.toString() ?? '',
      deliverySlot: json['delivery_slot']?.toString() ?? '',
      scheduledDate: normalizedScheduledDate,
      paymentMode: json['payment_mode']?.toString() ?? '',
      paymentStatus: json['payment_status']?.toString() ?? '',
      orderType: json['order_type']?.toString() ?? '',
      orderSource: json['order_source']?.toString() ?? '',
      subscriptionId: json['subscription_id']?.toString() ?? '',
      createdAt: json['created_at']?.toString() ?? '',
      updatedAt: json['updated_at']?.toString() ?? '',
      items: items,
      rating: json['rating'] != null ? int.tryParse(json['rating'].toString()) : null,
      ratingFeedback: json['rating_feedback']?.toString(),
    );
  }
}


