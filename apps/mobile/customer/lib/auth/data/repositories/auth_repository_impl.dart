// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : auth_repository_impl.dart
// Description : Auth repository implementation for customer app
//
// ============================================================================
import 'package:dio/dio.dart';
import 'package:f2h_customer/core/auth/google_auth_client.dart';
import 'package:f2h_customer/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_customer/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  final DioClient dioClient;

  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
    required this.dioClient,
  });

  @override
  Future<User> login(
    String identifier,
    String password, {
    String? fcmToken,
  }) async {
    final userModel = await remoteDataSource.login(
      identifier,
      password,
      fcmToken: fcmToken,
    );
    final access = userModel.token;
    final refresh = userModel.refreshToken;
    if (access != null && access.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken: access,
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
      userName,
      email,
      password,
      phone: phone,
      verificationToken: verificationToken,
      referralCode: referralCode,
      fcmToken: fcmToken,
    );
    final access = userModel.token;
    final refresh = userModel.refreshToken;
    if (access != null && access.isNotEmpty) {
      await TokenStorage.saveTokens(
        accessToken: access,
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
    return remoteDataSource.verifyOtp(email: email, otp: otp, purpose: purpose);
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
      final credential = await signInWithGoogleAccount();

      final userModel = await remoteDataSource.signInWithGoogle(
        idToken: credential.idToken,
        serverAuthCode: credential.serverAuthCode,
        fcmToken: fcmToken,
      );
      final access = userModel.token;
      final refresh = userModel.refreshToken;
      if (access != null && access.isNotEmpty) {
        await TokenStorage.saveTokens(
          accessToken: access,
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
      signOutGoogleAccount().catchError((_) => null);
      remoteDataSource.logout().catchError((_) => null);
      await Future.wait([
        localDataSource.clearCache(),
        TokenStorage.clear(), // wipes access + refresh + userId + role
        dioClient.clearSession(), // wipes cookie jar
      ]);
    } catch (_) {
      // Ensure local state is always cleared even if remote call fails
      await TokenStorage.clear();
    }
  }

  @override
  Future<bool> checkAuthStatus() async {
    // Call /customer/bootstrap — if it returns 200 the user is authenticated.
    // 401 means the session/token is invalid → show Login screen.
    try {
      await dioClient.dio.get(ApiEndpoints.customerBootstrap);
      return true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return false;
      // Network error / server down — treat as authenticated (offline mode)
      // so the user is not logged out just because of a connectivity issue.
      return await TokenStorage.hasSession();
    } catch (_) {
      return await TokenStorage.hasSession();
    }
  }

  @override
  Future<User?> getCachedUser() async {
    return (await localDataSource.getLastUser())?.toEntity();
  }
}
