class NotificationItem {
  final int id;
  final String notificationId;
  final String title;
  final String message;
  final String type; // success, info, warning, error
  final String priority; // low, medium, high, critical
  final String? html;
  final String? image;
  final String status; // unread, read, dismissed
  final DateTime? notifiedAt;
  final DateTime? readAt;
  final DateTime? createdAt;

  NotificationItem({
    required this.id,
    required this.notificationId,
    required this.title,
    required this.message,
    required this.type,
    required this.priority,
    this.html,
    this.image,
    required this.status,
    this.notifiedAt,
    this.readAt,
    this.createdAt,
  });

  bool get isUnread => status == 'unread';

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      notificationId: json['notification_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      type: json['type']?.toString() ?? 'info',
      priority: json['priority']?.toString() ?? 'medium',
      html: json['html']?.toString(),
      image: json['image']?.toString(),
      status: json['status']?.toString() ?? 'unread',
      notifiedAt: json['notified_at'] != null ? DateTime.tryParse(json['notified_at'].toString()) : null,
      readAt: json['read_at'] != null ? DateTime.tryParse(json['read_at'].toString()) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
    );
  }

  NotificationItem copyWith({String? status, DateTime? readAt}) {
    return NotificationItem(
      id: id,
      notificationId: notificationId,
      title: title,
      message: message,
      type: type,
      priority: priority,
      html: html,
      image: image,
      status: status ?? this.status,
      notifiedAt: notifiedAt,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt,
    );
  }
}
