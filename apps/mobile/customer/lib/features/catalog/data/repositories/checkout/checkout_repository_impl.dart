import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/checkout/checkout_repository.dart';
import 'package:f2h_customer/features/catalog/data/datasources/checkout/checkout_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/models/checkout/checkout_request_model.dart';

class CheckoutRepositoryImpl implements CheckoutRepository {
  final CheckoutRemoteDataSource remoteDataSource;

  CheckoutRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestEntity request) async {
    final requestModel = CheckoutRequestModel(
      userId: request.userId,
      items: request.items,
      addressId: request.addressId,
      paymentMethod: request.paymentMethod,
      paymentType: request.paymentType,
      subscriptionStartDate: request.subscriptionStartDate,
      subscriptionEndDate: request.subscriptionEndDate,
      subscriptionAutoRenew: request.subscriptionAutoRenew,
      couponCode: request.couponCode,
    );

    return remoteDataSource.placeCheckout(requestModel);
  }

  @override
  Future<Map<String, dynamic>> validateCoupon({
    required String couponCode,
    required double subtotal,
  }) {
    return remoteDataSource.validateCoupon(
      couponCode: couponCode,
      subtotal: subtotal,
    );
  }

  @override
  Future<Map<String, dynamic>> previewDiscounts(CheckoutRequestEntity request) {
    final requestModel = CheckoutRequestModel(
      userId: request.userId,
      items: request.items,
      addressId: request.addressId,
      paymentMethod: request.paymentMethod,
      paymentType: request.paymentType,
      couponCode: request.couponCode,
    );

    return remoteDataSource.previewDiscounts(requestModel);
  }
}
