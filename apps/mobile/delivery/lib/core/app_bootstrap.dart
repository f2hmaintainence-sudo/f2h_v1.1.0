// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_bootstrap.dart
// Description : Cold-boot session validation for F2H Delivery App.
//
// ============================================================================

import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/auth/token_storage.dart';

enum AuthBootResult {
  authenticated,
  unauthenticated,
  expired,
}

class AppBootstrap {
  AppBootstrap._();

  static Future<AuthBootResult> checkAuth() async {
    final dioClient = DioClient();

    final hasSession = await TokenStorage.hasSession();
    if (!hasSession) return AuthBootResult.unauthenticated;

    final accessToken = await TokenStorage.getAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      return AuthBootResult.unauthenticated;
    }

    try {
      await dioClient.dio.get(ApiEndpoints.sessionInfo);
      return AuthBootResult.authenticated;
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) {
        return AuthBootResult.authenticated;
      }

      final refreshToken = await TokenStorage.getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        await _clearAndExpire(dioClient);
        return AuthBootResult.expired;
      }

      try {
        final refreshDio = Dio(BaseOptions(
          baseUrl: ApiEndpoints.apiBaseUrl,
          headers: {'Content-Type': 'application/json'},
        ));
        final resp = await refreshDio.post(
          ApiEndpoints.refreshToken,
          data: {'refreshToken': refreshToken},
        );
        final newAccess  = resp.data['accessToken']  as String?;
        final newRefresh = resp.data['refreshToken'] as String?;

        if (newAccess == null || newAccess.isEmpty) throw Exception('empty');

        await TokenStorage.saveTokens(
          accessToken:  newAccess,
          refreshToken: newRefresh ?? refreshToken,
        );
        return AuthBootResult.authenticated;
      } catch (_) {
        await _clearAndExpire(dioClient);
        return AuthBootResult.expired;
      }
    }
  }

  static Future<void> _clearAndExpire(DioClient client) async {
    await TokenStorage.clear();
    await client.clearSession();
  }
}
