// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : offline_queue_manager.dart
// Description : Queues offline delivery mutations (status change, delivery proof)
//               and automatically syncs when the network returns.
//
//  Key upgrades over the original skeleton:
//   • PendingDeliveryMutation now carries retryCount / maxRetries so a
//     permanently-failing item is dropped after exhausting its budget.
//   • Exposes a pendingCount Stream<int> so the UI can react in real-time.
//   • Provides a static singleton accessor used by NetworkService.
//
// ============================================================================

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:dio/dio.dart';

// ── Model ────────────────────────────────────────────────────────────────────

class PendingDeliveryMutation {
  final String id;
  final String method;
  final String path;
  final Map<String, dynamic>? data;
  final DateTime createdAt;
  final int retryCount;
  final int maxRetries;

  const PendingDeliveryMutation({
    required this.id,
    required this.method,
    required this.path,
    this.data,
    required this.createdAt,
    this.retryCount = 0,
    this.maxRetries = 5,
  });

  PendingDeliveryMutation withIncrementedRetry() => PendingDeliveryMutation(
        id: id,
        method: method,
        path: path,
        data: data,
        createdAt: createdAt,
        retryCount: retryCount + 1,
        maxRetries: maxRetries,
      );

  bool get isExhausted => retryCount >= maxRetries;

  Map<String, dynamic> toJson() => {
        'id': id,
        'method': method,
        'path': path,
        'data': data,
        'createdAt': createdAt.toIso8601String(),
        'retryCount': retryCount,
        'maxRetries': maxRetries,
      };

  factory PendingDeliveryMutation.fromJson(Map<String, dynamic> json) =>
      PendingDeliveryMutation(
        id: json['id'] as String,
        method: json['method'] as String,
        path: json['path'] as String,
        data: json['data'] != null
            ? Map<String, dynamic>.from(json['data'] as Map)
            : null,
        createdAt: DateTime.parse(json['createdAt'] as String),
        retryCount: (json['retryCount'] as int?) ?? 0,
        maxRetries: (json['maxRetries'] as int?) ?? 5,
      );
}

// ── Manager ──────────────────────────────────────────────────────────────────

class OfflineQueueManager {
  static const String _kQueueKey = 'f2h_del_pending_mutations';

  // Singleton
  static final OfflineQueueManager _instance = OfflineQueueManager._internal();
  static OfflineQueueManager get instance => _instance;

  OfflineQueueManager._internal();

  /// Legacy factory kept for backward compatibility; returns the singleton.
  factory OfflineQueueManager({DioClient? dioClient}) {
    if (dioClient != null) {
      _instance._dioClient = dioClient;
    }
    return _instance;
  }

  DioClient _dioClient = DioClient();
  bool _isProcessing = false;

  // Stream for pending count
  final StreamController<int> _countController =
      StreamController<int>.broadcast();

  /// Emits the number of queued mutations whenever it changes.
  Stream<int> get pendingCountStream => _countController.stream;

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Persists a mutation that should be replayed once network returns.
  Future<void> enqueue({
    required String method,
    required String path,
    Map<String, dynamic>? data,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final rawList = prefs.getStringList(_kQueueKey) ?? [];
    final mutation = PendingDeliveryMutation(
      id: '${DateTime.now().millisecondsSinceEpoch}',
      method: method,
      path: path,
      data: data,
      createdAt: DateTime.now(),
    );
    rawList.add(jsonEncode(mutation.toJson()));
    await prefs.setStringList(_kQueueKey, rawList);
    _countController.add(rawList.length);
    debugPrint('[OfflineQueue] Enqueued $method $path (queue size: ${rawList.length})');
  }

  /// Replays all queued mutations against the API.
  /// Items that fail and have exhausted [maxRetries] are silently dropped.
  Future<void> flushQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final rawList = prefs.getStringList(_kQueueKey) ?? [];
      if (rawList.isEmpty) return;

      debugPrint('[OfflineQueue] Flushing ${rawList.length} pending mutations…');

      final remaining = <String>[];

      for (final itemStr in rawList) {
        PendingDeliveryMutation item;
        try {
          item = PendingDeliveryMutation.fromJson(
            jsonDecode(itemStr) as Map<String, dynamic>,
          );
        } catch (_) {
          // Corrupt entry — drop it.
          continue;
        }

        try {
          final response = await _dioClient.dio.request(
            item.path,
            data: item.data,
            options: Options(method: item.method),
          );

          final code = response.statusCode ?? 0;
          if (code >= 400) {
            // Server-side error — keep and retry unless exhausted.
            final updated = item.withIncrementedRetry();
            if (!updated.isExhausted) {
              remaining.add(jsonEncode(updated.toJson()));
            } else {
              debugPrint(
                '[OfflineQueue] Dropping ${item.method} ${item.path} after ${item.maxRetries} failed retries (HTTP $code).',
              );
            }
          } else {
            debugPrint('[OfflineQueue] ✓ Synced ${item.method} ${item.path}');
          }
        } catch (_) {
          // Network still down — keep for next flush, increment retry.
          final updated = item.withIncrementedRetry();
          if (!updated.isExhausted) {
            remaining.add(jsonEncode(updated.toJson()));
          }
        }
      }

      await prefs.setStringList(_kQueueKey, remaining);
      _countController.add(remaining.length);
      debugPrint('[OfflineQueue] Flush done. ${remaining.length} item(s) remaining.');
    } finally {
      _isProcessing = false;
    }
  }

  /// Returns the current count of pending mutations without triggering a flush.
  Future<int> getPendingCount() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_kQueueKey) ?? []).length;
  }

  /// Clears all queued mutations (e.g., on logout).
  Future<void> clearQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kQueueKey);
    _countController.add(0);
  }
}
