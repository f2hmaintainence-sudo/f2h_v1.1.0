import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/auth/token_storage.dart';
import 'package:f2h_delivery/core/utils/dev_log.dart';

/// Singleton service handling WebSocket connection to NestJS Socket.IO gateway.
class SocketService {
  socket_io.Socket? _socket;
  bool _isConnecting = false;

  final _orderAssignedController = StreamController<Map<String, dynamic>>.broadcast();
  final _notificationController = StreamController<Map<String, dynamic>>.broadcast();

  /// Stream of real-time order assignment events
  Stream<Map<String, dynamic>> get orderAssignedStream => _orderAssignedController.stream;

  /// Stream of real-time general notification events
  Stream<Map<String, dynamic>> get notificationStream => _notificationController.stream;

  bool get isConnected => _socket?.connected ?? false;

  /// Initialize and connect socket if token is available
  Future<void> connect() async {
    if (isConnected || _isConnecting) return;
    _isConnecting = true;

    try {
      final token = await TokenStorage.getAccessToken();
      if (token == null || token.isEmpty) {
        _isConnecting = false;
        return;
      }

      final host = ApiEndpoints.host;

      _socket = socket_io.io(
        host,
        socket_io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .setPath('/socket.io')
            .setAuth({'token': token})
            .setExtraHeaders({'Authorization': 'Bearer $token'})
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(2000)
            .setReconnectionAttempts(20)
            .build(),
      );

      _socket?.onConnect((_) {
        _isConnecting = false;
      });

      _socket?.onDisconnect((reason) {
        _isConnecting = false;
      });

      _socket?.onConnectError((err) {
        _isConnecting = false;
      });

      // Listen for order assignment events
      _socket?.on('order_assigned', (data) {
        if (data != null && data is Map) {
          _orderAssignedController.add(Map<String, dynamic>.from(data));
        } else if (data != null) {
          _orderAssignedController.add({'data': data});
        }
      });

      _socket?.on('run_assigned', (data) {
        if (data != null && data is Map) {
          _orderAssignedController.add(Map<String, dynamic>.from(data));
        } else if (data != null) {
          _orderAssignedController.add({'data': data});
        }
      });

      // Listen for generic notification events
      _socket?.on('notification', (data) {
        if (data != null && data is Map) {
          final map = Map<String, dynamic>.from(data);
          _notificationController.add(map);

          // Any notification sent to delivery partner triggers order list refresh
          _orderAssignedController.add(map);
        }
      });

    } catch (e) {
      devLog('[SocketService] Connection exception: $e');
      _isConnecting = false;
    }
  }

  /// Disconnect socket
  void disconnect() {
    try {
      _socket?.disconnect();
      _socket?.dispose();
      _socket = null;
    } catch (_) {}
    _isConnecting = false;
  }

  /// Clean up resources
  void dispose() {
    disconnect();
    _orderAssignedController.close();
    _notificationController.close();
  }
}
