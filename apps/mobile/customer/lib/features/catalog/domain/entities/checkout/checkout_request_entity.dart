import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';

class CheckoutRequestEntity {
  final String userId;
  final List<CartItemEntity> items;
  final String? addressId;
  final String? paymentMethod;
  final String? paymentType;
  final String? subscriptionStartDate;
  final String? subscriptionEndDate;
  final bool? subscriptionAutoRenew;
  final String? couponCode;

  CheckoutRequestEntity({
    required this.userId,
    required this.items,
    this.addressId,
    this.paymentMethod,
    this.paymentType,
    this.subscriptionStartDate,
    this.subscriptionEndDate,
    this.subscriptionAutoRenew,
    this.couponCode,
  });
}
