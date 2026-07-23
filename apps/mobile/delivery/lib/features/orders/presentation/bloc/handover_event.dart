part of 'handover_bloc.dart';

abstract class HandoverEvent {}

class SubmitHandover extends HandoverEvent {
  final String runId;
  SubmitHandover(this.runId);
}
