// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_config.dart
// Description : Dynamic runtime configuration for F2H Customer app.
//               Loads Firebase, Google OAuth, Google Maps, and Razorpay
//               configurations dynamically from server / local cache.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  static const String clientRole = 'CUSTOMER';
  static const String appVersion = String.fromEnvironment('F2H_APP_VERSION', defaultValue: '1.0.3+10');

  static String get roleCode => 'C';

  static String get platformCode {
    if (kIsWeb) return 'wc';
    return defaultTargetPlatform == TargetPlatform.iOS ? 'ic' : 'ac';
  }

  // ---------------------------------------------------------------------------
  // Dynamic Dynamic Server Configs (Loaded from API & cached locally)
  // ---------------------------------------------------------------------------
  static String firebaseApiKey = 'AIzaSyAv0aMZBt7L7021HzVHX8I2PEi2h8paAcE';
  static String firebaseAppId = '1:1060833982707:android:51bfa93dfd661022f31f86';
  static String firebaseMessagingSenderId = '1060833982707';
  static String firebaseProjectId = 'f2hcustomerapp';
  static String firebaseStorageBucket = 'f2hcustomerapp.firebasestorage.app';

  static String firebaseIosApiKey = 'AIzaSyBR4Xs71YQTs8Hzlp5Ql5a15ZxD2FfzGxg';
  static String firebaseIosAppId = '1:1060833982707:ios:64708d0f2c64294ef31f86';
  static String firebaseIosBundleId = 'com.f2h.customer';

  static String googleServerClientId = '605526160181-00mmui7o3uuijjgvhgjjs5qbldai544g.apps.googleusercontent.com';
  static String googleMapsApiKey = '';
  static String razorpayKeyId = 'rzp_test_default';

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
