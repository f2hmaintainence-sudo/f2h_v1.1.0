import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';

class CartItemModel extends CartItemEntity {
  CartItemModel({
    required super.productId,
    required super.variantId,
    required super.productName,
    required super.variantName,
    required super.unitPrice,
    required super.purchaseType,
    super.quantity,
    super.deliveryDate,
    super.deliverySlot,
    super.schedules,
    super.imageAsset,
    super.isSubscribable,
    super.isOneTime,
    super.subscriptionPrice,
  });

  // Parses the cart data returned by the backend GET /customer/cart-items/:user_id response
  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    final purchaseType = json['purchase_type'] as String;
    int? qty;
    String? deliveryDate;
    String? deliverySlot;
    List<SubscriptionSchedule>? schedules;

    if (purchaseType == 'onetime') {
      final onetime = json['onetime_details'] as Map<String, dynamic>?;
      if (onetime != null) {
        qty = onetime['quantity'] as int?;
        deliveryDate = onetime['delivery_date'] as String?;
        final rawSlot = onetime['delivery_slot']?.toString().trim();
        if (rawSlot != null && rawSlot.isNotEmpty) {
          deliverySlot = rawSlot.toLowerCase() == 'evening' ? 'Evening' : 'Morning';
        } else {
          deliverySlot = 'Morning';
        }
      }
    } else if (purchaseType == 'subscription') {
      final sub = json['subscription_details'] as Map<String, dynamic>?;
      if (sub != null) {
        final list = sub['schedules'] as List<dynamic>?;
        if (list != null) {
          schedules = list.map((item) {
            final map = item as Map<String, dynamic>;
            return SubscriptionSchedule(
              day: int.tryParse(map['day']?.toString() ?? '') ?? 0,
              mQuantity: int.tryParse(map['m_quantity']?.toString() ?? '') ?? 0,
              eQuantity: int.tryParse(map['e_quantity']?.toString() ?? '') ?? 0,
            );
          }).toList();
        }
      }
    }

    bool readBool(dynamic val, bool fallback) {
      if (val == null) return fallback;
      if (val is bool) return val;
      final text = val.toString().toLowerCase();
      if (text == 'true' || text == '1') return true;
      if (text == 'false' || text == '0') return false;
      return fallback;
    }

    final priceVal = double.tryParse(json['price']?.toString() ?? '0') ?? 0.0;

    final vName = json['variant_name']?.toString() ?? json['variantName']?.toString();
    final pName = json['name']?.toString() ?? json['product_name']?.toString() ?? 'Product';
    final resolvedName = (vName != null && vName.trim().isNotEmpty && vName.toLowerCase() != 'standard')
        ? vName.trim()
        : pName;

    return CartItemModel(
      productId: json['product_id'] as String,
      variantId: json['product_variant_id'] as String,
      productName: resolvedName,
      variantName: vName ?? json['sku'] as String? ?? 'Unit',
      unitPrice: priceVal,
      purchaseType: purchaseType,
      quantity: qty,
      deliveryDate: deliveryDate,
      deliverySlot: deliverySlot,
      schedules: schedules,
      imageAsset: json['image_path'] as String?,
      isSubscribable: readBool(json['is_subscribable'], true),
      isOneTime: readBool(json['is_one_time'], true),
      subscriptionPrice: double.tryParse(json['subscription_price']?.toString() ?? ''),
    );
  }

  // Converts our Flutter cart item to the exact JSON format the backend expects
  Map<String, dynamic> toJson() {
    final cleanSlot = (deliverySlot != null && deliverySlot!.trim().isNotEmpty)
        ? (deliverySlot!.trim().toLowerCase() == 'evening' ? 'Evening' : 'Morning')
        : 'Morning';

    return {
      'product_id': productId,
      'product_variant_id': variantId,
      'purchase_type': purchaseType,
      
      if (purchaseType == 'onetime') 
        'onetime_details': {
          'quantity': quantity ?? 1,
          'delivery_date': deliveryDate,
          'delivery_slot': cleanSlot,
        },
      
      if (purchaseType == 'subscription' && schedules != null) 
        'subscription_details': {
          'schedules': schedules!.map((s) => {
            'day': s.day,
            'm_quantity': s.mQuantity,
            'e_quantity': s.eQuantity,
          }).toList(),
        }
    };
  }
}
