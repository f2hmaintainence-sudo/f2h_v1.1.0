// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : firebase_options.dart
// Description : Firebase options provider for the Delivery App.
//               Android uses hardcoded values from google-services.json.
//               iOS uses dynamic AppConfig values from the server.
//
// ============================================================================

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart';
import 'package:f2h_delivery/core/config/app_config.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      // Hardcoded from android/app/google-services.json — must match exactly.
      // Firebase is initialised before the server config sync completes on a
      // fresh install, so Android cannot depend on AppConfig being populated.
      return const FirebaseOptions(
        apiKey: 'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        appId: '1:842214638527:android:48141f5c3bf1127123d70a',
        messagingSenderId: '842214638527',
        projectId: 'f2h-fresh',
        storageBucket: 'f2h-fresh.firebasestorage.app',
      );
    }
    // iOS / Web: use dynamically loaded AppConfig values
    return AppConfig.dynamicFirebaseOptions;
  }
}
