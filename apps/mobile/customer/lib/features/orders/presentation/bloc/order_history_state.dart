import 'package:equatable/equatable.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/data/models/subscription_plan_model.dart';

abstract class OrderHistoryState extends Equatable {
  const OrderHistoryState();
  @override
  List<Object?> get props => [];
}

class OrderHistoryInitial extends OrderHistoryState {}

class OrderHistoryLoading extends OrderHistoryState {}

class OrderHistoryLoaded extends OrderHistoryState {
  /// Orders where order_source = 'one_time' (or null)
  final List<Order> oneTimeOrders;

  /// Orders where order_source = 'subscription'
  final List<Order> subscriptionOrders;

  /// Subscription plans from the subscriptions table
  final List<SubscriptionPlan> subscriptionPlans;

  const OrderHistoryLoaded({
    required this.oneTimeOrders,
    required this.subscriptionOrders,
    required this.subscriptionPlans,
  });

  @override
  List<Object?> get props => [oneTimeOrders, subscriptionOrders, subscriptionPlans];
}

class OrderHistoryError extends OrderHistoryState {
  final String message;
  const OrderHistoryError({required this.message});
  @override
  List<Object?> get props => [message];
}

class OrderActionSuccess extends OrderHistoryState {
  final String message;
  final bool reloaded; // true once re-fetch completed
  const OrderActionSuccess({required this.message, this.reloaded = false});
  @override
  List<Object?> get props => [message, reloaded];
}
