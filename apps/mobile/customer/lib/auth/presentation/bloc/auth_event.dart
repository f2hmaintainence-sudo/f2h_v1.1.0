import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object> get props => [];
}

class LoginRequested extends AuthEvent {
  final String identifier;
  final String password;

  const LoginRequested({required this.identifier, required this.password});

  @override
  List<Object> get props => [identifier, password];
}

class SignupRequested extends AuthEvent {
  final String user_name;
  final String email;
  final String phone;
  final String password;
  final String verificationToken;
  final String? referralCode;

  const SignupRequested({
    required this.user_name,
    required this.email,
    required this.phone,
    required this.password,
    required this.verificationToken,
    this.referralCode,
  });

  @override
  List<Object> get props => [user_name, email, phone, password, verificationToken, referralCode ?? ''];
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

class GoogleSignInRequested extends AuthEvent {
  const GoogleSignInRequested();
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}
