// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : main.dart
// Description : Entry point for the F2H Customer mobile application.
//               Auth check is done inside AuthBloc via /customer/bootstrap.
//               401 → Login screen, 200 → Home screen.
//
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/firebase_options.dart';
import 'package:f2h_customer/core/services/notification_service.dart';
import 'package:f2h_customer/core/di/injection.dart' as di;
import 'package:f2h_customer/core/di/injection.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!kIsWeb) {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
    } catch (_) {}
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Boot DI container
  await di.init();

  // 2. Firebase init — must complete before runApp so FCM token is ready
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    }
    if (!kIsWeb) {
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );
      await sl<NotificationService>().initialize();
    }
  } catch (e) {
    debugPrint('[main] Firebase init skipped: $e');
  }

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  // 3. Launch — AuthBloc will call /customer/bootstrap to decide home vs login
  runApp(const F2HApp());
}
