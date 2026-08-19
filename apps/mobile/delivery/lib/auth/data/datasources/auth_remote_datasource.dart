import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/auth/data/models/user_model.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> login(String identifier, String password);
  Future<UserModel> register(
    String name,
    String email,
    String password, {
    String? phone,
    String? branchId,
    double? latitude,
    double? longitude,
    String? verificationToken,
    String? referralCode,
  });
  /// Exchanges a Google credential for an F2H session.
  ///
  /// Both fields are forwarded because platforms differ in what they can
  /// produce; the API verifies whichever one it receives.
  Future<UserModel> signInWithGoogle({String? idToken, String? serverAuthCode});

  /// Sends a password-reset OTP to whichever channel [identifier] names.
  Future<void> requestPasswordResetOtp(String identifier);

  /// Confirms an OTP and returns the single-use token the reset step needs.
  Future<String> verifyPasswordResetOtp({
    required String identifier,
    required String otp,
  });

  Future<void> resetPassword({
    required String identifier,
    required String token,
    required String newPassword,
  });

  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient dioClient;

  AuthRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<UserModel> login(String identifier, String password) async {
    // Ensure we have a CSRF token before login
    await dioClient.fetchCsrfToken();

    final fcmToken = await _getFcmToken();

    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.login,
        data: {
          'identifier': identifier,
          'password': password,
          'fcm_token': fcmToken,
          // No `role` here on purpose: AuthController reads the role strictly
          // from the x-role header (DioClient sends X-role: D) and ignores the
          // body, so a value here only looks authoritative without being so.
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Tokens are at top-level; user details are nested under 'user'
        final userData = Map<String, dynamic>.from(response.data['user'] as Map);
        userData['accessToken']  = response.data['accessToken'];
        userData['refreshToken'] = response.data['refreshToken'];
        dioClient.setAuthToken(response.data['accessToken']?.toString());
        return UserModel.fromJson(userData);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Login failed',
        );
      }
    } on DioException catch (e) {
      throw _extractError(e, 'Invalid email or password');
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
      return 'Invalid email, phone or password. Please check your login credentials.';
    }
    if (e.response?.statusCode == 403) {
      return 'Access denied. Account is restricted or delivery partner role is required.';
    }
    return e.message ?? fallback;
  }

  @override
  Future<UserModel> register(
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
    await dioClient.fetchCsrfToken();

    final fcmToken = await _getFcmToken();

    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.register,
        data: {
          'first_name': name,  // full name → users.first_name column
          'name': name,
          'user_name': name,
          'email': email,
          'password': password,
          'phone': phone,
          'fcm_token': fcmToken,
          'branch_id': branchId,
          'latitude': latitude,
          'longitude': longitude,
          'role': 'DELIVERY_PARTNER',
          'verification_token': verificationToken,
          'referral_code': referralCode,
        },
      );


      if (response.statusCode == 200 || response.statusCode == 201) {
        // After registration, tokens (if any) are at top-level
        final rawUser = response.data['user'] ?? response.data ?? {};
        final userData = Map<String, dynamic>.from(rawUser as Map);
        userData['accessToken']  ??= response.data['accessToken'];
        userData['refreshToken'] ??= response.data['refreshToken'];
        return UserModel.fromJson(userData);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Registration failed',
        );
      }
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Connection error';
    }
  }

  @override
  Future<UserModel> signInWithGoogle({
    String? idToken,
    String? serverAuthCode,
  }) async {
    await dioClient.fetchCsrfToken();

    final fcmToken = await _getFcmToken();

    try {
      // POST rather than GET: an authorization code does not belong in a URL,
      // where it lands in access logs and browser history.
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
        // The tokens sit at the top level, not inside `user`. Reading only the
        // nested map left UserModel.token null, so AuthRepositoryImpl skipped
        // TokenStorage.saveTokens entirely — Google sign-in reported success
        // and then behaved as if nobody had logged in.
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
      // `e.response?.data['message']` threw a second, uncatchable error whenever
      // the body was not a Map (an HTML error page, or no response at all).
      throw _extractError(e, 'Google sign-in failed');
    }
  }

  /// `identifier` may be an email or a phone number; the API accepts either and
  /// decides which channel to use, so the client does not need to guess.
  Map<String, dynamic> _identifierPayload(String identifier) {
    final trimmed = identifier.trim();
    final isEmail = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$').hasMatch(trimmed);
    return isEmail ? {'email': trimmed} : {'phone': trimmed};
  }

  @override
  Future<void> requestPasswordResetOtp(String identifier) async {
    await dioClient.fetchCsrfToken();
    try {
      await dioClient.dio.post(
        ApiEndpoints.forgotPassword,
        data: _identifierPayload(identifier),
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to send the reset OTP');
    }
  }

  @override
  Future<String> verifyPasswordResetOtp({
    required String identifier,
    required String otp,
  }) async {
    await dioClient.fetchCsrfToken();
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.verifyEmailOtp,
        data: {
          ..._identifierPayload(identifier),
          'otp': otp,
          'purpose': 'forgot_password',
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
  Future<void> resetPassword({
    required String identifier,
    required String token,
    required String newPassword,
  }) async {
    await dioClient.fetchCsrfToken();
    try {
      await dioClient.dio.post(
        ApiEndpoints.resetPassword,
        data: {
          ..._identifierPayload(identifier),
          'token': token,
          'newPassword': newPassword,
        },
      );
    } on DioException catch (e) {
      throw _extractError(e, 'Unable to reset the password');
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
    } catch (e) {
      // Even if logout fails on server, we might want to clear local state
    }
  }
}
