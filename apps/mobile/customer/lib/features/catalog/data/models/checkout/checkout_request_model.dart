import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';

class CheckoutRequestModel extends CheckoutRequestEntity {
  CheckoutRequestModel({
    required super.userId,
    required super.items,
    super.addressId,
    super.paymentMethod,
    super.paymentType,
    super.subscriptionStartDate,
    super.subscriptionEndDate,
    super.subscriptionAutoRenew,
  });

  Map<String, dynamic> toJson() {
    final listItems = <Map<String, dynamic>>[];

    for (final item in items) {
      final pType = (item.purchaseType ?? 'onetime').toLowerCase().replaceAll('-', '').replaceAll('_', '');
      if (pType == 'subscription') {
        listItems.add({
          'product_id': item.productId,
          'product_variant_id': item.variantId,
          'purchase_type': 'subscription',
          if (item.schedules != null)
            'subscription_details': {
              'schedules': item.schedules!.map((s) => {
                'day': s.day,
                'm_quantity': s.mQuantity,
                'e_quantity': s.eQuantity,
              }).toList(),
              if (subscriptionStartDate != null) 'start_date': subscriptionStartDate,
              if (subscriptionEndDate != null) 'end_date': subscriptionEndDate,
              if (subscriptionAutoRenew != null) 'auto_renew': subscriptionAutoRenew,
            }
        });
      } else {
        listItems.add({
          'product_id': item.productId,
          'product_variant_id': item.variantId,
          'purchase_type': 'onetime',
          'onetime_details': {
            'quantity': item.quantity ?? 1,
            'delivery_date': item.deliveryDate ?? DateTime.now().add(const Duration(days: 1)).toString().split(' ')[0],
            'delivery_slot': item.deliverySlot ?? 'Morning',
          },
        });
      }
    }

    return {
      'items': listItems,
      if (addressId != null) 'address_id': addressId,
      if (paymentMethod != null) 'payment_method': paymentMethod,
      if (paymentType != null) 'payment_type': paymentType,
    };
  }
}
