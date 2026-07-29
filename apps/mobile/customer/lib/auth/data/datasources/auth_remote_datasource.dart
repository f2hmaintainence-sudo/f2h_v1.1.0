import 'package:dio/dio.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/auth/data/models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> login(String identifier, String password, {String? fcmToken});
  Future<UserModel> register(
    String userName,
    String email,
    String password, {
    required String phone,
    required String verificationToken,
    String? referralCode,
    String? fcmToken,
  });
  Future<UserModel> signInWithGoogle(String serverAuthCode, {String? fcmToken});
  Future<void> sendRegistrationOtp(String email, {String? userName});
  Future<String> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  });
  Future<void> requestPasswordResetOtp(String email);
  Future<void> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  });
  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient dioClient;

  AuthRemoteDataSourceImpl({required this.dioClient});

  String _extractError(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message is List) {
        return message.map((item) => item.toString()).join('\n');
      }
      if (message != null) {
        final text = message.toString();
        if (text == 'Invalid OTP') {
          return 'Invalid OTP. Please enter the latest 6-digit code or resend OTP.';
        }
        return text;
      }
      final error = data['error'];
      if (error != null) {
        return error.toString();
      }
    }
    if (e.error != null) {
      return e.error.toString();
    }
    return fallback;
  }

  @override
  Future<UserModel> login(String identifier, String password, {String? fcmToken}) async {
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.login,
        data: {
          'identifier': identifier,
          'password': password,
          'fcm_token': fcmToken,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Merge top-level response (contains accessToken) with the nested user map
        final userMap = Map<String, dynamic>.from(response.data['user'] as Map? ?? {});
        userMap['accessToken'] = response.data['accessToken'];
        dioClient.setAuthToken(response.data['accessToken']?.toString());
        return UserModel.fromJson(userMap);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Login failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Connection error');
    }
  }

  @override
  Future<UserModel> register(
    String userName,
    String email,
    String password, {
    required String phone,
    required String verificationToken,
    String? referralCode,
    String? fcmToken,
  }) async {
    try {
      final body = <String, dynamic>{
          'user_name': userName,
          'email': email,
          'phone': phone,
          'password': password,
          'verification_token': verificationToken,
          'fcm_token': fcmToken,
        };
      if (referralCode != null && referralCode.isNotEmpty) {
        body['referral_code'] = referralCode;
      }
      final response = await dioClient.dio.post(
        ApiEndpoints.register,
        data: body,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final userMap = Map<String, dynamic>.from(response.data['user'] as Map? ?? {});
        userMap['accessToken'] = response.data['accessToken'];
        dioClient.setAuthToken(response.data['accessToken']?.toString());
        return UserModel.fromJson(userMap);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Registration failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Connection error');
    }
  }

  @override
  Future<void> sendRegistrationOtp(String email, {String? userName}) async {
    try {
      await dioClient.dio.post(
        ApiEndpoints.sendOtp,
        data: {
          'email': email,
          'user_name': userName,
          'purpose': 'registration',
        },
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to send OTP');
    }
  }

  @override
  Future<String> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  }) async {
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.verifyOtp,
        data: {
          'email': email,
          'otp': otp,
          'purpose': purpose,
        },
      );
      final data = Map<String, dynamic>.from(response.data as Map? ?? {});
      final token = data['verification_token']?.toString() ?? '';
      if (token.isEmpty) {
        throw 'OTP verified, but no verification token was returned';
      }
      return token;
    } on DioException catch (e) {
      throw _extractError(e, 'OTP verification failed');
    }
  }

  @override
  Future<void> requestPasswordResetOtp(String email) async {
    try {
      await dioClient.dio.post(
        ApiEndpoints.forgotPassword,
        data: {'email': email},
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to send password reset OTP');
    }
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  }) async {
    try {
      await dioClient.dio.post(
        ApiEndpoints.resetPassword,
        data: {
          'email': email,
          'token': token,
          'newPassword': newPassword,
        },
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to reset password');
    }
  }

  @override
  Future<UserModel> signInWithGoogle(String serverAuthCode, {String? fcmToken}) async {
    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.googleAuth}/callback',
        queryParameters: {
          'code': serverAuthCode,
          'fcm_token': fcmToken,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final userMap = Map<String, dynamic>.from(response.data['user'] as Map? ?? {});
        userMap['accessToken'] = response.data['accessToken'];
        dioClient.setAuthToken(response.data['accessToken']?.toString());
        return UserModel.fromJson(userMap);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Google login failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Connection error');
    }
  }

  @override
  Future<void> logout() async {
    try {
      await dioClient.dio.post(ApiEndpoints.logout);
    } finally {
      await dioClient.clearCookies();
    }
  }
}
