import 'package:equatable/equatable.dart';

abstract class SubscriptionEvent extends Equatable {
  const SubscriptionEvent();
  @override
  List<Object?> get props => [];
}

class LoadSubscriptions extends SubscriptionEvent {}

class PauseSubscriptionRequested extends SubscriptionEvent {
  final String subscriptionId;
  final String? startDate;
  final String? endDate;
  const PauseSubscriptionRequested({
    required this.subscriptionId,
    this.startDate,
    this.endDate,
  });

  @override
  List<Object?> get props => [subscriptionId, startDate, endDate];
}

class ResumeSubscriptionRequested extends SubscriptionEvent {
  final String subscriptionId;
  const ResumeSubscriptionRequested({required this.subscriptionId});

  @override
  List<Object?> get props => [subscriptionId];
}

class CreateSubscriptionRequested extends SubscriptionEvent {
  final String customerId;
  final String branchId;
  final String variantId;
  final int quantity;
  final String scheduleType;
  final String deliverySlot;
  final String startDate;
  final double unitPrice;
  final List<String> customDays;

  const CreateSubscriptionRequested({
    required this.customerId,
    required this.branchId,
    required this.variantId,
    required this.quantity,
    required this.scheduleType,
    required this.deliverySlot,
    required this.startDate,
    required this.unitPrice,
    required this.customDays,
  });

  @override
  List<Object?> get props => [customerId, branchId, variantId, quantity, scheduleType, deliverySlot, startDate, unitPrice, customDays];
}

class PlaceOneTimeOrderRequested extends SubscriptionEvent {
  final String variantId;
  final int quantity;
  final double unitPrice;
  final String deliverySlot;
  final String scheduledDate;

  const PlaceOneTimeOrderRequested({
    required this.variantId,
    required this.quantity,
    required this.unitPrice,
    required this.deliverySlot,
    required this.scheduledDate,
  });

  @override
  List<Object?> get props => [variantId, quantity, unitPrice, deliverySlot, scheduledDate];
}

class CancelSubscriptionItemRequested extends SubscriptionEvent {
  final String subscriptionItemId;
  const CancelSubscriptionItemRequested({required this.subscriptionItemId});

  @override
  List<Object?> get props => [subscriptionItemId];
}

class CancelSubscriptionRequested extends SubscriptionEvent {
  final String subscriptionId;
  final String? cancelReason;
  final String? endDate;
  const CancelSubscriptionRequested({
    required this.subscriptionId,
    this.cancelReason,
    this.endDate,
  });

  @override
  List<Object?> get props => [subscriptionId, cancelReason, endDate];
}

class LoadPauseHistoryRequested extends SubscriptionEvent {
  final String subscriptionId;
  const LoadPauseHistoryRequested({required this.subscriptionId});

  @override
  List<Object?> get props => [subscriptionId];
}
