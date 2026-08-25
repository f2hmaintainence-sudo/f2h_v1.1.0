// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_config.dart
// Description : Dynamic runtime configuration for F2H Customer app.
//               Loads Firebase, Google OAuth, Google Maps, and Razorpay
//               configurations dynamically from server / local cache.
//
// ============================================================================

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  static const String clientRole = 'CUSTOMER';
  static const String appVersion = String.fromEnvironment('F2H_APP_VERSION', defaultValue: '1.0.5+18');

  static String get roleCode => 'C';

  static String get platformCode {
    if (kIsWeb) return 'wc';
    return defaultTargetPlatform == TargetPlatform.iOS ? 'ic' : 'ac';
  }

  // ---------------------------------------------------------------------------
  // Dynamic Dynamic Server Configs (Loaded from API & cached locally)
  // ---------------------------------------------------------------------------
  static String firebaseApiKey = '';
  static String firebaseAppId = '';
  static String firebaseMessagingSenderId = '';
  static String firebaseProjectId = '';
  static String firebaseStorageBucket = '';

  static String firebaseIosApiKey = '';
  static String firebaseIosAppId = '';
  static String firebaseIosBundleId = '';

  // Seeded with the live values rather than left blank. These are refreshed
  // from /device/client-config on every sync, but that lands *after* the first
  // frame — an empty client id here made the first Google sign-in of a fresh
  // install fail with 'Google did not return a sign-in token'.
  static String googleServerClientId =
      '842214638527-0hdom5v6ab9aum1jrn86treomqqhmm7m.apps.googleusercontent.com';
  static String googleMapsApiKey = 'AIzaSyDPzNGpuT5QHHdCmlKAogNkDJj1e34urbs';

  /// Raster tiles are fetched through the F2H proxy rather than from the
  /// tile origin. Hitting OpenStreetMap from every device gets the client's
  /// network rate-blocked, which is what turned the map into a wall of
  /// "Access blocked" tiles. The server refreshes this on every sync.
  static String mapTileUrlTemplate =
      'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
  static String mapAttribution = '© Google Maps';
  static String razorpayKeyId = '';

  static double minOrderAmount = 100.0;
  static double freeDeliveryThreshold = 500.0;
  static String supportPhone = '+919876543210';
  static String supportEmail = 'support@f2hfresh.com';
  static bool maintenanceMode = false;
  static DateTime? lastConfigSync;

  static FirebaseOptions get dynamicFirebaseOptions {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return FirebaseOptions(
        apiKey: firebaseIosApiKey,
        appId: firebaseIosAppId,
        messagingSenderId: firebaseMessagingSenderId,
        projectId: firebaseProjectId,
        storageBucket: firebaseStorageBucket,
        iosBundleId: firebaseIosBundleId,
      );
    }
    return FirebaseOptions(
      apiKey: firebaseApiKey,
      appId: firebaseAppId,
      messagingSenderId: firebaseMessagingSenderId,
      projectId: firebaseProjectId,
      storageBucket: firebaseStorageBucket,
    );
  }

  static void updateFromMap(Map<String, dynamic> data) {
    if (data.containsKey('firebase') && data['firebase'] is Map) {
      final fb = data['firebase'] as Map<String, dynamic>;
      firebaseApiKey = fb['apiKey'] as String? ?? firebaseApiKey;
      firebaseAppId = fb['appId'] as String? ?? firebaseAppId;
      firebaseMessagingSenderId = fb['messagingSenderId'] as String? ?? firebaseMessagingSenderId;
      firebaseProjectId = fb['projectId'] as String? ?? firebaseProjectId;
      firebaseStorageBucket = fb['storageBucket'] as String? ?? firebaseStorageBucket;
      firebaseIosApiKey = fb['iosApiKey'] as String? ?? firebaseIosApiKey;
      firebaseIosAppId = fb['iosAppId'] as String? ?? firebaseIosAppId;
      firebaseIosBundleId = fb['iosBundleId'] as String? ?? firebaseIosBundleId;
    }

    if (data.containsKey('google_oauth') && data['google_oauth'] is Map) {
      final oauth = data['google_oauth'] as Map<String, dynamic>;
      googleServerClientId = oauth['serverClientId'] as String? ?? googleServerClientId;
    }

    if (data.containsKey('google_maps') && data['google_maps'] is Map) {
      final maps = data['google_maps'] as Map<String, dynamic>;
      googleMapsApiKey = maps['apiKey'] as String? ?? googleMapsApiKey;
      mapTileUrlTemplate =
          maps['tileUrlTemplate'] as String? ?? mapTileUrlTemplate;
      mapAttribution = maps['tileAttribution'] as String? ?? mapAttribution;
    }

    if (data.containsKey('razorpay') && data['razorpay'] is Map) {
      final rzp = data['razorpay'] as Map<String, dynamic>;
      razorpayKeyId = rzp['keyId'] as String? ?? razorpayKeyId;
    }

    minOrderAmount = (data['min_order_amount'] as num?)?.toDouble() ?? minOrderAmount;
    freeDeliveryThreshold = (data['free_delivery_threshold'] as num?)?.toDouble() ?? freeDeliveryThreshold;
    supportPhone = data['support_phone'] as String? ?? supportPhone;
    supportEmail = data['support_email'] as String? ?? supportEmail;
    maintenanceMode = data['maintenance_mode'] as bool? ?? maintenanceMode;
    lastConfigSync = DateTime.now();
  }
}
