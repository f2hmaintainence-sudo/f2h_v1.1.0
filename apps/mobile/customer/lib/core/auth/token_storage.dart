// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : token_storage.dart
// Description : Secure, persistent storage for JWT access/refresh tokens and
//               user identity. Uses FlutterSecureStorage (AES-256 on Android,
//               Keychain on iOS). Never stores tokens in SharedPreferences or
//               plain Isar fields. Tokens survive app restarts (never logout
//               unless user explicitly logs out or refresh token expires).
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Manages persistent JWT token storage with a "never logout" guarantee.
/// The app reads stored tokens on cold boot and silently re-validates them
/// via /api/v1/auth/session-info before showing any authenticated screen.
class TokenStorage {
  TokenStorage._();

  static const FlutterSecureStorage _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Storage key constants — all prefixed with 'f2h_' to avoid collisions.
  static const _kAccessToken  = 'f2h_access_token';
  static const _kRefreshToken = 'f2h_refresh_token';
  static const _kUserId       = 'f2h_user_id';
  static const _kUserRole     = 'f2h_user_role';
  static const _kLastAuthAt   = 'f2h_last_auth_at';

  static String? _memAccessToken;
  static String? _memRefreshToken;

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
      _store.write(key: _kAccessToken,  value: accessToken),
      _store.write(key: _kRefreshToken, value: refreshToken),
      _store.write(key: _kLastAuthAt,   value: DateTime.now().toIso8601String()),
      if (userId != null) _store.write(key: _kUserId,   value: userId),
      if (role   != null) _store.write(key: _kUserRole, value: role),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Read stored values
  // ---------------------------------------------------------------------------
  static Future<String?> getAccessToken() async {
    if (_memAccessToken != null && _memAccessToken!.isNotEmpty) {
      return _memAccessToken;
    }
    _memAccessToken = await _store.read(key: _kAccessToken);
    return _memAccessToken;
  }

  static Future<String?> getRefreshToken() async {
    if (_memRefreshToken != null && _memRefreshToken!.isNotEmpty) {
      return _memRefreshToken;
    }
    _memRefreshToken = await _store.read(key: _kRefreshToken);
    return _memRefreshToken;
  }

  static Future<String?> getUserId()       async => _store.read(key: _kUserId);
  static Future<String?> getUserRole()     async => _store.read(key: _kUserRole);
  static Future<String?> getLastAuthAt()   async => _store.read(key: _kLastAuthAt);

  /// True if a refresh token exists (i.e., user has ever logged in).
  static Future<bool> hasSession() async {
    final rt = await getRefreshToken();
    return rt != null && rt.isNotEmpty;
  }

  // ---------------------------------------------------------------------------
  // Update only the access token after a silent refresh
  // ---------------------------------------------------------------------------
  static Future<void> updateAccessToken(String accessToken) async {
    _memAccessToken = accessToken;
    await _store.write(key: _kAccessToken, value: accessToken);
  }

  static void setMemoryAccessToken(String? token) {
    _memAccessToken = token;
  }

  // ---------------------------------------------------------------------------
  // Wipe everything on explicit logout or when refresh token is rejected.
  // This is the ONLY path that logs the user out.
  // ---------------------------------------------------------------------------
  static Future<void> clear() async {
    _memAccessToken = null;
    _memRefreshToken = null;
    await Future.wait([
      _store.delete(key: _kAccessToken),
      _store.delete(key: _kRefreshToken),
      _store.delete(key: _kUserId),
      _store.delete(key: _kUserRole),
      _store.delete(key: _kLastAuthAt),
    ]);
  }
}
