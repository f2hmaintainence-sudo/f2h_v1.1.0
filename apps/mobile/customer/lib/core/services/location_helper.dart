import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class LocationHelper {
  /// Ensures both device location service (GPS) and app location permission
  /// are active. If either is disabled or denied, shows a clear, user-friendly
  /// prompt with a direct 1-tap button to open device location settings or app settings.
  ///
  /// Works safely on both Mobile (Android/iOS) and Flutter Web (`kIsWeb`).
  ///
  /// Returns the current [Position] if successful, or `null` if the user dismissed or refused.
  static Future<Position?> getCurrentPositionWithPrompt(BuildContext context) async {
    // 1. Check if device location service (GPS) is enabled
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (!context.mounted) return null;
      final bool? opened = await showLocationServiceDialog(context);
      if (opened == true && !kIsWeb) {
        try {
          await Geolocator.openLocationSettings();
        } catch (_) {}
      }
      return null;
    }

    // 2. Check and request location permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (!context.mounted) return null;
        final bool? opened = await showLocationPermissionDialog(
          context,
          isPermanentlyDenied: false,
        );
        if (opened == true) {
          if (!kIsWeb) {
            try {
              await Geolocator.openAppSettings();
            } catch (_) {}
          } else {
            try {
              permission = await Geolocator.requestPermission();
            } catch (_) {}
          }
        }
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if (!context.mounted) return null;
      final bool? opened = await showLocationPermissionDialog(
        context,
        isPermanentlyDenied: true,
      );
      if (opened == true && !kIsWeb) {
        try {
          await Geolocator.openAppSettings();
        } catch (_) {}
      }
      return null;
    }

    // 3. Get high accuracy position with a safe timeout
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
    } catch (_) {
      try {
        return await Geolocator.getLastKnownPosition();
      } catch (_) {
        return null;
      }
    }
  }

  /// Shows a modal dialog prompting the user to turn on GPS Location Service.
  static Future<bool?> showLocationServiceDialog(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: kPrimaryPl,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.location_off_rounded,
                color: kPrimary,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Location Service Disabled',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              kIsWeb
                  ? 'Please enable GPS / Location on your device or browser so we can find your delivery address.'
                  : 'Please turn ON your device GPS / Location Services so we can find your exact delivery address and assign your nearest branch.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kTextSub,
                      side: const BorderSide(color: kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      kIsWeb ? 'Got it' : 'Turn ON Location',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Shows a modal dialog prompting the user to grant location permission.
  static Future<bool?> showLocationPermissionDialog(
    BuildContext context, {
    required bool isPermanentlyDenied,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.near_me_rounded,
                color: Colors.amber.shade800,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Location Permission Needed',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              kIsWeb
                  ? (isPermanentlyDenied
                      ? 'Location permission is blocked in your browser. Please tap the lock / tune icon in your browser URL address bar and allow Location.'
                      : 'Please allow browser location permission when prompted so we can pinpoint your delivery address.')
                  : (isPermanentlyDenied
                      ? 'Location permission is turned off for this app. Please enable Location in App Settings to detect your delivery address.'
                      : 'Location permission is needed to accurately detect your delivery address and find nearby products. Please enable it in Settings.'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kTextSub,
                      side: const BorderSide(color: kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text('Not Now', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      kIsWeb ? 'Got it' : 'Open Settings',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
