import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/cart/cart_repository.dart';
import 'package:f2h_customer/features/catalog/data/datasources/cart/cart_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/models/cart/cart_calculations_model.dart';
import 'package:f2h_customer/features/catalog/data/models/cart/cart_item_model.dart';

class CartRepositoryImpl implements CartRepository {
  final CartRemoteDataSource remoteDataSource;

  CartRepositoryImpl({required this.remoteDataSource});

  @override
  Future<CartCalculationsEntity> syncCart(List<CartItemEntity> items, {String? customerId}) async {
    // 1. Map Dart Entities to JSON-ready Models
    final jsonList = items.map((item) {
      return CartItemModel(
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        unitPrice: item.unitPrice,
        purchaseType: item.purchaseType,
        quantity: item.quantity,
        deliveryDate: item.deliveryDate,
        deliverySlot: item.deliverySlot,
        schedules: item.schedules,
      ).toJson();
    }).toList();

    // 2. Call the remote data source to hit the POST /customer/cart-sync API
    final rawResponse = await remoteDataSource.syncCart(jsonList, customerId: customerId);

    // 3. Extract the calculated billSummary block and convert it to our Entity
    // Using the 'billSummary' JSON key returned by your NestJS calculations
    final billSummaryJson = rawResponse['billSummary'] as Map<String, dynamic>;

    return CartCalculationsModel.fromJson(billSummaryJson);
  }

  @override
  Future<CartLoadResultEntity> getCart(String userId) async {
    final rawResponse = await remoteDataSource.getCart(userId);

    // 1. Parse billSummary
    final billSummaryJson = rawResponse['billSummary'] as Map<String, dynamic>;
    final calculations = CartCalculationsModel.fromJson(billSummaryJson);

    // 2. Parse items list mapping nested cart_data fields
    final rawItems = rawResponse['items'] as List<dynamic>? ?? [];
    print('=== [CartRepositoryImpl] Parsing getCart raw response. rawItems length: ${rawItems.length}');
    final List<CartItemEntity> items = [];
    for (final rawItem in rawItems) {
      final itemMap = rawItem as Map<String, dynamic>;
      final cartData = itemMap['cart_data'] as Map<String, dynamic>?;
      if (cartData != null) {
        final item = CartItemModel.fromJson(cartData);
        print('  Parsed item: variantId=${item.variantId}, name=${item.productName}, price=${item.unitPrice}');
        items.add(item);
      } else {
        print('  Warning: rawItem cart_data was null! rawItem keys: ${itemMap.keys}');
      }
    }

    return CartLoadResultEntity(
      items: items,
      calculations: calculations,
    );
  }
}
