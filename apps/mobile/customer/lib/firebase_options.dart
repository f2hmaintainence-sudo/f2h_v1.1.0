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
      // Hardcoded from google-services.json — must match exactly
      return const FirebaseOptions(
        apiKey: 'AIzaSyBMqFkPAenVd4rurNYLxcb17fqRN0Bm47U',
        appId: '1:277443632535:android:a9290d2881da2d5e0b38d2',
        messagingSenderId: '277443632535',
        projectId: 'f2hfresh-65beb',
        storageBucket: 'f2hfresh-65beb.firebasestorage.app',
      );
    }
    // iOS / Web: use dynamically loaded AppConfig values
    return AppConfig.dynamicFirebaseOptions;
  }
}
