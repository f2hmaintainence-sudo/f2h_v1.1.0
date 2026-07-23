import 'package:flutter/foundation.dart';
import 'package:isar/isar.dart';
import 'package:f2h_delivery/auth/data/models/user_model.dart';
import 'package:f2h_delivery/auth/data/models/auth_local_model.dart';

abstract class AuthLocalDataSource {
  Future<void> cacheUser(UserModel user);
  Future<UserModel?> getCachedUser();
  Future<void> clearCache();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  final Isar? isar;
  UserModel? _memoryUser;

  AuthLocalDataSourceImpl({required this.isar});

  @override
  Future<void> cacheUser(UserModel user) async {
    _memoryUser = user;
    if (kIsWeb || isar == null) return;

    try {
      final localModel = AuthLocalModel()
        ..userId = user.userId
        ..email = user.email
        ..mustChangePassword = user.mustChangePassword
        ..token = user.token
        ..cachedAt = DateTime.now();

      await isar!.writeTxn(() async {
        await isar!.authLocalModels.clear();
        await isar!.authLocalModels.put(localModel);
      });
    } catch (e) {
      debugPrint('[AuthLocalDataSourceImpl] Cache fallback to memory: $e');
    }
  }

  @override
  Future<UserModel?> getCachedUser() async {
    if (kIsWeb || isar == null) return _memoryUser;

    try {
      final localModel = await isar!.authLocalModels.where().findFirst();
      if (localModel != null && localModel.cachedAt != null) {
        const ttl = Duration(days: 7);
        final expiryTime = localModel.cachedAt!.add(ttl);
        
        if (DateTime.now().isBefore(expiryTime)) {
          final user = UserModel(
            userId: localModel.userId,
            email: localModel.email,
            mustChangePassword: localModel.mustChangePassword,
            token: localModel.token,
          );
          _memoryUser = user;
          return user;
        } else {
          await clearCache();
        }
      }
      return _memoryUser;
    } catch (e) {
      debugPrint('[AuthLocalDataSourceImpl] Reading user fallback: $e');
      return _memoryUser;
    }
  }

  @override
  Future<void> clearCache() async {
    _memoryUser = null;
    if (kIsWeb || isar == null) return;

    try {
      await isar!.writeTxn(() async {
        await isar!.authLocalModels.clear();
      });
    } catch (e) {
      debugPrint('[AuthLocalDataSourceImpl] Clear cache fallback: $e');
    }
  }
}
