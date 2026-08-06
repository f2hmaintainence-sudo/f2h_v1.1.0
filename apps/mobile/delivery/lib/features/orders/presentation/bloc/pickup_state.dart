part of 'pickup_bloc.dart';

abstract class PickupState {}

class PickupInitial extends PickupState {}

class PickupLoading extends PickupState {}

class PickupLoaded extends PickupState {
  final PickupResponse response;
  PickupLoaded({required this.response});
}

class PickupConfirming extends PickupState {
  final PickupResponse response;
  PickupConfirming({required this.response});
}

class PickupConfirmed extends PickupState {
  final PickupResponse response;
  PickupConfirmed({required this.response});
}

class PickupNoRun extends PickupState {
  final String message;
  PickupNoRun({required this.message});
}

class PickupError extends PickupState {
  final String message;
  PickupError({required this.message});
}
