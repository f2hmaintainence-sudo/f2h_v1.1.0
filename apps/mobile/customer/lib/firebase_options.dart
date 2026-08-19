// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : firebase_options.dart
// Description : Firebase options provider for Customer App.
//               Android uses hardcoded values from google-services.json.
//               iOS uses dynamic AppConfig values from server.
//
// ============================================================================

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart';
import 'package:f2h_customer/core/config/app_config.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      // Hardcoded from android/app/google-services.json — must match exactly.
      // The server-driven values in AppConfig override nothing on Android: the
      // Firebase SDK is initialised before the config sync completes, so these
      // have to stand on their own.
      return const FirebaseOptions(
        apiKey: 'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        appId: '1:842214638527:android:1800c0a5729eb74823d70a',
        messagingSenderId: '842214638527',
        projectId: 'f2h-fresh',
        storageBucket: 'f2h-fresh.firebasestorage.app',
      );
    }
    // iOS / Web: use dynamically loaded AppConfig values
    return AppConfig.dynamicFirebaseOptions;
  }
}
