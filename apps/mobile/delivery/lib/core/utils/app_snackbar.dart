import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

/// Centralized snackbar utility — replaces repeated [ScaffoldMessenger] calls.
///
/// Usage:
/// ```dart
/// AppSnackBar.success(context, 'Delivery confirmed!');
/// AppSnackBar.error(context, 'Failed to load orders: $e');
/// AppSnackBar.info(context, 'Refreshing status...');
/// AppSnackBar.show(context, 'Custom message', backgroundColor: kAccent);
/// ```
class AppSnackBar {
  AppSnackBar._();

  static void show(
    BuildContext context,
    String message, {
    Color? backgroundColor,
    Duration duration = const Duration(seconds: 2),
  }) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: backgroundColor,
          behavior: SnackBarBehavior.floating,
          duration: duration,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
  }

  /// Green success snackbar.
  static void success(BuildContext context, String message) =>
      show(context, message, backgroundColor: kSuccess);

  /// Red error snackbar.
  static void error(BuildContext context, String message) =>
      show(context, message, backgroundColor: kDanger);

  /// Neutral info snackbar (1 second duration).
  static void info(
    BuildContext context,
    String message, {
    Color? color,
  }) =>
      show(
        context,
        message,
        backgroundColor: color ?? kPrimaryMid,
        duration: const Duration(seconds: 1),
      );
}
