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

class LogoutRequested extends AuthEvent {}

class GoogleSignInRequested extends AuthEvent {}

class AuthCheckRequested extends AuthEvent {}
