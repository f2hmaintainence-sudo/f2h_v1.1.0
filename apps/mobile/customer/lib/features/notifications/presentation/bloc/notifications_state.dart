import 'package:f2h_customer/features/notifications/data/models/notification_model.dart';

abstract class NotificationsState {}

class NotificationsInitial extends NotificationsState {}

class NotificationsLoading extends NotificationsState {}

class NotificationsLoaded extends NotificationsState {
  final List<NotificationItem> allNotifications;
  final List<NotificationItem> filteredNotifications;
  final int unreadCount;
  final String statusFilter; // 'all', 'unread', 'read'
  final String? typeFilter; // null, 'success', 'info', 'warning', 'error'

  NotificationsLoaded({
    required this.allNotifications,
    required this.filteredNotifications,
    required this.unreadCount,
    this.statusFilter = 'all',
    this.typeFilter,
  });

  NotificationsLoaded copyWith({
    List<NotificationItem>? allNotifications,
    List<NotificationItem>? filteredNotifications,
    int? unreadCount,
    String? statusFilter,
    String? typeFilter,
    bool clearTypeFilter = false,
  }) {
    return NotificationsLoaded(
      allNotifications: allNotifications ?? this.allNotifications,
      filteredNotifications: filteredNotifications ?? this.filteredNotifications,
      unreadCount: unreadCount ?? this.unreadCount,
      statusFilter: statusFilter ?? this.statusFilter,
      typeFilter: clearTypeFilter ? null : (typeFilter ?? this.typeFilter),
    );
  }
}

class NotificationsError extends NotificationsState {
  final String message;
  NotificationsError(this.message);
}
