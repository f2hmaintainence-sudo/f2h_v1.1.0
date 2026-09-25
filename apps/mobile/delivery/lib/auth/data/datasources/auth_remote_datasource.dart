import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/auth/data/models/user_model.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';

abstract class AuthRemoteDataSource {
  Future<void> sendLoginOtp(String phone);
  Future<UserModel> loginWithOtp({
    required String phone,
    required String otp,
    String? referralCode,
  });

  /// Exchanges a Google credential for an F2H session.
  ///
  /// Both fields are forwarded because platforms differ in what they can
  /// produce; the API verifies whichever one it receives.
  Future<UserModel> signInWithGoogle({String? idToken, String? serverAuthCode});

  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient dioClient;

  AuthRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<void> sendLoginOtp(String phone) async {
    await dioClient.fetchCsrfToken();
    try {
      await dioClient.dio.post(
        ApiEndpoints.sendOtp,
        data: {
          'phone': phone,
          'purpose': 'login',
        },
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to send login OTP');
    }
  }

  @override
  Future<UserModel> loginWithOtp({
    required String phone,
    required String otp,
    String? referralCode,
  }) async {
    await dioClient.fetchCsrfToken();
    final fcmToken = await _getFcmToken();
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.loginWithOtp,
        data: {
          'phone': phone,
          'otp': otp,
          'role': 'DELIVERY_PARTNER',
          if (fcmToken != null && fcmToken.isNotEmpty) 'fcm_token': fcmToken,
          if (referralCode != null && referralCode.isNotEmpty)
            'referral_code': referralCode,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final rawUser = response.data['user'] ?? response.data ?? {};
        final userData = Map<String, dynamic>.from(rawUser as Map);
        userData['accessToken'] = response.data['accessToken'] ?? response.data['token'];
        userData['refreshToken'] = response.data['refreshToken'];
        userData['is_new_user'] = response.data['is_new_user'] ?? false;
        dioClient.setAuthToken(response.data['accessToken']?.toString() ?? response.data['token']?.toString());
        return UserModel.fromJson(userData);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'OTP Login failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Failed to log in with OTP');
    }
  }

  String _extractError(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message is List) {
        return message.map((item) => item.toString()).join('\n');
      }
      if (message != null && message.toString().trim().isNotEmpty) {
        return message.toString();
      }
      final error = data['error'];
      if (error != null && error.toString().trim().isNotEmpty) {
        return error.toString();
      }
    }
    if (e.response?.statusCode == 401) {
      return 'Invalid credentials. Please check your login details.';
    }
    if (e.response?.statusCode == 403) {
      return 'Access denied. Account is restricted or delivery partner role is required.';
    }
    return e.message ?? fallback;
  }

  @override
  Future<UserModel> signInWithGoogle({
    String? idToken,
    String? serverAuthCode,
  }) async {
    await dioClient.fetchCsrfToken();

    final fcmToken = await _getFcmToken();

    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.googleAuth,
        data: {
          if (idToken != null && idToken.isNotEmpty) 'id_token': idToken,
          if (serverAuthCode != null && serverAuthCode.isNotEmpty)
            'code': serverAuthCode,
          if (fcmToken != null && fcmToken.isNotEmpty) 'fcm_token': fcmToken,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final userData = Map<String, dynamic>.from(
          response.data['user'] as Map? ?? {},
        );
        userData['accessToken'] = response.data['accessToken'];
        userData['refreshToken'] = response.data['refreshToken'];
        dioClient.setAuthToken(response.data['accessToken']?.toString());
        return UserModel.fromJson(userData);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Google login failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Google sign-in failed');
    }
  }

  Future<String?> _getFcmToken() async {
    if (Firebase.apps.isEmpty) {
      return null;
    }
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> logout() async {
    try {
      await dioClient.dio.post(ApiEndpoints.logout);
    } catch (_) {
      // Even if logout fails on server, local state should be cleared
    }
  }
}
