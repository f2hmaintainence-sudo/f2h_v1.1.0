// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : token_storage.dart
// Description : Secure, persistent storage for JWT access/refresh tokens and
//               user identity. Uses SharedPreferences on Web and FlutterSecureStorage
//               on native platforms with 1-second timeout fallbacks.
//
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Manages persistent JWT token storage with a "never logout" guarantee.
class TokenStorage {
  TokenStorage._();

  static const FlutterSecureStorage _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    webOptions: WebOptions(dbName: 'f2h_customer', publicKey: 'f2h_cust'),
  );

  static const _kAccessToken  = 'f2h_access_token';
  static const _kRefreshToken = 'f2h_refresh_token';
  static const _kUserId       = 'f2h_user_id';
  static const _kUserRole     = 'f2h_user_role';
  static const _kLastAuthAt   = 'f2h_last_auth_at';

  static String? _memAccessToken;
  static String? _memRefreshToken;

  static Future<String?> _readRaw(String key) async {
    if (kIsWeb) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final val = prefs.getString(key);
        if (val != null && val.trim().isNotEmpty) return val.trim();
        if (key == _kAccessToken) {
          final fallback = prefs.getString('access_token') ??
              prefs.getString('accessToken') ??
              prefs.getString('token') ??
              prefs.getString('jwt');
          if (fallback != null && fallback.trim().isNotEmpty) return fallback.trim();
        }
        if (key == _kRefreshToken) {
          final fallback = prefs.getString('refresh_token') ??
              prefs.getString('refreshToken');
          if (fallback != null && fallback.trim().isNotEmpty) return fallback.trim();
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    try {
      return await _store.read(key: key).timeout(
        const Duration(seconds: 1),
        onTimeout: () => null,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> _writeRaw(String key, String value) async {
    if (kIsWeb) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(key, value);
      } catch (_) {}
      return;
    }
    try {
      await _store.write(key: key, value: value).timeout(
        const Duration(seconds: 1),
      );
    } catch (_) {}
  }

  static Future<void> _deleteRaw(String key) async {
    if (kIsWeb) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(key);
      } catch (_) {}
      return;
    }
    try {
      await _store.delete(key: key).timeout(
        const Duration(seconds: 1),
      );
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Persist tokens after a successful login / register / refresh
  // ---------------------------------------------------------------------------
  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String? userId,
    String? role,
  }) async {
    _memAccessToken = accessToken;
    _memRefreshToken = refreshToken;
    await Future.wait([
      _writeRaw(_kAccessToken,  accessToken),
      _writeRaw(_kRefreshToken, refreshToken),
      _writeRaw(_kLastAuthAt,   DateTime.now().toIso8601String()),
      if (userId != null) _writeRaw(_kUserId,   userId),
      if (role   != null) _writeRaw(_kUserRole, role),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Read stored values
  // ---------------------------------------------------------------------------
  static Future<String?> getAccessToken() async {
    if (_memAccessToken != null && _memAccessToken!.isNotEmpty) {
      return _memAccessToken;
    }
    _memAccessToken = await _readRaw(_kAccessToken);
    return _memAccessToken;
  }

  static Future<String?> getRefreshToken() async {
    if (_memRefreshToken != null && _memRefreshToken!.isNotEmpty) {
      return _memRefreshToken;
    }
    _memRefreshToken = await _readRaw(_kRefreshToken);
    return _memRefreshToken;
  }

  static Future<String?> getUserId()       async => _readRaw(_kUserId);
  static Future<String?> getUserRole()     async => _readRaw(_kUserRole);
  static Future<String?> getLastAuthAt()   async => _readRaw(_kLastAuthAt);

  /// True if an access token or refresh token exists (i.e., user is authenticated).
  static Future<bool> hasSession() async {
    final at = await getAccessToken();
    if (at != null && at.trim().isNotEmpty) return true;
    final rt = await getRefreshToken();
    if (rt != null && rt.trim().isNotEmpty) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // Update only the access token after a silent refresh
  // ---------------------------------------------------------------------------
  static Future<void> updateAccessToken(String accessToken) async {
    _memAccessToken = accessToken;
    await _writeRaw(_kAccessToken, accessToken);
  }

  static void setMemoryAccessToken(String? token) {
    _memAccessToken = token;
  }

  // ---------------------------------------------------------------------------
  // Wipe everything on explicit logout or when refresh token is rejected.
  // ---------------------------------------------------------------------------
  static Future<void> clear() async {
    _memAccessToken = null;
    _memRefreshToken = null;
    await Future.wait([
      _deleteRaw(_kAccessToken),
      _deleteRaw(_kRefreshToken),
      _deleteRaw(_kUserId),
      _deleteRaw(_kUserRole),
      _deleteRaw(_kLastAuthAt),
    ]);
  }
}
