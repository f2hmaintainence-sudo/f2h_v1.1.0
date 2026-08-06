abstract class NotificationsEvent {}

class LoadNotifications extends NotificationsEvent {}

class MarkAsRead extends NotificationsEvent {
  final int recipientId;
  MarkAsRead(this.recipientId);
}

class MarkAllAsRead extends NotificationsEvent {}

class DismissNotification extends NotificationsEvent {
  final int recipientId;
  DismissNotification(this.recipientId);
}

class DismissAllNotifications extends NotificationsEvent {}

/// Filter: 'all', 'unread', 'read'
class ChangeStatusFilter extends NotificationsEvent {
  final String filter;
  ChangeStatusFilter(this.filter);
}

/// Filter by type: null = all, or 'success', 'info', 'warning', 'error'
class ChangeTypeFilter extends NotificationsEvent {
  final String? typeFilter;
  ChangeTypeFilter(this.typeFilter);
}
