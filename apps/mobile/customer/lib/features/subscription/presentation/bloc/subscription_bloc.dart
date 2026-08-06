import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/errors/error_handler.dart';
import '../../domain/repositories/subscription_repository.dart';
import '../../data/models/subscription_model.dart';
import '../../../orders/data/models/order_model.dart';
import 'subscription_event.dart';
import 'subscription_state.dart';

class SubscriptionBloc extends Bloc<SubscriptionEvent, SubscriptionState> {
  final SubscriptionRepository subscriptionRepository;

  SubscriptionBloc({required this.subscriptionRepository}) : super(SubscriptionInitial()) {
    on<LoadSubscriptions>(_onLoadSubscriptions);
    on<CreateSubscriptionRequested>(_onCreateSubscription);
    on<SubscriptionCheckoutRequested>(_onSubscriptionCheckout);
    on<PlaceOneTimeOrderRequested>(_onPlaceOneTimeOrder);
    on<PauseSubscriptionRequested>(_onPauseSubscription);
    on<ResumeSubscriptionRequested>(_onResumeSubscription);
    on<CancelSubscriptionItemRequested>(_onCancelSubscriptionItem);
    on<CancelSubscriptionRequested>(_onCancelSubscription);
    on<LoadPauseHistoryRequested>(_onLoadPauseHistory);
    on<UpdateAutoRenewRequested>(_onUpdateAutoRenew);
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

  // ══════════════════════════════════════════════════════════
  //  CREATE SUBSCRIPTION
  //
  //  Called from SubscriptionSetupScreen (dedicated flow).
  //  Passes paymentType, autoRenew, morningQty, eveningQty
  //  to the repository and extracts the subscription ID from
  //  the backend response for the success screen.
  // ══════════════════════════════════════════════════════════

  Future<void> _onCreateSubscription(CreateSubscriptionRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final result = await subscriptionRepository.createSubscription(
        customerId: event.customerId,
        branchId: event.branchId,
        variantId: event.variantId,
        quantity: event.quantity,
        morningQty: event.morningQty,
        eveningQty: event.eveningQty,
        scheduleType: event.scheduleType,
        deliverySlot: event.deliverySlot,
        startDate: event.startDate,
        unitPrice: event.unitPrice,
        customDays: event.customDays,
        paymentType: event.paymentType,
        autoRenew: event.autoRenew,
      );

      if (result['success'] == true || result['status'] == true || result['id'] != null) {
        final subscriptionId = result['id']?.toString()
            ?? result['subscription_id']?.toString()
            ?? result['data']?['id']?.toString();

        emit(SubscriptionActionSuccess(
          'Subscription created successfully',
          subscriptionId: subscriptionId,
          paymentType: event.paymentType,
          autoRenew: event.autoRenew,
        ));

        final results = await Future.wait([
          subscriptionRepository.getSubscriptions(),
          subscriptionRepository.getOrders(),
        ]);
        emit(SubscriptionLoaded(
          subscriptions: results[0] as List<Subscription>,
          orders: results[1] as List<Order>,
        ));
      } else {
        final errMsg = result['message']?.toString()
            ?? result['error']?.toString()
            ?? 'Failed to create subscription. Check your balance.';
        emit(SubscriptionError(errMsg));
      }
    } catch (e) {
      emit(SubscriptionError(extractErrorMessage(e)));
    }
  }

  // ══════════════════════════════════════════════════════════
  //  SUBSCRIPTION CHECKOUT — payment validation flow
  // ══════════════════════════════════════════════════════════

  Future<void> _onSubscriptionCheckout(SubscriptionCheckoutRequested event, Emitter<SubscriptionState> emit) async {
    emit(SubscriptionLoading());
    try {
      final result = await subscriptionRepository.checkoutSubscription(
        customerId: event.customerId,
        branchId: event.branchId,
        addressId: event.addressId,
        variantId: event.variantId,
        quantity: event.quantity,
        morningQty: event.morningQty,
        eveningQty: event.eveningQty,
        weeklySchedule: event.weeklySchedule,
        scheduleType: event.scheduleType,
        deliverySlot: event.deliverySlot,
        startDate: event.startDate,
        unitPrice: event.unitPrice,
        customDays: event.customDays,
        paymentType: event.paymentType,
        paymentMethod: event.paymentMethod,
        autoRenew: event.autoRenew,
        estimatedTotal: event.estimatedTotal,
        monthlyEstimate: event.monthlyEstimate,
      );


      // Handle structured error codes from backend
      final errorCode = result['error_code']?.toString();
      if (errorCode != null) {
        emit(SubscriptionCheckoutError(
          errorCode: errorCode,
          message: result['message']?.toString() ?? 'Checkout failed',
          walletBalance: (result['wallet_balance'] as num?)?.toDouble(),
          required_: (result['required'] as num?)?.toDouble(),
          creditLimit: (result['credit_limit'] as num?)?.toDouble(),
          existingCommitted: (result['existing_committed'] as num?)?.toDouble(),
        ));
        return;
      }

      if (result['success'] == true || result['status'] == true || result['id'] != null) {
        final subscriptionId = result['id']?.toString()
            ?? result['subscription_id']?.toString()
            ?? result['data']?['id']?.toString();

        emit(SubscriptionActionSuccess(
          'Subscription created successfully',
          subscriptionId: subscriptionId,
          paymentType: event.paymentType,
          autoRenew: event.autoRenew,
        ));

        try {
          final results = await Future.wait([
            subscriptionRepository.getSubscriptions(),
            subscriptionRepository.getOrders(),
          ]);
          emit(SubscriptionLoaded(
            subscriptions: results[0] as List<Subscription>,
            orders: results[1] as List<Order>,
          ));
        } catch (_) {
          // Keep SubscriptionActionSuccess state active if post-checkout refresh encounters a network delay
        }
      } else {
        final errMsg = result['message']?.toString()
            ?? result['error']?.toString()
            ?? 'Checkout failed. Please try again.';
        emit(SubscriptionError(errMsg));
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
      final success = await subscriptionRepository.resumeSubscription(
        event.subscriptionId,
        resumeDate: event.resumeDate,
      );
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

  Future<void> _onUpdateAutoRenew(UpdateAutoRenewRequested event, Emitter<SubscriptionState> emit) async {
    try {
      await subscriptionRepository.updateAutoRenew(event.subscriptionId, event.autoRenew);
      // Reload subscriptions to reflect updated auto_renew
      final results = await Future.wait([
        subscriptionRepository.getSubscriptions(),
        subscriptionRepository.getOrders(),
      ]);
      emit(SubscriptionLoaded(
        subscriptions: results[0] as List<Subscription>,
        orders: results[1] as List<Order>,
      ));
    } catch (e) {
      // Silently fail — auto renew toggle is best-effort
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
