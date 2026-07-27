// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : firebase_options.dart
// Description : Dynamic Firebase options provider for Customer App.
//               Reads configurations dynamically from AppConfig / Server API
//               (no hardcoded credentials).
//
// ============================================================================

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:f2h_customer/core/config/app_config.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return AppConfig.dynamicFirebaseOptions;
  }
}