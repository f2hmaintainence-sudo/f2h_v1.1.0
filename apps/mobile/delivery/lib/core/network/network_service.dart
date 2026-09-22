// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : network_service.dart
// Description : Monitors network connectivity for the delivery app.
//               - Wraps connectivity_plus to detect online/offline transitions.
//               - Automatically triggers OfflineQueueManager.flushQueue() the
//                 moment connectivity is restored so pending mutations (delivery
//                 status changes recorded while offline) are sent to the server
//                 without any manual driver action.
//               - Exposes an isOnlineStream so UI widgets can react immediately.
//
// Usage:
//   // In injection.dart:
//   sl.registerLazySingleton(() => NetworkService());
//   await sl<NetworkService>().init();
//
//   // In a widget:
//   StreamBuilder<bool>(
//     stream: sl<NetworkService>().isOnlineStream,
//     builder: (context, snap) { ... },
//   )
//
// ============================================================================

import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:f2h_delivery/core/cache/offline_queue_manager.dart';

class NetworkService {
  final Connectivity _connectivity;
  final OfflineQueueManager _queue;

  final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  bool _isOnline = true; // optimistic default until first check
  StreamSubscription<List<ConnectivityResult>>? _sub;

  NetworkService({
    Connectivity? connectivity,
    OfflineQueueManager? queue,
  })  : _connectivity = connectivity ?? Connectivity(),
        _queue = queue ?? OfflineQueueManager.instance;

  // ── Public surface ──────────────────────────────────────────────────────────

  /// Emits `true` when online, `false` when offline.
  Stream<bool> get isOnlineStream => _controller.stream;

  /// Synchronous snapshot of the current connectivity state.
  bool get isOnline => _isOnline;

  /// Initialise: check current state and begin watching for changes.
  /// Call once during app bootstrap (e.g., in [injection.dart]).
  Future<void> init() async {
    // Seed from current connectivity.
    final results = await _connectivity.checkConnectivity();
    _updateFromResults(results, flush: false);

    // Subscribe to future changes.
    _sub = _connectivity.onConnectivityChanged.listen(
      (results) => _updateFromResults(results, flush: true),
      onError: (_) {/* keep running */},
    );

    debugPrint('[NetworkService] Initialised. isOnline=$_isOnline');
  }

  /// Manually dispose the subscription (call on app shutdown if needed).
  void dispose() {
    _sub?.cancel();
    _controller.close();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  void _updateFromResults(List<ConnectivityResult> results, {required bool flush}) {
    final wasOnline = _isOnline;
    _isOnline = results.any((r) => r != ConnectivityResult.none);
    _controller.add(_isOnline);

    debugPrint('[NetworkService] Connectivity changed → isOnline=$_isOnline');

    // Only flush when transitioning from offline → online.
    if (!wasOnline && _isOnline && flush) {
      debugPrint('[NetworkService] Network restored — flushing offline queue…');
      _queue.flushQueue().catchError((e) {
        debugPrint('[NetworkService] flushQueue error: $e');
      });
    }
  }
}
