// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play_integrity_service.dart
// Description : Dart face of the official Google Play Integrity API.
//
//               Talks to PlayIntegrityPlugin.kt over a MethodChannel. The
//               native side uses the Standard request flow, so this service
//               warms up a token provider once and then mints one short-lived
//               token per protected request.
//
//               Design rules this file exists to enforce:
//                 - A token is requested ONLY for sensitive operations. The
//                   catalog, home, address and every other read stays free of
//                   Integrity traffic (see integrity_protected_routes.dart).
//                 - The only thing cached is the native token PROVIDER, for
//                   the ~1 hour Google allows. Tokens are never reused: each
//                   one is bound to one request's method, path and nonce.
//                 - Nothing here ever throws. A device with no Play Store, an
//                   emulator, a debug build, a web build or an outage all end
//                   the same way: no token, a reason code, and the request
//                   still goes out. Blocking a real customer because Google
//                   was briefly unreachable would be worse than the risk.
//                 - No credential of any kind lives in this app. The Cloud
//                   project NUMBER is public; only the F2H API server holds
//                   the service account that can decrypt a token.
// ============================================================================

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// A token and the nonce it was minted against. Both go on the wire; the API
/// recomputes the request hash from the nonce and refuses a mismatch.
@immutable
class IntegrityCredentials {
  const IntegrityCredentials({required this.token, required this.nonce});

  final String token;
  final String nonce;
}

/// Why no token could be produced. Sent to the API as a short advisory header
/// for logging only. The server never treats it as permission to skip a check.
class IntegrityUnavailableReason {
  static const String unsupportedPlatform = 'unsupported_platform';
  static const String notConfigured = 'not_configured';
  static const String disabled = 'disabled';
  static const String playUnavailable = 'play_unavailable';
  static const String requestFailed = 'request_failed';
  static const String channelMissing = 'channel_missing';
}

class PlayIntegrityService {
  PlayIntegrityService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(channelName);

  /// Must match PlayIntegrityPlugin.CHANNEL on the Android side.
  static const String channelName = 'com.f2h.security/play_integrity';

  /// Google Cloud project NUMBER linked to Play Integrity. Public value,
  /// supplied at build time:
  ///   --dart-define=F2H_CLOUD_PROJECT_NUMBER=842214638527
  static const String _cloudProjectNumber =
      String.fromEnvironment('F2H_CLOUD_PROJECT_NUMBER', defaultValue: '');

  /// Escape hatch for development:
  ///   --dart-define=F2H_PLAY_INTEGRITY_DISABLED=true
  static const bool _forceDisabled =
      bool.fromEnvironment('F2H_PLAY_INTEGRITY_DISABLED', defaultValue: false);

  final MethodChannel _channel;

  Future<bool>? _warmUpInFlight;
  bool _warm = false;
  String? _lastUnavailableReason;

  /// Only Android can produce a Play Integrity token. Web and iOS builds skip
  /// the whole path rather than failing on every protected call.
  bool get isSupported {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.android;
  }

  bool get isConfigured => _cloudProjectNumber.trim().isNotEmpty;

  bool get isEnabled => isSupported && isConfigured && !_forceDisabled;

  bool get isWarm => _warm;

  String? get lastUnavailableReason => _lastUnavailableReason;

  // ──────────────────────────────────────────────────────────────────────────
  //  Warm-up
  // ──────────────────────────────────────────────────────────────────────────

  /// Prepares the native token provider. Safe to call from app start and safe
  /// to call again; concurrent callers share one in-flight future.
  ///
  /// Never awaited on the startup path: a slow Play Services handshake must
  /// not delay first frame.
  Future<bool> warmUp() {
    if (!isEnabled) {
      _lastUnavailableReason = _disabledReason();
      return Future.value(false);
    }
    return _warmUpInFlight ??= _performWarmUp().whenComplete(() {
      _warmUpInFlight = null;
    });
  }

