// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : main.dart
// Description : Entry point for the F2H Customer mobile application.
//               Runs AppBootstrap.checkAuth() before runApp() to silently
//               validate any stored JWT session — enforcing "never logout"
//               unless the user explicitly signs out or refresh token expires.
//
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/firebase_options.dart';
import 'package:f2h_customer/core/app_bootstrap.dart';
import 'package:f2h_customer/core/services/notification_service.dart';
import 'package:f2h_customer/core/di/injection.dart' as di;
import 'package:f2h_customer/core/di/injection.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!kIsWeb) {
    try {
      if (Firebase.apps.isEmpty) {
        if (defaultTargetPlatform == TargetPlatform.iOS) {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
        } else {
          await Firebase.initializeApp();
        }
      }
    } catch (_) {}
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Boot DI container (DioClient.init() is called inside di.init())
  await di.init();

  // 2. Firebase — non-blocking; app works without it if unavailable
  if (!kIsWeb) {
    try {
      if (Firebase.apps.isEmpty) {
        if (defaultTargetPlatform == TargetPlatform.iOS) {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
        } else {
          await Firebase.initializeApp();
        }
      }
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      sl<NotificationService>().initialize();
    } catch (e) {
      debugPrint('[main] Firebase init failed: $e');
    }
  }

  // 3. Cold-boot auth check — determines initial screen without a loading flash
  final bootResult = await AppBootstrap.checkAuth();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));

  // 4. Launch app with pre-resolved auth state
  runApp(F2HApp(bootResult: bootResult));
}
