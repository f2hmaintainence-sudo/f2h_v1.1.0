import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/checkout/place_checkout_usecase.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_state.dart';

class CheckoutBloc extends Bloc<CheckoutEvent, CheckoutState> {
  final PlaceCheckoutUseCase placeCheckoutUseCase;

  CheckoutBloc({
    required this.placeCheckoutUseCase,
  }) : super(CheckoutInitialState()) {
    on<PlaceCheckoutEvent>(_onPlaceCheckout);
  }

  Future<void> _onPlaceCheckout(
    PlaceCheckoutEvent event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(CheckoutLoadingState());
    try {
      final response = await placeCheckoutUseCase(event.request);
      emit(CheckoutSuccessState(response));
    } catch (e) {
      emit(CheckoutErrorState(extractErrorMessage(e, fallback: 'Checkout failed. Please try again.')));
    }
  }
}
