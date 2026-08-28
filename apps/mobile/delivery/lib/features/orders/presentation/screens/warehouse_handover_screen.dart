import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/containers_tracker_modal.dart';

class WarehouseHandoverScreen extends StatelessWidget {
  const WarehouseHandoverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final sessionState = context.watch<DeliverySessionBloc>().state;
    final groupedStops = sessionState is DeliverySessionLoaded
        ? sessionState.groupedStops
        : <GroupedStop>[];
    final currentRun = sessionState is DeliverySessionLoaded
        ? sessionState.currentRun
        : null;

    return ContainersTrackerModal(
      groupedStops: groupedStops,
      currentRun: currentRun,
    );
  }
}
