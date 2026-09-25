import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String userId;
  final String email;
  final String? phone;
  final bool mustChangePassword;
  final bool isNewUser;
  final String? token;
  final String? refreshToken;

  const User({
    required this.userId,
    required this.email,
    this.phone,
    this.mustChangePassword = false,
    this.isNewUser = false,
    this.token,
    this.refreshToken,
  });

  @override
  List<Object?> get props => [userId, email, phone, mustChangePassword, isNewUser, token, refreshToken];
}
