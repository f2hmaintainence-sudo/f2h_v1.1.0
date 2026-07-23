import 'package:equatable/equatable.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';

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

class SubscriptionActionSuccess extends SubscriptionState {
  final String message;
  const SubscriptionActionSuccess(this.message);

  @override
  List<Object?> get props => [message];
}

class SubscriptionError extends SubscriptionState {
  final String message;
  const SubscriptionError(this.message);

  @override
  List<Object?> get props => [message];
}

class PauseHistoryLoaded extends SubscriptionState {
  final List<SubscriptionPauseModel> pauses;
  const PauseHistoryLoaded(this.pauses);

  @override
  List<Object?> get props => [pauses];
}
