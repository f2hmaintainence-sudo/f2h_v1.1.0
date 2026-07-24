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
  Future<void> logout();
  Future<User?> checkAuthStatus();
}
