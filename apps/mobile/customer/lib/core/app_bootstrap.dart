// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_bootstrap.dart
// Description : Cold-boot session validation for the F2H Customer app.
//               Reads stored JWT tokens from TokenStorage, silently validates
//               via GET /api/v1/auth/session-info, and attempts a silent token
//               refresh on 401. Only returns AuthBootResult.expired (which
//               shows the login screen) if the refresh token itself is invalid
//               or absent — enforcing the "never logout unless explicit" rule.
//
// ============================================================================

import 'package:dio/dio.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';

/// Result of the cold-boot authentication check.
enum AuthBootResult {
  /// Valid session found — show the home screen immediately.
  authenticated,

  /// No stored tokens — user has never logged in (or explicitly logged out).
  unauthenticated,

  /// Refresh token was present but rejected by the server.
  /// Clear all stored credentials and show login with "Session expired" message.
  expired,
}

class AppBootstrap {
  AppBootstrap._();

  /// Run once in [main()] before [runApp()].
  ///
  /// Flow:
  /// 1. Read access token from [TokenStorage].
  /// 2. If absent → [AuthBootResult.unauthenticated].
  /// 3. Call GET /api/v1/auth/session-info.
  ///    - 200 → [AuthBootResult.authenticated].
  ///    - 401 → attempt POST /api/v1/auth/refresh.
  ///        - Refresh 200 → save new tokens → [AuthBootResult.authenticated].
  ///        - Refresh fail → clear all tokens → [AuthBootResult.expired].
  static Future<AuthBootResult> checkAuth() async {
    final dioClient = DioClient();

    // 1. Check if any session exists
    final hasSession = await TokenStorage.hasSession();
    if (!hasSession) return AuthBootResult.unauthenticated;

    // 2. Load & inject access token into DioClient
    final accessToken = await TokenStorage.getAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      return AuthBootResult.unauthenticated;
    }

    // 3. Silent session validation — the DioClient's AuthInterceptor handles
    //    injecting the Bearer header automatically.
    try {
      await dioClient.dio.get(ApiEndpoints.sessionInfo);
      return AuthBootResult.authenticated;
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) {
        // Network error or server down — treat as authenticated (offline mode)
        // The app will show cached content and retry when online.
        return AuthBootResult.authenticated;
      }

      // 4. Access token expired → try silent refresh
      // The DioClient AuthInterceptor will attempt this automatically on 401,
      // but we do an explicit check here to determine the boot result cleanly.
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
