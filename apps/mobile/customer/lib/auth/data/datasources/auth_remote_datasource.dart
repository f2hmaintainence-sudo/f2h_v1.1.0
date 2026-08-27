import 'package:dio/dio.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/auth/data/models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> login(
    String identifier,
    String password, {
    String? fcmToken,
  });
  Future<UserModel> register(
    String userName,
    String email,
    String password, {
    required String phone,
    required String verificationToken,
    String? referralCode,
    String? fcmToken,
  });
  /// Exchanges a Google credential for an F2H session.
  ///
  /// Both fields are forwarded because platforms differ in what they can
  /// produce; the API verifies whichever one it receives.
  Future<UserModel> signInWithGoogle({
    String? idToken,
    String? serverAuthCode,
    String? fcmToken,
  });
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
    if (e.response?.statusCode == 401) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final text = data['message'].toString();
        if (text.isNotEmpty && text != 'Unauthorized') {
          return text;
        }
      }
      return 'Invalid email, phone or password. Please check your login details.';
    }

    if (e.response?.statusCode == 403) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final text = data['message'].toString();
        if (text.isNotEmpty && text != 'Forbidden') {
          return text;
        }
      }
      return 'Access denied. Account is restricted or role is invalid.';
    }

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

    if (e.response?.statusCode != null && e.response!.statusCode! >= 500) {
      return 'Server error (${e.response?.statusCode}). Please try again later.';
    }

    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Connection failed. Please check your internet connection and try again.';
    }

    return e.message ?? fallback;
  }

  @override
  Future<UserModel> login(
    String identifier,
    String password, {
    String? fcmToken,
  }) async {
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.login,
        data: {
          'identifier': identifier,
          'password': password,
          if (fcmToken != null && fcmToken.isNotEmpty) 'fcm_token': fcmToken,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Merge top-level response (contains accessToken) with the nested user map
        final userMap = Map<String, dynamic>.from(
          response.data['user'] as Map? ?? {},
        );
        userMap['accessToken'] = response.data['accessToken'];
        userMap['refreshToken'] = response.data['refreshToken'];
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
        'first_name': userName,   // full name → users.first_name column
        'user_name': userName,
        'name': userName,
        'email': email,
        'phone': phone,
        if (password.isNotEmpty) 'password': password,
        'role': 'CUSTOMER',
        'verification_token': verificationToken,
         if (fcmToken != null && fcmToken.isNotEmpty) 'fcm_token': fcmToken,
      };

      if (referralCode != null && referralCode.isNotEmpty) {
        body['referral_code'] = referralCode;
      }
      final response = await dioClient.dio.post(
        ApiEndpoints.register,
        data: body,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final userMap = Map<String, dynamic>.from(
          response.data['user'] as Map? ?? {},
        );
        userMap['accessToken'] = response.data['accessToken'];
        userMap['refreshToken'] = response.data['refreshToken'];
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
        data: {'email': email, 'otp': otp, 'purpose': purpose},
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
        data: {'email': email, 'token': token, 'newPassword': newPassword},
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to reset password');
    }
  }

  @override
  Future<UserModel> signInWithGoogle({
    String? idToken,
    String? serverAuthCode,
    String? fcmToken,
  }) async {
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
        final userMap = Map<String, dynamic>.from(
          response.data['user'] as Map? ?? {},
        );
        userMap['accessToken'] = response.data['accessToken'];
        userMap['refreshToken'] = response.data['refreshToken'];
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
