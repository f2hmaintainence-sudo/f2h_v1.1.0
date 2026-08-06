import 'package:equatable/equatable.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();
  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {}

class ProfileLoading extends ProfileState {}

class ProfileLoaded extends ProfileState {
  final ProfileModel profile;
  final List<dynamic> transactions;
  const ProfileLoaded(this.profile, {this.transactions = const []});

  @override
  List<Object?> get props => [profile, transactions];
}

class ProfileError extends ProfileState {
  final String message;
  const ProfileError(this.message);

  @override
  List<Object?> get props => [message];
}
