import 'package:equatable/equatable.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';

abstract class AuthState extends Equatable {
  const AuthState();
  
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

/// Startup session check in flight.
///
/// Kept apart from [AuthLoading] because the two mean different things to the
/// UI: this one must hold a loading screen (we do not yet know whether the user
/// is signed in), while [AuthLoading] happens while the login form is already
/// on screen and handles its own spinner.
class AuthCheckInProgress extends AuthState {}

class Authenticated extends AuthState {
  final User user;

  const Authenticated({required this.user});

  @override
  List<Object?> get props => [user];
}

class Unauthenticated extends AuthState {
  final String? message;

  const Unauthenticated({this.message});

  @override
  List<Object?> get props => [message];
}

class AuthFailure extends AuthState {
  final String error;

  const AuthFailure({required this.error});

  @override
  List<Object?> get props => [error];
}
