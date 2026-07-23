// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : token_storage.dart
// Description : Secure, persistent storage for Delivery app JWT tokens.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  TokenStorage._();

  static const FlutterSecureStorage _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _kAccessToken  = 'f2h_del_access_token';
  static const _kRefreshToken = 'f2h_del_refresh_token';
  static const _kUserId       = 'f2h_del_user_id';
  static const _kUserRole     = 'f2h_del_user_role';
  static const _kLastAuthAt   = 'f2h_del_last_auth_at';

  static String? _memAccessToken;
  static String? _memRefreshToken;

  static void setMemoryAccessToken(String? token) {
    _memAccessToken = token;
  }

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

  static Future<String?> getAccessToken()  async => _memAccessToken ?? await _store.read(key: _kAccessToken);
  static Future<String?> getRefreshToken() async => _memRefreshToken ?? await _store.read(key: _kRefreshToken);
  static Future<String?> getUserId()       async => _store.read(key: _kUserId);
  static Future<String?> getUserRole()     async => _store.read(key: _kUserRole);
  static Future<String?> getLastAuthAt()   async => _store.read(key: _kLastAuthAt);

  static Future<bool> hasSession() async {
    final rt = await getRefreshToken();
    return rt != null && rt.isNotEmpty;
  }

  static Future<void> updateAccessToken(String accessToken) async {
    await _store.write(key: _kAccessToken, value: accessToken);
  }

  static Future<void> clear() async {
    await Future.wait([
      _store.delete(key: _kAccessToken),
      _store.delete(key: _kRefreshToken),
      _store.delete(key: _kUserId),
      _store.delete(key: _kUserRole),
      _store.delete(key: _kLastAuthAt),
    ]);
  }
}