  Future<bool> _performWarmUp() async {
    try {
      final ok = await _channel.invokeMethod<bool>('warmUp', {
        'cloudProjectNumber': _cloudProjectNumber.trim(),
      });
      _warm = ok ?? false;
      if (_warm) _lastUnavailableReason = null;
      return _warm;
    } on MissingPluginException {
      _warm = false;
      _lastUnavailableReason = IntegrityUnavailableReason.channelMissing;
      return false;
    } on PlatformException catch (error) {
      _warm = false;
      _lastUnavailableReason = IntegrityUnavailableReason.playUnavailable;
      _log('warm-up failed: ${error.code}');
      return false;
    } catch (error) {
      _warm = false;
      _lastUnavailableReason = IntegrityUnavailableReason.playUnavailable;
      _log('warm-up failed: $error');
      return false;
    }
  }

  /// Forgets the prepared provider so the next request re-warms. Called when
  /// the API rejects a token, since a stale provider is the likeliest cause.
  void invalidate() {
    _warm = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Per-request token
  // ──────────────────────────────────────────────────────────────────────────

  /// Mints one token for exactly this request. Returns null, never throws,
  /// when the device cannot produce one.
  ///
  /// [path] must be the API path without the query string, for example
  /// /api/v1/customer/wallet/topup, so the hash matches what the server
  /// recomputes from its own view of the route.
  Future<IntegrityCredentials?> credentialsFor({
    required String method,
    required String path,
  }) async {
    if (!isEnabled) {
      _lastUnavailableReason = _disabledReason();
      return null;
    }

    if (!_warm) {
      final warmed = await warmUp();
      if (!warmed) return null;
    }

    final nonce = generateNonce();
    final requestHash =
        buildRequestHash(method: method, path: path, nonce: nonce);

    final token = await _requestToken(requestHash, allowRewarm: true);
    if (token == null || token.isEmpty) return null;

    _lastUnavailableReason = null;
    return IntegrityCredentials(token: token, nonce: nonce);
  }

  Future<String?> _requestToken(
    String requestHash, {
    required bool allowRewarm,
  }) async {
    try {
      return await _channel.invokeMethod<String>('requestToken', {
        'requestHash': requestHash,
      });
    } on MissingPluginException {
      _lastUnavailableReason = IntegrityUnavailableReason.channelMissing;
      return null;
    } on PlatformException catch (error) {
      // The provider expired between the last warm-up and now. Re-prepare once
      // and retry. A single retry only, so a persistently broken device does
      // not spin.
      if (error.code == 'PLAY_INTEGRITY_NOT_WARMED' && allowRewarm) {
        _warm = false;
        final warmed = await warmUp();
        if (warmed) {
          return _requestToken(requestHash, allowRewarm: false);
        }
        return null;
      }
      _lastUnavailableReason = error.code == 'PLAY_INTEGRITY_UNAVAILABLE'
          ? IntegrityUnavailableReason.playUnavailable
          : IntegrityUnavailableReason.requestFailed;
      _log('token request failed: ${error.code}');
      return null;
    } catch (error) {
      _lastUnavailableReason = IntegrityUnavailableReason.requestFailed;
      _log('token request failed: $error');
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Canonical request hash. Must stay identical to
  //  PlayIntegrityService.buildRequestHash() on the NestJS side.
  // ──────────────────────────────────────────────────────────────────────────

  static String buildRequestHash({
    required String method,
    required String path,
    required String nonce,
  }) {
    final canonical = '${method.toUpperCase()}|$path|$nonce';
    return sha256.convert(utf8.encode(canonical)).toString();
  }

  /// 128 bits of cryptographic randomness, base64url without padding: well
  /// inside the 500-byte request-hash budget once folded into the SHA-256.
  static String generateNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '');
  }

  String _disabledReason() {
    if (!isSupported) return IntegrityUnavailableReason.unsupportedPlatform;
    if (!isConfigured) return IntegrityUnavailableReason.notConfigured;
    return IntegrityUnavailableReason.disabled;
  }

  /// Debug-only. A token or nonce is never logged.
  void _log(String message) {
    if (kDebugMode) debugPrint('[PlayIntegrity] $message');
  }
}
