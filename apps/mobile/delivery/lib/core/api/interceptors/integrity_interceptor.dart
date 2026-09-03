// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : integrity_interceptor.dart
// Description : Attaches a Google Play Integrity token to the small set of
//               requests that need one.
//
//               Added to the existing DioClient interceptor chain AFTER the
//               auth/CSRF wrapper, so by the time it runs `options.path` is
//               already the absolute URL and the Authorization header is set.
//               It reuses that client rather than introducing a second one.
//
//               Failure policy, in order of preference:
//                 1. Token obtained  -> send it.
//                 2. No token (no Play Store, emulator, debug build, outage)
//                    -> send the request anyway with a short advisory header.
//                    The API decides; in monitor mode or with the feature off
//                    the customer is never blocked by a transient failure.
//                 3. API rejects with APP_INTEGRITY_REQUIRED -> drop the
//                    cached provider, re-warm, retry ONCE with a fresh token.
//                    A second rejection is surfaced to the caller.
// ============================================================================

import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/security/integrity_protected_routes.dart';
import 'package:f2h_delivery/core/security/play_integrity_service.dart';

class IntegrityInterceptor extends Interceptor {
  IntegrityInterceptor({
    required PlayIntegrityService service,
    required Dio Function() dioProvider,
  })  : _service = service,
        _dioProvider = dioProvider;

  /// Header names mirror play-integrity.constants.ts on the API.
  static const String tokenHeader = 'X-Integrity-Token';
  static const String nonceHeader = 'X-Integrity-Nonce';
  static const String unavailableHeader = 'X-Integrity-Unavailable';

  /// Error code the API returns when a protected route refuses a request.
  static const String integrityErrorCode = 'APP_INTEGRITY_REQUIRED';

  /// Marks a request that has already been retried, so a persistent rejection
  /// surfaces to the caller instead of looping.
  static const String _retriedFlag = 'f2h_integrity_retried';

  final PlayIntegrityService _service;
  final Dio Function() _dioProvider;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final path = _apiPath(options);
    if (!IntegrityProtectedRoutes.requiresIntegrity(options.method, path)) {
      // The overwhelming majority of traffic lands here and pays nothing.
      return handler.next(options);
    }

    await _attachCredentials(options, path);
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final path = _apiPath(options);

    final isIntegrityRejection = err.response?.statusCode == 403 &&
        _errorCodeOf(err.response?.data) == integrityErrorCode;

    if (!isIntegrityRejection ||
        options.extra[_retriedFlag] == true ||
        !IntegrityProtectedRoutes.requiresIntegrity(options.method, path)) {
      return handler.next(err);
    }

    // A stale provider is the likeliest cause, so throw it away before retrying.
    // No token is minted here: dio.fetch re-runs onRequest, which attaches a
    // fresh one. Minting here too would burn a token and a Play quota slot.
    _service.invalidate();
    options.extra[_retriedFlag] = true;

    try {
      final response = await _dioProvider().fetch(options);
      return handler.resolve(response);
    } on DioException catch (retryError) {
      return handler.next(retryError);
    } catch (_) {
      return handler.next(err);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  Future<void> _attachCredentials(RequestOptions options, String path) async {
    final credentials = await _service.credentialsFor(
      method: options.method,
      path: path,
    );

    if (credentials != null) {
      options.headers[tokenHeader] = credentials.token;
      options.headers[nonceHeader] = credentials.nonce;
      options.headers.remove(unavailableHeader);
      return;
    }

    // Advisory only. The server logs it and applies its own policy; it is
    // never accepted as a reason to skip verification.
    options.headers.remove(tokenHeader);
    options.headers.remove(nonceHeader);
    options.headers[unavailableHeader] =
        _service.lastUnavailableReason ?? IntegrityUnavailableReason.requestFailed;
  }

  /// The API path with no scheme, host or query string, matching what the
  /// server hashes: /api/v1/customer/wallet/topup
  static String _apiPath(RequestOptions options) {
    final raw = options.path;
    if (raw.startsWith('http')) {
      return Uri.parse(raw).path;
    }
    final cut = raw.indexOf('?');
    return cut == -1 ? raw : raw.substring(0, cut);
  }

  static String? _errorCodeOf(dynamic data) {
    if (data is Map) {
      final code = data['code'];
      if (code is String) return code;
    }
    return null;
  }
}
