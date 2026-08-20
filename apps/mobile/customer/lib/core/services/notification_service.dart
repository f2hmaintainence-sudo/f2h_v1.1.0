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
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/features/profile/presentation/screens/customer_bills_screen.dart';

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

class NotificationService {
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Stream<Map<String, dynamic>> get onNotification => _messageController.stream;

  FirebaseMessaging? get _fcm {
    if (kIsWeb) return null;
    try {
      return FirebaseMessaging.instance;
    } catch (e) {
      debugPrint(
        '[NotificationService] FirebaseMessaging instance unavailable: $e',
      );
      return null;
    }
  }

  String? _cachedFcmToken;

  static void handleNotificationRouting(Map<String, dynamic> data, {String? rawPayload}) {
    final type = data['type']?.toString().toLowerCase() ?? '';
    final route = data['route']?.toString().toLowerCase() ?? '';
    final url = data['url']?.toString() ?? rawPayload ?? '';

    if (type == 'customer_bills' ||
        type == 'bills' ||
        type == 'billing' ||
        route == '/customer_bills' ||
        route == 'customer_bills' ||
        url.contains('customer_bills')) {
      appNavigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => const CustomerBillsScreen(),
        ),
      );
      return;
    }

    if (url.isNotEmpty && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } catch (_) {}
    }
  }

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

      const initializationSettingsAndroid = AndroidInitializationSettings(
        '@mipmap/ic_launcher',
      );
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
            handleNotificationRouting({'url': payload, 'route': payload}, rawPayload: payload);
          }
        },
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
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

      // Check initial message if launched from terminated state via notification click
      try {
        final initialMessage = await fcm.getInitialMessage();
        if (initialMessage != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            handleNotificationRouting(initialMessage.data, rawPayload: initialMessage.data['url']);
          });
        }
      } catch (e) {
        debugPrint('[NotificationService] getInitialMessage notice: $e');
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
        final title =
            message.notification?.title ??
            message.data['title'] ??
            'Farm to Home';
        final body =
            message.notification?.body ??
            message.data['body'] ??
            'New notification received';
        final routePayload = message.data['route'] ?? message.data['type'] ?? message.data['url'];

        showLocalNotification(title: title, body: body, payload: routePayload);

        final Map<String, dynamic> payload = {
          'title': title,
          'body': body,
          'data': message.data,
        };
        _messageController.add(payload);
      });

      // 4. Handle notification taps when app is in background but opened
      FirebaseMessaging.onMessageOpenedApp.listen((
        RemoteMessage message,
      ) async {
        handleNotificationRouting(message.data, rawPayload: message.data['url']);
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
    if (_cachedFcmToken != null && _cachedFcmToken!.isNotEmpty) {
      debugPrint('🔥 [FCM] Using cached token: $_cachedFcmToken');
      return _cachedFcmToken;
    }
    try {
      final fcm = _fcm;
      if (fcm == null) {
        debugPrint('🔥 [FCM] ERROR: FirebaseMessaging.instance is null — Firebase not initialized!');
        return null;
      }
      final token = await fcm.getToken().timeout(const Duration(seconds: 8));
      if (token != null && token.isNotEmpty) {
        _cachedFcmToken = token;
        debugPrint('🔥 [FCM] Token fetched fresh: $token');
      } else {
        debugPrint('🔥 [FCM] WARNING: getToken() returned null/empty — check SHA-1 & google-services.json');
      }
      return _cachedFcmToken;
    } catch (e) {
      debugPrint('🔥 [FCM] getToken() error: $e');
      return _cachedFcmToken;
    }
  }
}
