// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_config.dart
// Description : Dynamic runtime configuration for F2H Delivery App.
//
// ============================================================================

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  static const String clientRole = 'DELIVERY_BOY';
  static const String appVersion = String.fromEnvironment('F2H_APP_VERSION', defaultValue: '1.0.0+1');

  static String get roleCode => 'D';

  static String get platformCode {
    if (kIsWeb) return 'wd';
    return defaultTargetPlatform == TargetPlatform.iOS ? 'id' : 'ad';
  }

  // Dynamic server configurations
  static String firebaseApiKey = '';
  static String firebaseAppId = '';
  static String firebaseMessagingSenderId = '';
  static String firebaseProjectId = '';
  static String firebaseStorageBucket = '';

  static String firebaseIosApiKey = '';
  static String firebaseIosAppId = '';
  static String firebaseIosBundleId = '';

  static String googleServerClientId = '';
  static String googleMapsApiKey = '';

  static double maxDeliveryRadiusKm = 15.0;
  static int gpsPingIntervalSeconds = 30;
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
    }

    maxDeliveryRadiusKm = (data['max_delivery_radius_km'] as num?)?.toDouble() ?? maxDeliveryRadiusKm;
    gpsPingIntervalSeconds = (data['gps_ping_interval_sec'] as num?)?.toInt() ?? gpsPingIntervalSeconds;
    maintenanceMode = data['maintenance_mode'] as bool? ?? maintenanceMode;
    lastConfigSync = DateTime.now();
  }
}
