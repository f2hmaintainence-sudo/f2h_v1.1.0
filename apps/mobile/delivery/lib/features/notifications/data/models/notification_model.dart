class DeliveryNotification {
  final String id;
  final String title;
  final String message;
  final String type;
  final String priority;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic>? data;

  DeliveryNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.priority,
    required this.isRead,
    required this.createdAt,
    this.data,
  });

  factory DeliveryNotification.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      final raw = json['created_at'] ?? json['createdAt'];
      parsedDate = raw != null ? DateTime.parse(raw.toString()) : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    final readVal = json['is_read'] ?? json['isRead'];
    final bool read = readVal == true || readVal == 1 || readVal == 'true';

    return DeliveryNotification(
      id: json['notification_id']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      type: json['type']?.toString().toLowerCase() ?? 'system',
      priority: json['priority']?.toString().toLowerCase() ?? 'normal',
      isRead: read,
      createdAt: parsedDate,
      data: json['data'] is Map ? Map<String, dynamic>.from(json['data'] as Map) : null,
    );
  }

  DeliveryNotification copyWith({
    String? id,
    String? title,
    String? message,
    String? type,
    String? priority,
    bool? isRead,
    DateTime? createdAt,
    Map<String, dynamic>? data,
  }) {
    return DeliveryNotification(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      type: type ?? this.type,
      priority: priority ?? this.priority,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      data: data ?? this.data,
    );
  }
}
