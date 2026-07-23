// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : offline_queue_manager.dart
// Description : Queues offline delivery updates (status change, delivery proof)
//               and automatically syncs when network returns.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:dio/dio.dart';

class PendingDeliveryMutation {
  final String id;
  final String method;
  final String path;
  final Map<String, dynamic>? data;
  final DateTime createdAt;

  PendingDeliveryMutation({
    required this.id,
    required this.method,
    required this.path,
    this.data,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'method': method,
        'path': path,
        'data': data,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PendingDeliveryMutation.fromJson(Map<String, dynamic> json) =>
      PendingDeliveryMutation(
        id: json['id'],
        method: json['method'],
        path: json['path'],
        data: json['data'] != null ? Map<String, dynamic>.from(json['data']) : null,
        createdAt: DateTime.parse(json['createdAt']),
      );
}

class OfflineQueueManager {
  static const String _kQueueKey = 'f2h_del_pending_mutations';
  final DioClient _dioClient;
  bool _isProcessing = false;

  OfflineQueueManager({DioClient? dioClient}) : _dioClient = dioClient ?? DioClient();

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
  }

  Future<void> flushQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final rawList = prefs.getStringList(_kQueueKey) ?? [];
      if (rawList.isEmpty) return;

      final remaining = <String>[];
      for (final itemStr in rawList) {
        try {
          final item = PendingDeliveryMutation.fromJson(jsonDecode(itemStr));
          final response = await _dioClient.dio.request(
            item.path,
            data: item.data,
            options: Options(method: item.method),
          );

          if (response.statusCode != null && response.statusCode! >= 400) {
            remaining.add(itemStr);
          }
        } catch (_) {
          remaining.add(itemStr);
        }
      }

      await prefs.setStringList(_kQueueKey, remaining);
    } finally {
      _isProcessing = false;
    }
  }
}
