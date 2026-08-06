abstract class CheckoutState {}

class CheckoutInitialState extends CheckoutState {}

class CheckoutLoadingState extends CheckoutState {}

class CheckoutSuccessState extends CheckoutState {
  final Map<String, dynamic> responseData;

  CheckoutSuccessState(this.responseData);
}

class CheckoutErrorState extends CheckoutState {
  final String message;

  CheckoutErrorState(this.message);
}
