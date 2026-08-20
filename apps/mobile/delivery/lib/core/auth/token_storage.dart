// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : token_storage.dart
// Description : Secure, persistent storage for Delivery app JWT tokens.
//               Uses SharedPreferences on Web and FlutterSecureStorage on native
//               with 1-second timeout fallbacks.
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TokenStorage {
  TokenStorage._();

  static const FlutterSecureStorage _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    webOptions: WebOptions(dbName: 'f2h_delivery', publicKey: 'f2h_del'),
  );

  static const _kAccessToken  = 'f2h_del_access_token';
  static const _kRefreshToken = 'f2h_del_refresh_token';
  static const _kUserId       = 'f2h_del_user_id';
  static const _kUserRole     = 'f2h_del_user_role';
  static const _kLastAuthAt   = 'f2h_del_last_auth_at';

  static String? _memAccessToken;
  static String? _memRefreshToken;

  static Future<String?> _readRaw(String key) async {
    if (kIsWeb) {
      try {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getString(key);
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

  static void setMemoryAccessToken(String? token) {
    _memAccessToken = token;
  }

  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String? userId,
    String? role,
  }) async {
    _memAccessToken  = accessToken;
    _memRefreshToken = refreshToken;
    await Future.wait([
      _writeRaw(_kAccessToken,  accessToken),
      _writeRaw(_kRefreshToken, refreshToken),
      _writeRaw(_kLastAuthAt,   DateTime.now().toIso8601String()),
      if (userId != null) _writeRaw(_kUserId,   userId),
      if (role   != null) _writeRaw(_kUserRole, role),
    ]);
  }

  static Future<String?> getAccessToken() async {
    if (_memAccessToken != null && _memAccessToken!.isNotEmpty) return _memAccessToken;
    final stored = await _readRaw(_kAccessToken);
    _memAccessToken = stored;
    return stored;
  }

  static Future<String?> getRefreshToken() async {
    if (_memRefreshToken != null && _memRefreshToken!.isNotEmpty) return _memRefreshToken;
    final stored = await _readRaw(_kRefreshToken);
    _memRefreshToken = stored;
    return stored;
  }

  static Future<String?> getUserId()       async => _readRaw(_kUserId);
  static Future<String?> getUserRole()     async => _readRaw(_kUserRole);
  static Future<String?> getLastAuthAt()   async => _readRaw(_kLastAuthAt);

  static Future<bool> hasSession() async {
    final rt = await getRefreshToken();
    return rt != null && rt.isNotEmpty;
  }

  static Future<void> updateAccessToken(String accessToken) async {
    _memAccessToken = accessToken;
    await _writeRaw(_kAccessToken, accessToken);
  }

  static Future<void> clear() async {
    _memAccessToken  = null;
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
