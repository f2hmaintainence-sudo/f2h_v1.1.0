// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : dio_client.dart
// Description : Configured Dio HTTP client for F2H Delivery App.
//               - Base URL: /api/v1/ (URI-versioned)
//               - Compact headers: X-Role:D, X-Plt:<code>, X-Ver:<semver>
//               - AuthInterceptor: auto-injects Bearer token + silently
//                 refreshes expired access tokens using the refresh token.
//
// ============================================================================

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/auth/token_storage.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';

class DioClient {
  DioClient._internal();
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  late final Dio _dio;
  late CookieJar _cookieJar;

  Future<void> init() async {
    _cookieJar = kIsWeb
        ? CookieJar()
        : await _buildPersistentCookieJar();

    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          'X-role': 'D',   // DELIVERY_BOY → expanded by backend RoleHeaderMiddleware
          'X-Plt':  _platformCode(),
          'X-Ver':  const String.fromEnvironment('F2H_APP_VERSION', defaultValue: '1.0.0+1'),
        },
      ),
    );

    if (!kIsWeb) {
      _dio.interceptors.add(CookieManager(_cookieJar));
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError:   _onError,
      ),
    );
  }

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

    if (!kIsWeb && options.method != 'GET') {
      try {
        final uri     = Uri.parse(ApiEndpoints.host);
        final cookies = await _cookieJar.loadForRequest(uri);
        final csrf    = cookies.firstWhere(
          (c) => c.name == 'csrf_token',
          orElse: () => Cookie('csrf_token', ''),
        );
        if (csrf.value.isNotEmpty) {
          options.headers['X-Csrf'] = csrf.value;
        }
      } catch (_) {}
    }

    return handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) return handler.next(err);

    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      try {
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

        if (newAccess != null && newAccess.isNotEmpty) {
          await TokenStorage.saveTokens(
            accessToken:  newAccess,
            refreshToken: newRefresh ?? refreshToken,
          );

          final retryOptions = err.requestOptions;
          retryOptions.headers['Authorization'] = 'Bearer $newAccess';
          final retryResp = await _dio.fetch(retryOptions);
          return handler.resolve(retryResp);
        }
      } catch (_) {}
    }

    // Do NOT wipe tokens on error - account must NEVER auto-logout
    return handler.next(err);
  }

  Future<void> _handleSessionExpired() async {
    // Preserved for explicit logout flow only
  }

  Future<void> fetchCsrfToken() async {
    try {
      await _dio.get(ApiEndpoints.csrfToken);
    } catch (_) {}
  }

  Future<void> clearSession() async {
    await TokenStorage.clear();
    await _cookieJar.deleteAll();
  }

  void setAuthToken(String? token) {
    TokenStorage.setMemoryAccessToken(token);
    if (token != null) {
      _dio.options.headers['Authorization'] = 'Bearer $token';
    } else {
      _dio.options.headers.remove('Authorization');
    }
  }

  Future<void> clearCookies() async {
    await clearSession();
  }

  Dio get dio => _dio;
  CookieJar get cookieJar => _cookieJar;

  Future<PersistCookieJar> _buildPersistentCookieJar() async {
    final dir = await getApplicationDocumentsDirectory();
    final cookiePath = '${dir.path}/.f2h_del_cookies/';
    await Directory(cookiePath).create(recursive: true);
    return PersistCookieJar(
      storage: FileStorage(cookiePath),
      ignoreExpires: false,
    );
  }

  static String _platformCode() {
    if (kIsWeb) return 'wd';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'id';
    return 'ad'; // android_delivery
  }
}
