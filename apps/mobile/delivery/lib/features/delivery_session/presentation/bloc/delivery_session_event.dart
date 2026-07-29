part of 'delivery_session_bloc.dart';

abstract class DeliverySessionEvent {}

/// Initial load (profile + today's run / orders).
class LoadSessionEvent extends DeliverySessionEvent {}

/// Reload the session — same as [LoadSessionEvent], used on pull-to-refresh /
/// app foreground resume.
class ReloadSessionEvent extends DeliverySessionEvent {}

/// Toggle the driver's online / offline shift status.
class ToggleOnlineEvent extends DeliverySessionEvent {
  final bool val;
  final void Function(String? error)? callback;
  ToggleOnlineEvent(this.val, {this.callback});
}

/// Mark a stop as delivered or failed and sync to the backend.
class UpdateStopStatusEvent extends DeliverySessionEvent {
  final String orderId;
  final String newStatus;
  final int emptyBottles;
  final int returnedContainers;
  final int damagedContainers;
  final int lostContainers;
  final String? notes;
  final String? paymentMode;
  final String? paymentStatus;
  final String? deliveryImage;
  final List<Map<String, dynamic>>? containerReturns;

  UpdateStopStatusEvent({
    required this.orderId,
    required this.newStatus,
    this.emptyBottles = 0,
    this.returnedContainers = 0,
    this.damagedContainers = 0,
    this.lostContainers = 0,
    this.notes,
    this.paymentMode,
    this.paymentStatus,
    this.deliveryImage,
    this.containerReturns,
  });
}

/// Start the assigned delivery run.
class StartRunEvent extends DeliverySessionEvent {
  final String runId;
  StartRunEvent(this.runId);
}

/// Trigger SOS alert.
class TriggerSosEvent extends DeliverySessionEvent {}

/// Clear / cancel an active SOS.
class ClearSosEvent extends DeliverySessionEvent {}

/// Clear the active run after a warehouse handover.
class ClearActiveRunEvent extends DeliverySessionEvent {}
