import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';

part 'handover_event.dart';
part 'handover_state.dart';

class HandoverBloc extends Bloc<HandoverEvent, HandoverState> {
  final OrdersRepository ordersRepository;
  final DeliverySessionBloc deliverySessionBloc;

  HandoverBloc({
    required this.ordersRepository,
    required this.deliverySessionBloc,
  }) : super(HandoverInitial()) {
    on<SubmitHandover>(_onSubmitHandover);
  }

  Future<void> _onSubmitHandover(
    SubmitHandover event,
    Emitter<HandoverState> emit,
  ) async {
    emit(HandoverLoading());
    final completer = Completer<void>();

    deliverySessionBloc.add(HandoverRunEvent(
      event.runId,
      onSuccess: (result) {
        emit(HandoverSuccess(result));
        completer.complete();
      },
      onError: (error) {
        emit(HandoverFailure(error));
        completer.complete();
      },
    ));

    await completer.future;
  }
}
