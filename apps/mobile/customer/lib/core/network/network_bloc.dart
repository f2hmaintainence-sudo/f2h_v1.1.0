import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:f2h_customer/core/network/network_event.dart';
import 'package:f2h_customer/core/network/network_state.dart';

class NetworkBloc extends Bloc<NetworkEvent, NetworkState> {
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  NetworkBloc({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity(),
        super(NetworkInitial()) {
    on<NetworkChanged>((event, emit) {
      if (event.results.every((r) => r == ConnectivityResult.none)) {
        emit(NetworkOffline());
      } else {
        emit(NetworkOnline());
      }
    });

    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      add(NetworkChanged(results: results));
    });
    
    _checkInitialConnection();
  }

  void _checkInitialConnection() async {
    final results = await _connectivity.checkConnectivity();
    add(NetworkChanged(results: results));
  }

  @override
  Future<void> close() {
    _subscription?.cancel();
    return super.close();
  }
}
