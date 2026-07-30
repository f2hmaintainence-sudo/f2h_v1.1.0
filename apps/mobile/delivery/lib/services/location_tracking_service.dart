import 'dart:async';
import 'package:battery_plus/battery_plus.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_delivery/auth/data/models/user_model.dart';

class LocationTrackingService {
  final LocationService _locationService;
  final DioClient _dioClient;
  final AuthLocalDataSource _authLocalDataSource;
  final Battery _battery = Battery();
  Timer? _locationTimer;
  bool _isTracking = false;
  String? _userId;

  LocationTrackingService({
    required LocationService locationService,
    required DioClient dioClient,
    required AuthLocalDataSource authLocalDataSource,
  })  : _locationService = locationService,
        _dioClient = dioClient,
        _authLocalDataSource = authLocalDataSource;

  /// Start location tracking with periodic updates every 1 minute
  Future<void> startTracking() async {
    if (_isTracking) return;

    // Get user ID from local storage
    final user = await _getCachedUser();
    if (user == null) {
      print('LocationTrackingService: No user found, cannot start tracking');
      return;
    }

    _userId = user.userId;
    _isTracking = true;

    // Send initial location immediately
    await _sendLocationUpdate();

    // Start periodic updates every 3 minute
    _locationTimer = Timer.periodic(const Duration(minutes: 3), (_) async {
      if (_isTracking) {
        await _sendLocationUpdate();
      }
    });

    print('LocationTrackingService: Started tracking for user $_userId');
  }

  /// Stop location tracking
  Future<void> stopTracking() async {
    if (!_isTracking) return;

    _isTracking = false;
    _locationTimer?.cancel();
    _locationTimer = null;
    _userId = null;

    print('LocationTrackingService: Stopped tracking');
  }

  /// Check if tracking is currently active
  bool get isTracking => _isTracking;

  /// Send location update to backend
  Future<void> _sendLocationUpdate() async {
    try {
      final position = await _locationService.getCurrentPosition();
      
      if (position == null) {
        print('LocationTrackingService: Failed to get current position');
        return;
      }

      int batteryLevel = 100;
      try {
        batteryLevel = await _battery.batteryLevel;
      } catch (e) {
        print('LocationTrackingService: Error getting battery level - $e');
      }

      // Convert speed from m/s to km/h
      double speedKmh = position.speed > 0 ? (position.speed * 3.6) : 0.0;

      final response = await _dioClient.dio.post(
        ApiEndpoints.locationUpdate,
        data: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'battery': batteryLevel,
          'speed': speedKmh.round(),
        },
      );

      print('LocationTrackingService: Location updated - ${position.latitude}, ${position.longitude}, Battery: $batteryLevel%, Speed: ${speedKmh.round()} km/h');
    } catch (e) {
      print('LocationTrackingService: Error sending location update - $e');
    }
  }

  /// Get cached user from local storage
  Future<UserModel?> _getCachedUser() async {
    try {
      return await _authLocalDataSource.getCachedUser();
    } catch (e) {
      print('LocationTrackingService: Error getting cached user - $e');
      return null;
    }
  }

  /// Dispose resources
  void dispose() {
    stopTracking();
  }
}
