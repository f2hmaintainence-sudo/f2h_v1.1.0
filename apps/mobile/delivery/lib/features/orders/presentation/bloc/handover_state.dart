part of 'handover_bloc.dart';

abstract class HandoverState {}

class HandoverInitial extends HandoverState {}

class HandoverLoading extends HandoverState {}

class HandoverSuccess extends HandoverState {
  final HandoverResult result;
  HandoverSuccess(this.result);
}

class HandoverFailure extends HandoverState {
  final String error;
  HandoverFailure(this.error);
}
