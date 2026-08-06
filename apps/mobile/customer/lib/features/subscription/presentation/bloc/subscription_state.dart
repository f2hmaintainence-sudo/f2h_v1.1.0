import 'package:equatable/equatable.dart';
import '../../data/models/subscription_model.dart';
import '../../../orders/data/models/order_model.dart';

abstract class SubscriptionState extends Equatable {
  const SubscriptionState();
  @override
  List<Object?> get props => [];
}

class SubscriptionInitial extends SubscriptionState {}

class SubscriptionLoading extends SubscriptionState {}

class SubscriptionLoaded extends SubscriptionState {
  final List<Subscription> subscriptions;
  final List<Order> orders;
  const SubscriptionLoaded({required this.subscriptions, this.orders = const []});

  @override
  List<Object?> get props => [subscriptions, orders];
}

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION ACTION SUCCESS
//
//  Carries the backend subscription ID and payment type
//  so the SubscriptionSuccessScreen can display them.
// ══════════════════════════════════════════════════════════

class SubscriptionActionSuccess extends SubscriptionState {
  final String message;

  /// The subscription ID returned by the backend (null for non-create actions).
  final String? subscriptionId;

  /// The payment type selected when creating the subscription.
  final String? paymentType;

  /// Whether auto-renewal was enabled for this subscription.
  final bool? autoRenew;

  const SubscriptionActionSuccess(
    this.message, {
    this.subscriptionId,
    this.paymentType,
    this.autoRenew,
  });

  @override
  List<Object?> get props => [message, subscriptionId, paymentType, autoRenew];
}

class SubscriptionError extends SubscriptionState {
  final String message;
  const SubscriptionError(this.message);

  @override
  List<Object?> get props => [message];
}

// ══════════════════════════════════════════════════════════
//  CHECKOUT-SPECIFIC ERROR STATE
//
//  Carries a machine-readable errorCode so the payment sheet
//  can render the right UI (top-up button, switch-to-prepaid, etc.)
// ══════════════════════════════════════════════════════════

class SubscriptionCheckoutError extends SubscriptionState {
  /// 'insufficient_wallet' | 'credit_limit_exceeded' | 'generic'
  final String errorCode;
  final String message;

  /// For insufficient_wallet: current wallet balance
  final double? walletBalance;

  /// For insufficient_wallet: amount required
  final double? required_;

  /// For credit_limit_exceeded: the credit limit
  final double? creditLimit;

  /// For credit_limit_exceeded: already committed amount
  final double? existingCommitted;

  const SubscriptionCheckoutError({
    required this.errorCode,
    required this.message,
    this.walletBalance,
    this.required_,
    this.creditLimit,
    this.existingCommitted,
  });

  @override
  List<Object?> get props => [errorCode, message, walletBalance, required_, creditLimit, existingCommitted];
}

class PauseHistoryLoaded extends SubscriptionState {
  final List<SubscriptionPauseModel> pauses;
  const PauseHistoryLoaded(this.pauses);

  @override
  List<Object?> get props => [pauses];
}
