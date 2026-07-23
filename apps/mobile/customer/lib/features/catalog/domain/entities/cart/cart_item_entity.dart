class CartItemEntity {
  final String productId;
  final String variantId;
  final String productName;
  final String variantName;
  final double unitPrice;
  final String purchaseType;
  final int? quantity;
  final String? deliveryDate;
  final String? deliverySlot;
  final List<SubscriptionSchedule>? schedules;
  final String? imageAsset;
  final bool isSubscribable;
  final bool isOneTime;
  final double? subscriptionPrice;

  CartItemEntity({
    required this.productId,
    required this.variantId,
    required this.productName,
    required this.variantName,
    required this.unitPrice,
    required this.purchaseType,
    this.quantity,
    this.deliveryDate,
    this.deliverySlot,
    this.schedules,
    this.imageAsset,
    this.isSubscribable = true,
    this.isOneTime = true,
    this.subscriptionPrice,
  });

  CartItemEntity copyWith({
    String? productId,
    String? variantId,
    String? productName,
    String? variantName,
    double? unitPrice,
    String? purchaseType,
    int? quantity,
    String? deliveryDate,
    String? deliverySlot,
    List<SubscriptionSchedule>? schedules,
    String? imageAsset,
    bool? isSubscribable,
    bool? isOneTime,
    double? subscriptionPrice,
  }) {
    return CartItemEntity(
      productId: productId ?? this.productId,
      variantId: variantId ?? this.variantId,
      productName: productName ?? this.productName,
      variantName: variantName ?? this.variantName,
      unitPrice: unitPrice ?? this.unitPrice,
      purchaseType: purchaseType ?? this.purchaseType,
      quantity: quantity ?? this.quantity,
      deliveryDate: deliveryDate ?? this.deliveryDate,
      deliverySlot: deliverySlot ?? this.deliverySlot,
      schedules: schedules ?? this.schedules,
      imageAsset: imageAsset ?? this.imageAsset,
      isSubscribable: isSubscribable ?? this.isSubscribable,
      isOneTime: isOneTime ?? this.isOneTime,
      subscriptionPrice: subscriptionPrice ?? this.subscriptionPrice,
    );
  }
}


class SubscriptionSchedule {
  final int day; 
  final int mQuantity; 
  final int eQuantity; 

  SubscriptionSchedule({
    required this.day,
    required this.mQuantity,
    required this.eQuantity,
  });
}
