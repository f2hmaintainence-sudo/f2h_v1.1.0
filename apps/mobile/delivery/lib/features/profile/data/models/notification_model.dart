class NotificationModel {
  final int id;
  final String notificationId;
  final String title;
  final String message;
  final String type;
  final String priority;
  final String? html;
  final String? image;
  final String status;
  final DateTime notifiedAt;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    required this.notificationId,
    required this.title,
    required this.message,
    required this.type,
    required this.priority,
    this.html,
    this.image,
    required this.status,
    required this.notifiedAt,
    this.readAt,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      notificationId: json['notification_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      priority: json['priority'] as String? ?? 'medium',
      html: json['html'] as String?,
      image: json['image'] as String?,
      status: json['status'] as String? ?? 'unread',
      notifiedAt: DateTime.parse(json['notified_at'] ?? json['created_at'] ?? DateTime.now().toIso8601String()),
      readAt: json['read_at'] != null ? DateTime.parse(json['read_at']) : null,
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'notification_id': notificationId,
      'title': title,
      'message': message,
      'type': type,
      'priority': priority,
      'html': html,
      'image': image,
      'status': status,
      'notified_at': notifiedAt.toIso8601String(),
      'read_at': readAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }

  bool get isRead => status == 'read';

  NotificationModel copyWith({
    int? id,
    String? notificationId,
    String? title,
    String? message,
    String? type,
    String? priority,
    String? html,
    String? image,
    String? status,
    DateTime? notifiedAt,
    DateTime? readAt,
    DateTime? createdAt,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      notificationId: notificationId ?? this.notificationId,
      title: title ?? this.title,
      message: message ?? this.message,
      type: type ?? this.type,
      priority: priority ?? this.priority,
      html: html ?? this.html,
      image: image ?? this.image,
      status: status ?? this.status,
      notifiedAt: notifiedAt ?? this.notifiedAt,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
