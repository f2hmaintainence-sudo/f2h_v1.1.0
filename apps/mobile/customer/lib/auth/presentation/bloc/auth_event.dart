import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object> get props => [];
}

class PhoneOtpLoginRequested extends AuthEvent {
  final String phone;
  final String otp;
  final String? referralCode;

  const PhoneOtpLoginRequested({
    required this.phone,
    required this.otp,
    this.referralCode,
  });

  @override
  List<Object> get props => [phone, otp, referralCode ?? ''];
}

class SignupRequested extends AuthEvent {
  final String userName;
  final String email;
  final String phone;
  final String verificationToken;
  final String? referralCode;

  const SignupRequested({
    required this.userName,
    required this.email,
    required this.phone,
    required this.verificationToken,
    this.referralCode,
  });

  @override
  List<Object> get props => [userName, email, phone, verificationToken, referralCode ?? ''];
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
