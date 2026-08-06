import 'package:equatable/equatable.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

abstract class NetworkEvent extends Equatable {
  const NetworkEvent();

  @override
  List<Object?> get props => [];
}

class NetworkChanged extends NetworkEvent {
  final List<ConnectivityResult> results;
  const NetworkChanged({required this.results});

  @override
  List<Object?> get props => [results];
}
