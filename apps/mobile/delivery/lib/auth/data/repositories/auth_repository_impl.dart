import 'package:f2h_delivery/core/auth/google_auth_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/auth/token_storage.dart';
import 'package:f2h_delivery/core/di/injection.dart';


class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  
  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
  });

  @override
  Future<User> login(String identifier, String password) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove('cached_profile'),
        prefs.remove('cached_documents'),
        prefs.remove('cached_vehicles'),
        prefs.remove('cached_bank_accounts'),
      ]);
    } catch (_) {}

    final user = await remoteDataSource.login(identifier, password);
    if (user.token != null && user.token!.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken: user.token!,
        refreshToken: user.refreshToken ?? '',
        userId: user.userId,
        role: 'D',
      );
    }
    await localDataSource.cacheUser(user);
    return user;
  }

  @override
  Future<User> register(
    String name,
    String email,
    String password, {
    String? phone,
    String? branchId,
    double? latitude,
    double? longitude,
    String? verificationToken,
    String? referralCode,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove('cached_profile'),
        prefs.remove('cached_documents'),
        prefs.remove('cached_vehicles'),
        prefs.remove('cached_bank_accounts'),
      ]);
    } catch (_) {}

    final user = await remoteDataSource.register(
      name,
      email,
      password,
      phone: phone,
      branchId: branchId,
      latitude: latitude,
      longitude: longitude,
      verificationToken: verificationToken,
      referralCode: referralCode,
    );
    if (user.token != null && user.token!.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken: user.token!,
        refreshToken: user.refreshToken ?? '',
        userId: user.userId,
        role: 'D',
      );
    }
    await localDataSource.cacheUser(user);
    return user;
  }

  @override
  Future<User> signInWithGoogle() async {
    try {
      final credential = await signInWithGoogleAccount();

      try {
        final prefs = await SharedPreferences.getInstance();
        await Future.wait([
          prefs.remove('cached_profile'),
          prefs.remove('cached_documents'),
          prefs.remove('cached_vehicles'),
          prefs.remove('cached_bank_accounts'),
        ]);
      } catch (_) {}

      final user = await remoteDataSource.signInWithGoogle(
        idToken: credential.idToken,
        serverAuthCode: credential.serverAuthCode,
      );
      if (user.token != null && user.token!.isNotEmpty) {
        await TokenStorage.saveTokens(
          accessToken: user.token!,
          refreshToken: user.refreshToken ?? '',
          userId: user.userId,
          role: 'D',
        );
      }
      await localDataSource.cacheUser(user);
      return user;
    } on GoogleSignInCancelled {
      rethrow;
    } catch (e) {
      throw e.toString();
    }
  }

  @override
  Future<void> logout() async {
    try {
      try {
        await remoteDataSource.logout();
      } catch (_) {}

      try {
        await signOutGoogleAccount();
      } catch (_) {}

      try {
        await sl<DioClient>().cookieJar.deleteAll();
      } catch (_) {}
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove('cached_profile'),
        prefs.remove('cached_documents'),
        prefs.remove('cached_vehicles'),
        prefs.remove('cached_bank_accounts'),
        localDataSource.clearCache(),
        TokenStorage.clear(),
      ]);
    } catch (_) {
      await TokenStorage.clear();
    }
  }

  @override
  Future<User?> checkAuthStatus() async {
    final user = await localDataSource.getCachedUser();
    if (user == null || user.token == null || user.token!.isEmpty) {
      return null;
    }
    return user;
  }
}
