import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/features/notifications/data/models/notification_model.dart';

class NotificationApiService {
  final DioClient _dioClient = DioClient();

  /// Fetches notifications list and unread count from API.
  Future<Map<String, dynamic>> getNotificationsWithCount() async {
    try {
      final response = await _dioClient.dio.get(ApiEndpoints.notifications);
      final dynamic raw = response.data;
      final List<dynamic> list = (raw is Map && raw['data'] is List)
          ? raw['data'] as List<dynamic>
          : (raw is List ? raw : []);

      final notifications = list
          .whereType<Map>()
          .map((json) => DeliveryNotification.fromJson(Map<String, dynamic>.from(json)))
          .toList();

      final unreadCount = notifications.where((n) => !n.isRead).length;

      return {
        'notifications': notifications,
        'unreadCount': unreadCount,
      };
    } catch (e) {
      // Fallback sample notification if first load / offline
      return {
        'notifications': <DeliveryNotification>[
          DeliveryNotification(
            id: 'n1',
            title: 'Welcome to F2H Fresh Partner!',
            message: 'You are all set to receive and deliver fresh morning runs.',
            type: 'system',
            priority: 'high',
            isRead: false,
            createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
          ),
          DeliveryNotification(
            id: 'n2',
            title: 'Warehouse Route Ready',
            message: 'Your morning delivery items are packed and ready for collection.',
            type: 'order',
            priority: 'normal',
            isRead: false,
            createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          ),
        ],
        'unreadCount': 2,
      };
    }
  }

  /// Mark specific notification as read.
  Future<bool> markAsRead(String notificationId) async {
    try {
      await _dioClient.dio.post(
        ApiEndpoints.notificationsMarkRead,
        data: {
          'notification_ids': [notificationId],
        },
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Mark all notifications as read.
  Future<bool> markAllAsRead() async {
    try {
      await _dioClient.dio.post(ApiEndpoints.notificationsMarkAllRead);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Dismiss all notifications.
  Future<bool> dismissAll() async {
    try {
      await _dioClient.dio.delete(ApiEndpoints.notificationsDismissAll);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Delete a single notification.
  Future<bool> deleteNotification(String id) async {
    try {
      await _dioClient.dio.delete(ApiEndpoints.notificationItem(id));
      return true;
    } catch (_) {
      return false;
    }
  }
}
