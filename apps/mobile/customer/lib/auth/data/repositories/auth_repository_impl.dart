// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : auth_repository_impl.dart
// Description : Auth repository implementation for customer app
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_customer/auth/data/datasources/auth_local_datasource.dart';

import 'package:f2h_customer/core/config/app_config.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  final DioClient dioClient;

  // Google Sign-In — reads serverClientId dynamically from AppConfig / API
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb ? AppConfig.googleServerClientId : null,
    scopes: <String>['email', 'https://www.googleapis.com/auth/userinfo.profile'],
    serverClientId: kIsWeb ? null : AppConfig.googleServerClientId,
  );

  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
    required this.dioClient,
  });

  @override
  Future<User> login(String identifier, String password, {String? fcmToken}) async {
    final userModel = await remoteDataSource.login(identifier, password, fcmToken: fcmToken);
    final access  = userModel.token;
    final refresh = userModel.refreshToken;
    if (access != null && access.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken:  access,
        refreshToken: refresh ?? '',
        userId: userModel.userId.toString(),
        role: 'C',
      );
    }
    await localDataSource.cacheUser(userModel);
    return userModel.toEntity();
  }

  @override
  Future<User> register(
    String userName,
    String email,
    String password, {
    required String phone,
    required String verificationToken,
    String? referralCode,
    String? fcmToken,
  }) async {
    final userModel = await remoteDataSource.register(
      userName, email, password,
      phone: phone,
      verificationToken: verificationToken,
      referralCode: referralCode,
      fcmToken: fcmToken,
    );
    final access  = userModel.token;
    final refresh = userModel.refreshToken;
    if (access != null && access.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken:  access,
        refreshToken: refresh ?? '',
        userId: userModel.userId.toString(),
        role: 'C',
      );
    }
    await localDataSource.cacheUser(userModel);
    return userModel.toEntity();
  }

  @override
  Future<void> sendRegistrationOtp(String email, {String? userName}) {
    return remoteDataSource.sendRegistrationOtp(email, userName: userName);
  }

  @override
  Future<String> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  }) {
    return remoteDataSource.verifyOtp(
      email: email,
      otp: otp,
      purpose: purpose,
    );
  }

  @override
  Future<void> requestPasswordResetOtp(String email) {
    return remoteDataSource.requestPasswordResetOtp(email);
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  }) {
    return remoteDataSource.resetPassword(
      email: email,
      token: token,
      newPassword: newPassword,
    );
  }

  @override
  Future<User> signInWithGoogle({String? fcmToken}) async {
    try {
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) throw 'Sign-in cancelled by user';

      final String? code = account.serverAuthCode;
      if (code == null || code.isEmpty) {
        throw 'Failed to retrieve authorization code from Google';
      }

      final userModel = await remoteDataSource.signInWithGoogle(code, fcmToken: fcmToken);
      final access  = userModel.token;
      final refresh = userModel.refreshToken;
      if (access != null && access.isNotEmpty) {
        await TokenStorage.saveTokens(
          accessToken:  access,
          refreshToken: refresh ?? '',
          userId: userModel.userId.toString(),
          role: 'C',
        );
      }
      await localDataSource.cacheUser(userModel);
      return userModel.toEntity();
    } catch (e) {
      throw e.toString();
    }
  }

  @override
  Future<void> logout() async {
    try {
      _googleSignIn.signOut().catchError((_) => null);
      remoteDataSource.logout().catchError((_) => null);
      await Future.wait([
        localDataSource.clearCache(),
        TokenStorage.clear(),          // wipes access + refresh + userId + role
        dioClient.clearSession(),      // wipes cookie jar
      ]);
    } catch (_) {
      // Ensure local state is always cleared even if remote call fails
      await TokenStorage.clear();
    }
  }

  @override
  Future<bool> checkAuthStatus() async {
    // Delegate to TokenStorage — the DioClient AuthInterceptor handles
    // silent token refresh on 401 automatically. AppBootstrap.checkAuth()
    // performs the deep cold-boot validation on first launch.
    return TokenStorage.hasSession();
  }

  @override
  Future<User?> getCachedUser() async {
    return (await localDataSource.getLastUser())?.toEntity();
  }
}
