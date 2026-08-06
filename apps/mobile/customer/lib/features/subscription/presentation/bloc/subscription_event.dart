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
  final String? resumeDate;
  const ResumeSubscriptionRequested({required this.subscriptionId, this.resumeDate});

  @override
  List<Object?> get props => [subscriptionId, resumeDate];
}

class UpdateAutoRenewRequested extends SubscriptionEvent {
  final String subscriptionId;
  final bool autoRenew;
  const UpdateAutoRenewRequested({required this.subscriptionId, required this.autoRenew});

  @override
  List<Object?> get props => [subscriptionId, autoRenew];
}

// ══════════════════════════════════════════════════════════
//  CREATE SUBSCRIPTION — Dedicated Subscription Setup Flow
//
//  Called from SubscriptionSetupScreen (NOT from Cart/Checkout).
//  Subscriptions always use variant.subscription_price.
//  No COD — only Prepaid or Postpaid.
// ══════════════════════════════════════════════════════════

class CreateSubscriptionRequested extends SubscriptionEvent {
  final String customerId;
  final String branchId;
  final String variantId;
  final String scheduleType;   // 'daily', 'weekly', 'custom'
  final String deliverySlot;   // 'Morning', 'Evening', 'Both'
  final String startDate;      // ISO date string (YYYY-MM-DD)
  final double unitPrice;      // Always variant.subscription_price
  final List<String> customDays;

  // ── Morning & Evening quantities (split delivery support) ──
  final int morningQty;
  final int eveningQty;

  // ── Subscription business options ──
  final String paymentType;  // 'prepaid' or 'postpaid' (no COD)
  final bool autoRenew;

  const CreateSubscriptionRequested({
    required this.customerId,
    required this.branchId,
    required this.variantId,
    required this.scheduleType,
    required this.deliverySlot,
    required this.startDate,
    required this.unitPrice,
    required this.customDays,
    this.morningQty = 1,
    this.eveningQty = 0,
    this.paymentType = 'prepaid',
    this.autoRenew = true,
  });

  /// Computed total quantity per delivery day
  int get quantity => (morningQty + eveningQty).clamp(1, 999);

  @override
  List<Object?> get props => [
        customerId,
        branchId,
        variantId,
        scheduleType,
        deliverySlot,
        startDate,
        unitPrice,
        customDays,
        morningQty,
        eveningQty,
        paymentType,
        autoRenew,
      ];
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

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION CHECKOUT — with payment validation
//
//  Triggers the /subscriptions/checkout endpoint which
//  handles wallet deduction (prepaid) or credit limit check
//  (postpaid) server-side before creating the subscription.
// ══════════════════════════════════════════════════════════

class SubscriptionCheckoutRequested extends SubscriptionEvent {
  final String customerId;
  final String branchId;
  final String? addressId;
  final String variantId;
  final String scheduleType;
  final String deliverySlot;
  final String startDate;
  final double unitPrice;
  final List<String> customDays;
  final int morningQty;
  final int eveningQty;
  // Per-day schedule map for 'weekly' frequency:
  // { 'Mon': {'morning': 1, 'evening': 0}, 'Wed': {'morning': 3, 'evening': 0}, ... }
  final Map<String, Map<String, int>> weeklySchedule;
  final String paymentType;   // 'prepaid' | 'postpaid'
  final String paymentMethod; // 'wallet' | 'upi' | 'postpaid'
  final bool autoRenew;
  final double estimatedTotal;
  final double? monthlyEstimate;

  const SubscriptionCheckoutRequested({
    required this.customerId,
    required this.branchId,
    this.addressId,
    required this.variantId,
    required this.scheduleType,
    required this.deliverySlot,
    required this.startDate,
    required this.unitPrice,
    required this.customDays,
    this.morningQty = 1,
    this.eveningQty = 0,
    this.weeklySchedule = const {},
    this.paymentType = 'prepaid',
    this.paymentMethod = 'wallet',
    this.autoRenew = true,
    this.estimatedTotal = 0.0,
    this.monthlyEstimate,
  });

  int get quantity => (morningQty + eveningQty).clamp(1, 999);

  @override
  List<Object?> get props => [
        customerId, branchId, variantId, scheduleType, deliverySlot,
        startDate, unitPrice, customDays, morningQty, eveningQty,
        weeklySchedule, paymentType, paymentMethod, autoRenew, estimatedTotal, monthlyEstimate,
      ];
}
