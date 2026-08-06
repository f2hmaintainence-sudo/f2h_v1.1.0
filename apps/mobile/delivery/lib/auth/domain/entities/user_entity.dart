import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String userId;
  final String email;
  final bool mustChangePassword;
  final String? token;
  final String? refreshToken;

  const User({
    required this.userId,
    required this.email,
    this.mustChangePassword = false,
    this.token,
    this.refreshToken,
  });

  @override
  List<Object?> get props => [userId, email, mustChangePassword, token, refreshToken];
}
