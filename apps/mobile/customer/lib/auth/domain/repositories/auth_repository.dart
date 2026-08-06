import 'package:f2h_customer/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<User> login(String identifier, String password, {String? fcmToken});
  Future<User> register(
    String userName,
    String email,
    String password, {
    required String phone,
    required String verificationToken,
    String? referralCode,
    String? fcmToken,
  });
  Future<User> signInWithGoogle({String? fcmToken});
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
  Future<bool> checkAuthStatus();
  Future<User?> getCachedUser();
}
