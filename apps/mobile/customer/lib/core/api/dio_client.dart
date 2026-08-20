// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : dio_client.dart
// Description : Configured Dio HTTP client for the F2H Customer app.
//               - Base URL: /api/v1/ (URI-versioned)
//               - Compact headers: X-Role:C, X-Plt:<code>, X-Ver:<semver>
//               - AuthInterceptor: auto-injects Bearer token + silently
//                 refreshes expired access tokens using the refresh token.
//               - CSRF: auto-reads csrf_token cookie for mutations (non-web).
//               - PersistCookieJar: survives app restarts.
//
// ============================================================================

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';

/// Singleton Dio client shared across the entire Customer app.
class DioClient {
  DioClient._internal();
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  late final Dio _dio;
  late CookieJar _cookieJar;

  /// Call once in main() before any network requests.
  Future<void> init() async {
    _cookieJar = kIsWeb
        ? CookieJar()
        : await _buildPersistentCookieJar();

    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.apiBaseUrl,       // http://host/api/v1
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          // Compact header spec (Section 11 of implementation.md)
          'X-role': 'C',   // CUSTOMER → expanded by backend RoleHeaderMiddleware
          'X-Plt':  _platformCode(),
          'X-Ver':  const String.fromEnvironment('F2H_APP_VERSION', defaultValue: '1.0.0+1'),
        },
      ),
    );

    if (!kIsWeb) {
      _dio.interceptors.add(CookieManager(_cookieJar));
    }

    // Auth interceptor: inject token + silent refresh on 401
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError:   _onError,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // onRequest — inject Authorization + X-Csrf headers
  // ---------------------------------------------------------------------------
  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!options.path.startsWith('http')) {
      final activeBase = ApiEndpoints.apiBaseUrl;
      if (options.path.startsWith('/api/v1')) {
        options.path = '${ApiEndpoints.host}${options.path}';
      } else {
        final relPath = options.path.startsWith('/') ? options.path : '/${options.path}';
        options.path = '$activeBase$relPath';
      }
    }

    final token = await TokenStorage.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    } else {
      options.headers.remove('Authorization');
    }

    // 2. Inject compact CSRF header for mutations on native platforms
    if (!kIsWeb && options.method != 'GET') {
      try {
        final uri     = Uri.parse(ApiEndpoints.host);
        final cookies = await _cookieJar.loadForRequest(uri);
        final csrf    = cookies.firstWhere(
          (c) => c.name == 'csrf_token',
          orElse: () => Cookie('csrf_token', ''),
        );
        if (csrf.value.isNotEmpty) {
          options.headers['X-Csrf'] = csrf.value; // compact header name
        }
      } catch (_) {}
    }

    return handler.next(options);
  }

  // ---------------------------------------------------------------------------
  // onError — silent token refresh on 401; logout on refresh failure
  // ---------------------------------------------------------------------------
  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) return handler.next(err);

    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      // No refresh token — session truly expired
      await _handleSessionExpired();
      return handler.next(err);
    }

    try {
      // Attempt silent refresh — bypass this interceptor to avoid loop
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: ApiEndpoints.apiBaseUrl,
          headers: {'Content-Type': 'application/json'},
        ),
      );
      if (!kIsWeb) refreshDio.interceptors.add(CookieManager(_cookieJar));

      final refreshResp = await refreshDio.post(
        ApiEndpoints.refreshToken,
        data: {'refreshToken': refreshToken},
      );

      final newAccess  = refreshResp.data['accessToken']  as String?;
      final newRefresh = refreshResp.data['refreshToken'] as String?;

      if (newAccess == null || newAccess.isEmpty) throw Exception('Empty token');

      await TokenStorage.saveTokens(
        accessToken:  newAccess,
        refreshToken: newRefresh ?? refreshToken,
      );

      // Retry original request with new access token
      final retryOptions          = err.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newAccess';
      final retryResp = await _dio.fetch(retryOptions);
      return handler.resolve(retryResp);
    } catch (_) {
      // Refresh failed → wipe tokens and emit session-expired signal
      await _handleSessionExpired();
      return handler.next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Session expired: clear tokens.
  // The AuthBloc listens for 401 + empty SecureStorage on next boot to emit
  // AuthExpired state (see AppBootstrap.checkAuth).
  // ---------------------------------------------------------------------------
  Future<void> _handleSessionExpired() async {
    await TokenStorage.clear();
    await _cookieJar.deleteAll();
  }

  // ---------------------------------------------------------------------------
  // CSRF helper — call before public mutations (login, register, forgot-pw)
  // ---------------------------------------------------------------------------
  Future<void> fetchCsrfToken() async {
    try {
      await _dio.get(ApiEndpoints.csrfToken);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Explicit logout helper
  // ---------------------------------------------------------------------------
  Future<void> clearSession() async {
    await TokenStorage.clear();
    await _cookieJar.deleteAll();
  }

  void setAuthToken(String? token) {
    TokenStorage.setMemoryAccessToken(token);
  }

  Future<void> clearCookies() async {
    await clearSession();
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------
  Dio get dio => _dio;
  CookieJar get cookieJar => _cookieJar;

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  Future<PersistCookieJar> _buildPersistentCookieJar() async {
    final dir = await getApplicationDocumentsDirectory();
    final cookiePath = '${dir.path}/.f2h_cookies/';
    await Directory(cookiePath).create(recursive: true);
    return PersistCookieJar(
      storage: FileStorage(cookiePath),
      ignoreExpires: false,
    );
  }

  /// Compact 2-char platform code sent as X-Plt header.
  static String _platformCode() {
    if (kIsWeb) return 'wc';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'ic';
    return 'ac'; // android_customer
  }
}
