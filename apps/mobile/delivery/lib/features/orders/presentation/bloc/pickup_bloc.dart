import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';

part 'pickup_event.dart';
part 'pickup_state.dart';

class PickupBloc extends Bloc<PickupEvent, PickupState> {
  final OrdersRepository ordersRepository;

  PickupBloc({required this.ordersRepository}) : super(PickupInitial()) {
    on<LoadPickupItems>(_onLoadPickupItems);
    on<ConfirmPickup>(_onConfirmPickup);
  }

  Future<void> _onLoadPickupItems(
    LoadPickupItems event,
    Emitter<PickupState> emit,
  ) async {
    emit(PickupLoading());
    try {
      final response = await ordersRepository.getPickupItems(date: event.date);
      if (response.status && response.runId != null) {
        emit(PickupLoaded(response: response));
      } else {
        emit(PickupNoRun(message: response.message ?? 'No delivery run found'));
      }
    } catch (e) {
      emit(PickupError(message: e.toString()));
    }
  }

  Future<void> _onConfirmPickup(
    ConfirmPickup event,
    Emitter<PickupState> emit,
  ) async {
    if (state is PickupLoaded) {
      final currentState = state as PickupLoaded;
      emit(PickupConfirming(response: currentState.response));
      
      try {
        final success = await ordersRepository.confirmPickup(
          runId: event.runId,
          items: event.items,
          latitude: event.latitude,
          longitude: event.longitude,
        );
        
        if (success) {
          await MockDataService().loadBackendData();
          emit(PickupConfirmed(response: currentState.response));
        } else {
          emit(PickupError(message: 'Failed to confirm pickup'));
        }
      } catch (e) {
        emit(PickupError(message: e.toString()));
      }
    }
  }
}
