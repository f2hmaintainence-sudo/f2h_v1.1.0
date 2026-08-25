// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : auth_local_datasource.dart
// Description : Local user cache data source with Isar and memory fallbacks.
//
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:isar_db/isar_db.dart';
import 'package:f2h_customer/auth/data/models/user_model.dart';
import 'package:f2h_customer/core/cache/isar_service.dart';

abstract class AuthLocalDataSource {
  Future<void> cacheUser(UserModel userToCache);
  Future<UserModel?> getLastUser();
  Future<void> clearCache();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  final IsarService isarService;
  UserModel? _memoryUser;

  AuthLocalDataSourceImpl({required this.isarService});

  @override
  Future<void> cacheUser(UserModel userToCache) async {
    _memoryUser = userToCache;
    if (kIsWeb) return;

    try {
      final isar = await isarService.db;
      final safeUser = UserModel(
        userId: userToCache.userId,
        email: userToCache.email,
        mustChangePassword: userToCache.mustChangePassword,
        cachedAt: userToCache.cachedAt,
      );

      await isar.writeTxn(() async {
        await isar.userModels.clear();
        await isar.userModels.put(safeUser);
      });
    } catch (e) {
      debugPrint('[AuthLocalDataSource] Cache fallback to memory: $e');
    }
  }

  @override
  Future<UserModel?> getLastUser() async {
    if (kIsWeb) return _memoryUser;

    try {
      final isar = await isarService.db;
      final user = await isar.userModels.where().findFirst();
      if (user != null) _memoryUser = user;
      return _memoryUser ?? user;
    } catch (e) {
      debugPrint('[AuthLocalDataSource] Reading user fallback: $e');
      return _memoryUser;
    }
  }

  @override
  Future<void> clearCache() async {
    _memoryUser = null;
    if (kIsWeb) return;

    try {
      final isar = await isarService.db;
      await isar.writeTxn(() => isar.userModels.clear());
    } catch (e) {
      debugPrint('[AuthLocalDataSource] Clear cache fallback: $e');
    }
  }
}
