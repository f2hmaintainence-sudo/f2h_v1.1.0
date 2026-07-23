import 'package:f2h_customer/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_customer/features/orders/data/datasources/orders_remote_datasource.dart';

class OrdersRepositoryImpl implements OrdersRepository {
  final OrdersRemoteDataSource remoteDataSource;
  OrdersRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Map<String, dynamic>> getOrdersAndSubscriptions() {
    return remoteDataSource.getOrdersAndSubscriptions();
  }

  @override
  Future<Map<String, dynamic>> cancelOrder(String orderId) {
    return remoteDataSource.cancelOrder(orderId);
  }

  @override
  Future<Map<String, dynamic>> rateOrder(String orderId, int rating, String feedback, {String? productId}) {
    return remoteDataSource.rateOrder(orderId, rating, feedback, productId: productId);
  }
}
