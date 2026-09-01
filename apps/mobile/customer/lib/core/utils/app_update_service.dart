// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_update_service.dart
// Description : Asks the backend whether this installed build is still allowed
//               to run. Backs the mandatory-update gate.
// ============================================================================

import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

import 'package:f2h_customer/core/api/api_endpoints.dart';

/// The verdict for one version check.
@immutable
class AppUpdateStatus {
  /// A build older than `app_configs.min_version` **and** `force_update` on.
  /// This is the only state that blocks the app.
  final bool mustUpdate;

  /// A newer build exists but this one is still supported.
  final bool updateAvailable;

  final String storeUrl;
  final String title;
  final String message;
  final String releaseNotes;
  final String latestVersion;
  final String installedVersion;

  const AppUpdateStatus({
    required this.mustUpdate,
    required this.updateAvailable,
    required this.storeUrl,
    required this.title,
    required this.message,
    required this.releaseNotes,
    required this.latestVersion,
    required this.installedVersion,
  });

  /// The safe verdict. Any failure — no network, a 500, a timeout, malformed
  /// JSON — resolves to this, because a version service that is briefly down
  /// must never lock out customers who are on a perfectly good build.
  static const AppUpdateStatus allowed = AppUpdateStatus(
    mustUpdate: false,
    updateAvailable: false,
    storeUrl: '',
    title: '',
    message: '',
    releaseNotes: '',
    latestVersion: '',
    installedVersion: '',
  );
}

class AppUpdateService {
  AppUpdateService._();

  /// Used only when the backend row somehow carries no `store_url`. The package
  /// id matches `android/app/build.gradle.kts` (`applicationId "com.f2h.customer"`).
  static const String playStoreFallbackUrl =
      'https://play.google.com/store/apps/details?id=com.f2h.customer';

  /// Long enough for a slow mobile connection, short enough that a dead service
  /// does not hold the customer on a loading screen.
  static const Duration _timeout = Duration(seconds: 6);

  /// The build actually installed on this device, e.g. `1.0.8+21`.
  ///
  /// Read from the platform package at runtime, never from a Dart constant —
  /// a hardcoded value would report the *build-time* version and would be wrong
  /// for exactly the users this gate exists to catch.
  static Future<String> installedVersion() async {
    final info = await PackageInfo.fromPlatform();
    return '${info.version}+${info.buildNumber}';
  }

  static String _platformKey() {
    if (Platform.isIOS) return 'ios_customer';
    return 'android_customer';
  }

  /// Asks the backend to judge this build. Never throws.
  static Future<AppUpdateStatus> check() async {
    // The gate is an Android/iOS store concern; the web build has no store page.
    if (kIsWeb) return AppUpdateStatus.allowed;

    try {
      final installed = await installedVersion().timeout(_timeout);
      final uri = Uri.parse('${ApiEndpoints.baseUrl}${ApiEndpoints.appCheckVersion}');

      final response = await http.get(
        uri,
        headers: {
          'x-app-platform': _platformKey(),
          'x-app-version': installed,
        },
      ).timeout(_timeout);

      if (response.statusCode != 200) return AppUpdateStatus.allowed;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map) return AppUpdateStatus.allowed;

      final updateRequired = decoded['updateRequired'] == true;
      final forceUpdate = decoded['forceUpdate'] == true;
      final storeUrl = (decoded['storeUrl'] as String?)?.trim() ?? '';

      return AppUpdateStatus(
        // Both flags are required. `updateRequired` alone is also true for a
        // merely-newer release; `forceUpdate` is the admin's explicit switch.
        mustUpdate: updateRequired && forceUpdate,
        updateAvailable: updateRequired && !forceUpdate,
        storeUrl: storeUrl.isNotEmpty ? storeUrl : playStoreFallbackUrl,
        title: (decoded['updateTitle'] as String?)?.trim() ?? '',
        message: (decoded['message'] as String?)?.trim() ?? '',
        releaseNotes: (decoded['releaseNotes'] as String?)?.trim() ?? '',
        latestVersion: (decoded['latestVersion'] as String?)?.trim() ?? '',
        installedVersion: installed,
      );
    } catch (e) {
      debugPrint('AppUpdateService.check failed, allowing access: $e');
      return AppUpdateStatus.allowed;
    }
  }
}
