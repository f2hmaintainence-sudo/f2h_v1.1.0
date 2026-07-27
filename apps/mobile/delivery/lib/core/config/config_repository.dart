// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : config_repository.dart
// Description : Daily server configuration sync engine for F2H Delivery App.
//
// ============================================================================

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/config/app_config.dart';

class ConfigRepository {
  static const String _kConfigKey = 'f2h_del_cached_server_config';
  static const String _kLastSyncKey = 'f2h_del_config_last_sync_timestamp';
  static const Duration _syncTtl = Duration(hours: 24);

  final DioClient _dioClient;

  ConfigRepository({DioClient? dioClient}) : _dioClient = dioClient ?? DioClient();

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
    } catch (_) {}
  }
}
