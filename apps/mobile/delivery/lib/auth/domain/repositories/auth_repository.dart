import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<User> login(String identifier, String password);
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
  });
  Future<User> signInWithGoogle();

  /// Password reset, in the order the UI walks through it:
  /// request an OTP, exchange it for a single-use token, then set the password.
  Future<void> requestPasswordResetOtp(String identifier);
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
  Future<User?> checkAuthStatus();
}
