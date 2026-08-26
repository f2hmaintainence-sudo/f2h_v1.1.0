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
  final List<Map<String, dynamic>>? containerDeliveries;
  /// Called on successful backend confirmation (after fresh state is emitted).
  final void Function()? onSuccess;
  /// Called with the error message when the backend call fails.
  final void Function(String error)? onError;

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
    this.containerDeliveries,
    this.onSuccess,
    this.onError,
  });
}

/// Start the assigned delivery run.
class StartRunEvent extends DeliverySessionEvent {
  final String runId;
  StartRunEvent(this.runId);
}

/// Confirms the warehouse pickup for the active run.
///
/// `warehouse_pickup_modal` has always dispatched this, but the class was never
/// declared — so the delivery app did not compile. The callbacks mirror the
/// modal's existing expectations rather than inventing a new contract.
class ConfirmWarehousePickupEvent extends DeliverySessionEvent {
  final void Function()? onSuccess;
  final void Function(String error)? onError;

  ConfirmWarehousePickupEvent({this.onSuccess, this.onError});
}

/// Trigger SOS alert.
class TriggerSosEvent extends DeliverySessionEvent {}

/// Clear / cancel an active SOS.
class ClearSosEvent extends DeliverySessionEvent {}

/// Clear the active run after a warehouse handover.
class ClearActiveRunEvent extends DeliverySessionEvent {}

/// Hand over a completed run to the warehouse.
class HandoverRunEvent extends DeliverySessionEvent {
  final String runId;
  final void Function(HandoverResult result)? onSuccess;
  final void Function(String error)? onError;
  HandoverRunEvent(this.runId, {this.onSuccess, this.onError});
}
