part of 'pickup_bloc.dart';

abstract class PickupEvent {}

class LoadPickupItems extends PickupEvent {
  final String? date;
  LoadPickupItems({this.date});
}

class ConfirmPickup extends PickupEvent {
  final String runId;
  final List<PickupItem> items;
  final double? latitude;
  final double? longitude;

  ConfirmPickup({
    required this.runId,
    required this.items,
    this.latitude,
    this.longitude,
  });
}
