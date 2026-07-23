import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_event.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';

class SubscriptionBloc extends Bloc<SubscriptionEvent, SubscriptionState> {
  final SubscriptionRepository subscriptionRepository;

  SubscriptionBloc({required this.subscriptionRepository}) : super(SubscriptionInitial()) {
    on<LoadSubscriptions>(_onLoadSubscriptions);
    on<CreateSubscriptionRequested>(_onCreateSubscription);
    on<PlaceOneTimeOrderRequested>(_onPlaceOneTimeOrder);
    on<PauseSubscriptionRequested>(_onPauseSubscription);
    on<ResumeSubscriptionRequested>(_onResumeSubscription);
    on<CancelSubscriptionItemRequested>(_onCancelSubscriptionItem);
    on<CancelSubscriptionRequested>(_onCancelSubscription);
    on<LoadPauseHistoryRequested>(_onLoadPauseHistory);
  }

  Future<void> _onLoadSubscriptions(LoadSubscriptions event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final results = await Future.wait([
        subscriptionRepository.getSubscriptions(),
        subscriptionRepository.getOrders(),
      ]);
      emit(SubscriptionLoaded(
        subscriptions: results[0] as List<Subscription>,
        orders: results[1] as List<Order>,
      ));
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onCreateSubscription(CreateSubscriptionRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.createSubscription(
        customerId: event.customerId,
        branchId: event.branchId,
        variantId: event.variantId,
        quantity: event.quantity,
        scheduleType: event.scheduleType,
        deliverySlot: event.deliverySlot,
        startDate: event.startDate,
        unitPrice: event.unitPrice,
        customDays: event.customDays,
      );
      if (success) {
        emit(const SubscriptionActionSuccess('Subscription created successfully'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to create subscription. Check your balance.'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onPlaceOneTimeOrder(PlaceOneTimeOrderRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.placeOrder(
        variantId: event.variantId,
        quantity: event.quantity,
        unitPrice: event.unitPrice,
        deliverySlot: event.deliverySlot,
        scheduledDate: event.scheduledDate,
      );
      if (success) {
        emit(const SubscriptionActionSuccess('Order placed successfully'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to place order. Check your balance.'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onPauseSubscription(PauseSubscriptionRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.pauseSubscription(
        event.subscriptionId,
        startDate: event.startDate,
        endDate: event.endDate,
      );
      if (success) {
        emit(const SubscriptionActionSuccess('Subscription paused'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to pause subscription'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onResumeSubscription(ResumeSubscriptionRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.resumeSubscription(event.subscriptionId);
      if (success) {
        emit(const SubscriptionActionSuccess('Subscription resumed'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to resume subscription'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onCancelSubscriptionItem(CancelSubscriptionItemRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.cancelSubscriptionItem(event.subscriptionItemId);
      if (success) {
        emit(const SubscriptionActionSuccess('Subscription item cancelled'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to cancel subscription item'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onCancelSubscription(CancelSubscriptionRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final success = await subscriptionRepository.cancelSubscription(
        event.subscriptionId,
        cancelReason: event.cancelReason,
        endDate: event.endDate,
      );
      if (success) {
        emit(const SubscriptionActionSuccess('Subscription cancelled'));
        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        emit(const SubscriptionError('Failed to cancel subscription'));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  Future<void> _onLoadPauseHistory(LoadPauseHistoryRequested event, Emitter<SubscriptionState> emit) async {
    try {
      final pauses = await subscriptionRepository.getPauseHistory(event.subscriptionId);
      emit(PauseHistoryLoaded(pauses));
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }
}

