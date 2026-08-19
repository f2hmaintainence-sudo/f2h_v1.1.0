// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : dev_log.dart
// Description : Debug-only logger for API request/response tracing.
//
// ============================================================================

import 'package:flutter/foundation.dart';

/// Logs a diagnostic line in debug builds only.
///
/// The data layer traces full request and response payloads, which include
/// customer addresses, contact numbers and delivery details. Those traces are
/// useful while developing but must not survive into a release build.
void devLog(String message) {
  if (kDebugMode) {
    debugPrint(message);
  }
}
