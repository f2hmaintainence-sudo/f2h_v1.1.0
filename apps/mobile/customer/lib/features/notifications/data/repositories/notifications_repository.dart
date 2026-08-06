import 'package:f2h_customer/features/notifications/data/datasources/notifications_remote_datasource.dart';
import 'package:f2h_customer/features/notifications/data/models/notification_model.dart';

abstract class NotificationsRepository {
  Future<({List<NotificationItem> notifications, int unreadCount})> getNotificationsWithCount();
  Future<void> markAsRead(int recipientId);
  Future<void> markAllAsRead();
  Future<void> dismissNotification(int recipientId);
  Future<void> dismissAllNotifications();
}

class NotificationsRepositoryImpl implements NotificationsRepository {
  final NotificationsRemoteDataSource remoteDataSource;
  NotificationsRepositoryImpl({required this.remoteDataSource});

  @override
  Future<({List<NotificationItem> notifications, int unreadCount})> getNotificationsWithCount() async {
    final data = await remoteDataSource.getNotificationsWithCount();
    final rawNotifications = data['notifications'] as List<dynamic>? ?? [];
    final notifications = rawNotifications
        .map((json) => NotificationItem.fromJson(json as Map<String, dynamic>))
        .toList();
    final unreadCount = data['unreadCount'] is int
        ? data['unreadCount'] as int
        : int.tryParse(data['unreadCount']?.toString() ?? '0') ?? 0;
    return (notifications: notifications, unreadCount: unreadCount);
  }

  @override
  Future<void> markAsRead(int recipientId) =>
      remoteDataSource.markAsRead(recipientId);

  @override
  Future<void> markAllAsRead() =>
      remoteDataSource.markAllAsRead();

  @override
  Future<void> dismissNotification(int recipientId) =>
      remoteDataSource.dismissNotification(recipientId);

  @override
  Future<void> dismissAllNotifications() =>
      remoteDataSource.dismissAllNotifications();
}
