import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

abstract class NotificationsRemoteDataSource {
  Future<Map<String, dynamic>> getNotificationsWithCount();
  Future<void> markAsRead(int recipientId);
  Future<void> markAllAsRead();
  Future<void> dismissNotification(int recipientId);
  Future<void> dismissAllNotifications();
}

class NotificationsRemoteDataSourceImpl implements NotificationsRemoteDataSource {
  final DioClient dioClient;
  NotificationsRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<Map<String, dynamic>> getNotificationsWithCount() async {
    final response = await dioClient.dio.get(ApiEndpoints.notificationsWithCount);
    if (response.data != null) {
      return Map<String, dynamic>.from(response.data as Map);
    }
    return {'notifications': [], 'unreadCount': 0};
  }

  @override
  Future<void> markAsRead(int recipientId) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.put(ApiEndpoints.notificationMarkRead(recipientId));
  }

  @override
  Future<void> markAllAsRead() async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.put(ApiEndpoints.notificationsMarkAllRead);
  }

  @override
  Future<void> dismissNotification(int recipientId) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.put(ApiEndpoints.notificationDismiss(recipientId));
  }

  @override
  Future<void> dismissAllNotifications() async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.put(ApiEndpoints.notificationsDismissAll);
  }
}
