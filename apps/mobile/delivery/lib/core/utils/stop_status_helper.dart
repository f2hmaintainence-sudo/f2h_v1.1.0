import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

/// Maps a delivery stop status string to a display [Color] and human-readable
/// label. Eliminates repeated `if (status == 'delivered') { color = kSuccess; }`
/// blocks spread across [MapDeliverySheet], [QueueItemTile], etc.
class StopStatusHelper {
  StopStatusHelper._();

  /// Brand color associated with [status].
  static Color colorFor(String status) {
    switch (status.toLowerCase().trim()) {
      case 'delivered':
      case 'completed':
        return kSuccess;
      case 'failed':
      case 'cancelled':
        return kDanger;
      case 'out_for_delivery':
        return kAccent;
      default:
        return kMuted;
    }
  }

  /// Short human-readable label for [status].
  static String labelFor(String status) {
    switch (status.toLowerCase().trim()) {
      case 'delivered':
      case 'completed':
        return 'Delivered';
      case 'failed':
      case 'cancelled':
        return 'Failed';
      case 'out_for_delivery':
        return 'Active';
      default:
        return 'Pending';
    }
  }

  /// Returns true when the stop has been successfully delivered/completed.
  static bool isDelivered(String status) =>
      status == 'delivered' || status == 'completed';

  /// Returns true when the stop has failed or was cancelled.
  static bool isFailed(String status) =>
      status == 'failed' || status == 'cancelled';
}
