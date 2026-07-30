// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : notification_service.dart
// Description : High-importance FCM and Flutter Local Notifications service.
//
// ============================================================================

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:url_launcher/url_launcher.dart';

class NotificationService {
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  Stream<Map<String, dynamic>> get onNotification => _messageController.stream;

  FirebaseMessaging? get _fcm {
    if (kIsWeb) return null;
    try {
      return FirebaseMessaging.instance;
    } catch (e) {
      debugPrint('[NotificationService] FirebaseMessaging instance unavailable: $e');
      return null;
    }
  }

  String? _cachedFcmToken;

  Future<void> initialize() async {
    if (kIsWeb) return;
    try {
      // 1. Setup Android High Importance Notification Channel
      const androidChannel = AndroidNotificationChannel(
        'high_importance_channel',
        'High Importance Notifications',
        description: 'This channel is used for important notifications.',
        importance: Importance.high,
      );

      const initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initializationSettingsDarwin = DarwinInitializationSettings();
      const initializationSettings = InitializationSettings(
        android: initializationSettingsAndroid,
        iOS: initializationSettingsDarwin,
      );

      await _localNotifications.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload != null && payload.isNotEmpty) {
            try {
              launchUrl(Uri.parse(payload));
            } catch (_) {}
          }
        },
      );

      final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(androidChannel);
        await androidPlugin.requestNotificationsPermission();
      }

      final fcm = _fcm;
      if (fcm == null) return;

      // 2. Request permission (without strict timeout so user dialog interaction completes)
      try {
        await fcm.requestPermission(alert: true, badge: true, sound: true);
      } catch (e) {
        debugPrint('[NotificationService] Permission request notice: $e');
      }

      // Retrieve and log FCM device token
      try {
        final token = await fcm.getToken();
        if (token != null && token.isNotEmpty) {
          _cachedFcmToken = token;
          debugPrint('🔥 [FCM] Firebase Connected Successfully! Token: $token');
        }
      } catch (e) {
        debugPrint('🔥 [FCM] Token retrieval log notice: $e');
      }

      fcm.onTokenRefresh.listen((token) {
        _cachedFcmToken = token;
        debugPrint('🔥 [FCM] Token Refreshed: $token');
      });

      // 3. Foreground message listener -> triggers heads-up banner notification
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final title = message.notification?.title ?? message.data['title'] ?? 'Farm to Home';
        final body = message.notification?.body ?? message.data['body'] ?? 'New notification received';
        final url = message.data['url'];

        showLocalNotification(
          title: title,
          body: body,
          payload: url,
        );

        final Map<String, dynamic> payload = {
          'title': title,
          'body': body,
          'data': message.data,
        };
        _messageController.add(payload);
      });

      // 4. Handle notification taps when app is in background but opened
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) async {
        final url = message.data['url'];
        if (url != null) {
          await launchUrl(Uri.parse(url));
        }
      });
    } catch (e) {
      debugPrint('[NotificationService] Initialization skipped: $e');
    }
  }

  Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      const androidDetails = AndroidNotificationDetails(
        'high_importance_channel',
        'High Importance Notifications',
        channelDescription: 'This channel is used for important notifications.',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      );
      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );
      const details = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await _localNotifications.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title,
        body,
        details,
        payload: payload,
      );
    } catch (e) {
      debugPrint('[NotificationService] Local notification error: $e');
    }
  }

  Future<String?> getToken() async {
    if (kIsWeb) return null;
    if (_cachedFcmToken != null) return _cachedFcmToken;
    try {
      final fcm = _fcm;
      if (fcm == null) return null;

      final token = await fcm.getToken().timeout(const Duration(seconds: 5));
      _cachedFcmToken = token;
      return token;
    } catch (e) {
      debugPrint('[NotificationService] FCM token retrieval skipped: $e');
      return _cachedFcmToken;
    }
  }
}
