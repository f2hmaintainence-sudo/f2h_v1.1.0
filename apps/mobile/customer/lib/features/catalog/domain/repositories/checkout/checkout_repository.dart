import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';

abstract class CheckoutRepository {
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestEntity request);

  /// Checks a coupon code against the cart subtotal without applying it.
  /// Returns the API payload: `valid`, `message`, `discount_preview`, `coupon_id`.
  Future<Map<String, dynamic>> validateCoupon({
    required String couponCode,
    required double subtotal,
  });

  /// Coupons the customer can pick from, priced against [subtotal]. Each entry
  /// carries `code`, `name`, `description`, `discount_preview`, `eligible` and,
  /// when not eligible, a `reason`.
  Future<List<Map<String, dynamic>>> getAvailableCoupons(double subtotal);

  /// Server-side pricing for the order as it stands, including auto-applied
  /// promotions and the coupon carried on [request]. Nothing is charged.
  Future<Map<String, dynamic>> previewDiscounts(CheckoutRequestEntity request);
}
