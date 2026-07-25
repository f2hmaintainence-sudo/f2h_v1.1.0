// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : main.dart
// Description : Entry point for F2H Delivery App with AppBootstrap.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/firebase_options.dart';
import 'package:f2h_delivery/core/config/app_config.dart';
import 'package:f2h_delivery/core/di/injection.dart' as di;

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (!kIsWeb) {
    try {
      if (Firebase.apps.isEmpty && AppConfig.firebaseProjectId.isNotEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
    } catch (_) {}
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.init();
  
  if (!kIsWeb) {
    try {
      if (Firebase.apps.isEmpty && AppConfig.firebaseProjectId.isNotEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
        FirebaseMessaging messaging = FirebaseMessaging.instance;
        await messaging.requestPermission();
      }
    } catch (e) {
      debugPrint('[main] Firebase initialization failed: $e');
    }
  }

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const F2HApp());
}

