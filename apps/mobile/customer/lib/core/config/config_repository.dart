// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : config_repository.dart
// Description : Daily server configuration sync engine with SharedPreferences caching.
//               Hydrates AppConfig instantly from local disk, then refreshes
//               from /api/v1/device/app-version if > 24 hours since last sync.
//
// ============================================================================

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/config/app_config.dart';

class ConfigRepository {
  static const String _kConfigKey = 'f2h_cached_server_config';
  static const String _kLastSyncKey = 'f2h_config_last_sync_timestamp';
  static const Duration _syncTtl = Duration(hours: 24);

  final DioClient _dioClient;

  ConfigRepository({DioClient? dioClient}) : _dioClient = dioClient ?? DioClient();

  /// Hydrate AppConfig from local storage immediately on boot (zero network delay).
  Future<void> hydrateLocalConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawJson = prefs.getString(_kConfigKey);
      if (rawJson != null && rawJson.isNotEmpty) {
        final Map<String, dynamic> data = jsonDecode(rawJson);
        AppConfig.updateFromMap(data);
      }
    } catch (_) {}
  }

  /// Sync server config if > 24 hours since last sync or if forced.
  Future<void> syncIfNeeded({bool force = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastSyncMs = prefs.getInt(_kLastSyncKey) ?? 0;
      final lastSync = DateTime.fromMillisecondsSinceEpoch(lastSyncMs);
      final isExpired = DateTime.now().difference(lastSync) > _syncTtl;

      if (!isExpired && !force) return;

      final response = await _dioClient.dio.get('/device/client-config');
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final Map<String, dynamic> body = response.data;
        final data = body['data'] as Map<String, dynamic>? ?? body;
        AppConfig.updateFromMap(data);
        await prefs.setString(_kConfigKey, jsonEncode(data));
        await prefs.setInt(_kLastSyncKey, DateTime.now().millisecondsSinceEpoch);
      }
    } catch (_) {
      // Network error during background sync — ignore so app continues seamlessly with cached config
    }
  }
}
