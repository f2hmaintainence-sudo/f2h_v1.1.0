import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';

part 'handover_event.dart';
part 'handover_state.dart';

class HandoverBloc extends Bloc<HandoverEvent, HandoverState> {
  final OrdersRepository ordersRepository;

  HandoverBloc({required this.ordersRepository}) : super(HandoverInitial()) {
    on<SubmitHandover>(_onSubmitHandover);
  }

  Future<void> _onSubmitHandover(
    SubmitHandover event,
    Emitter<HandoverState> emit,
  ) async {
    emit(HandoverLoading());
    try {
      final result = await MockDataService().handoverRun(event.runId);
      if (result.success) {
        emit(HandoverSuccess(result));
      } else {
        emit(HandoverFailure(result.message.isNotEmpty ? result.message : 'Failed to complete handover'));
      }
    } catch (e) {
      emit(HandoverFailure(e.toString()));
    }
  }
}
