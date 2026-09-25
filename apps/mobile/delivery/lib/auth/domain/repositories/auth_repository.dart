import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<void> sendLoginOtp(String phone);
  Future<User> loginWithOtp({
    required String phone,
    required String otp,
    String? referralCode,
  });
  Future<User> signInWithGoogle();
  Future<void> logout();
  Future<User?> checkAuthStatus();
}
