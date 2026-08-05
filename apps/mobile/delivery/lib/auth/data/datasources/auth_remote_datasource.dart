import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/auth/data/models/user_model.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

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
  Future<UserModel> signInWithGoogle(String serverAuthCode);
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
          'role': 'DELIVERY_PARTNER',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Tokens are at top-level; user details are nested under 'user'
        final userData = Map<String, dynamic>.from(response.data['user'] as Map);
        userData['accessToken']  = response.data['accessToken'];
        userData['refreshToken'] = response.data['refreshToken'];
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
  Future<UserModel> signInWithGoogle(String serverAuthCode) async {
    await dioClient.fetchCsrfToken();
    
    final fcmToken = await _getFcmToken();

    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.googleAuth}/callback',
        queryParameters: {
          'code': serverAuthCode,
          'fcm_token': fcmToken,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return UserModel.fromJson(response.data['user']);
      } else {
        throw DioException(
          requestOptions: response.requestOptions,
          response: response,
          error: response.data['message'] ?? 'Google login failed',
        );
      }
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Connection error';
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
