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
  final String name;
  final String email;
  final String password;
  final String? branchId;
  final double? latitude;
  final double? longitude;

  const SignupRequested({
    required this.name,
    required this.email,
    required this.password,
    this.branchId,
    this.latitude,
    this.longitude,
  });

  @override
  List<Object> get props => [name, email, password, branchId ?? '', latitude ?? 0, longitude ?? 0];
}

class LogoutRequested extends AuthEvent {}

class GoogleSignInRequested extends AuthEvent {}

class AuthCheckRequested extends AuthEvent {}
