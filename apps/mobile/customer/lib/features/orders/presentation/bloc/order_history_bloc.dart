import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/data/models/subscription_plan_model.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_state.dart';

class OrderHistoryBloc extends Bloc<OrderHistoryEvent, OrderHistoryState> {
  final OrdersRepository ordersRepository;
  

  OrderHistoryBloc({required this.ordersRepository}) : super(OrderHistoryInitial()) {
    on<LoadOrderHistory>(_onLoad);
    on<CancelOrderRequested>(_onCancel);
    on<RateOrderRequested>(_onRate);
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  Future<OrderHistoryLoaded> _fetchLoaded() async {
    final data = await ordersRepository.getOrdersAndSubscriptions();

    final rawOrders = (data['orders'] as List<dynamic>? ?? []);
    final allOrders = rawOrders
        .map((j) => Order.fromJson(j as Map<String, dynamic>))
        .toList();

    final oneTimeOrders = allOrders
        .where((o) => (o.orderSource) != 'subscription')
        .toList();
    final subscriptionOrders = allOrders
        .where((o) => (o.orderSource) == 'subscription')
        .toList();

    final rawSubs = (data['subscriptions'] as List<dynamic>? ?? []);
    final subscriptionPlans = rawSubs
        .map((j) => SubscriptionPlan.fromJson(j as Map<String, dynamic>))
        .toList();

    return OrderHistoryLoaded(
      oneTimeOrders: oneTimeOrders,
      subscriptionOrders: subscriptionOrders,
      subscriptionPlans: subscriptionPlans,
    );
  }

  // ── handlers ──────────────────────────────────────────────────────────────
  Future<void> _onLoad(LoadOrderHistory event, Emitter<OrderHistoryState> emit) async {
    emit(OrderHistoryLoading());
    try {
      emit(await _fetchLoaded());
    } catch (e) {
      emit(OrderHistoryError(message: extractErrorMessage(e)));
    }
  }

  Future<void> _onCancel(CancelOrderRequested event, Emitter<OrderHistoryState> emit) async {
    // Keep showing the current list while the cancel request is in-flight
    final prev = state;
    try {
      final response = await ordersRepository.cancelOrder(event.orderId);
      final msg = response['message']?.toString() ?? 'Order cancelled';
      if (response['status'] == true) {
        emit(OrderActionSuccess(message: msg));
        final loaded = await _fetchLoaded();
        emit(loaded);
      } else {
        emit(OrderHistoryError(message: msg));
        if (prev is OrderHistoryLoaded) emit(prev);
      }
    } catch (e) {
      emit(OrderHistoryError(message: extractErrorMessage(e)));
      if (prev is OrderHistoryLoaded) emit(prev);
    }
  }

  Future<void> _onRate(RateOrderRequested event, Emitter<OrderHistoryState> emit) async {
    final prev = state;
    try {
      final response = await ordersRepository.rateOrder(
        event.orderId,
        event.rating,
        event.feedback,
        productId: event.productId, // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      );
      final msg = response['message']?.toString() ?? 'Rating submitted';
      if (response['status'] == true) {
        emit(OrderActionSuccess(message: msg));
        final loaded = await _fetchLoaded();
        emit(loaded);
      } else {
        emit(OrderHistoryError(message: msg));
        if (prev is OrderHistoryLoaded) emit(prev);
      }
    } catch (e) {
      emit(OrderHistoryError(message: extractErrorMessage(e)));
      if (prev is OrderHistoryLoaded) emit(prev);
    }
  }
}
