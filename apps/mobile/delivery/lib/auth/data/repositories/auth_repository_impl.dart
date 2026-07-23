import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/auth/token_storage.dart';
import 'package:f2h_delivery/core/di/injection.dart';

import 'package:f2h_delivery/core/config/app_config.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb ? AppConfig.googleServerClientId : null,
    scopes: <String>[
      'email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    serverClientId: kIsWeb ? null : AppConfig.googleServerClientId,
  );

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
  Future<User> register(String name, String email, String password, {String? branchId, double? latitude, double? longitude}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove('cached_profile'),
        prefs.remove('cached_documents'),
        prefs.remove('cached_vehicles'),
        prefs.remove('cached_bank_accounts'),
      ]);
    } catch (_) {}

    final user = await remoteDataSource.register(name, email, password, branchId: branchId, latitude: latitude, longitude: longitude);
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
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      
      if (account == null) {
        throw 'Sign-in cancelled by user';
      }

      final String? code = account.serverAuthCode;
      
      if (code == null || code.isEmpty) {
        throw 'Failed to retrieve authorization code from Google';
      }

      try {
        final prefs = await SharedPreferences.getInstance();
        await Future.wait([
          prefs.remove('cached_profile'),
          prefs.remove('cached_documents'),
          prefs.remove('cached_vehicles'),
          prefs.remove('cached_bank_accounts'),
        ]);
      } catch (_) {}

      final user = await remoteDataSource.signInWithGoogle(code);
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
    } catch (e) {
      throw e.toString();
    }
  }

  @override
  Future<void> logout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Future.wait([
        prefs.remove('cached_profile'),
        prefs.remove('cached_documents'),
        prefs.remove('cached_vehicles'),
        prefs.remove('cached_bank_accounts'),
        _googleSignIn.signOut(),
        remoteDataSource.logout(),
        localDataSource.clearCache(),
        TokenStorage.clear(),
      ]);
      try {
        await sl<DioClient>().cookieJar.deleteAll();
      } catch (_) {}
    } catch (_) {
      await TokenStorage.clear();
    }
  }

  @override
  Future<User?> checkAuthStatus() async {
    return await localDataSource.getCachedUser();
  }
}
