import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_customer/theme/app_colors.dart';

/// Waits for the app to come back to the foreground.
///
/// Sending the user to system settings pauses the app; the grant only becomes
/// visible once it resumes. A bare `resumed` event is not enough to act on —
/// the framework can deliver one before the settings screen ever appears — so
/// this waits for a real leave-and-return: some non-resumed state first, then
/// `resumed`.
class _AppResumeWaiter with WidgetsBindingObserver {
  final Completer<void> _completer = Completer<void>();
  bool _leftForeground = false;

  void start() => WidgetsBinding.instance.addObserver(this);
  void dispose() => WidgetsBinding.instance.removeObserver(this);

  Future<bool> wait(Duration timeout) async {
    try {
      await _completer.future.timeout(timeout);
      return true;
    } on TimeoutException {
      return false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _leftForeground = true;
      return;
    }
    if (_leftForeground && !_completer.isCompleted) {
      _completer.complete();
    }
  }
}

/// What a position read actually produced. A refusal and a failed fix need
/// very different messages, and the web plugin does not distinguish them.
enum _PositionOutcome { ok, permissionDenied, unavailable }

class _PositionResult {
  final _PositionOutcome outcome;
  final Position? position;
  const _PositionResult(this.outcome, [this.position]);
}

class LocationHelper {
  /// Initial check plus one re-check after the user has been to settings.
  /// Bounded so a permission the user never grants cannot loop the prompt.
  static const int _maxAttempts = 2;

  /// How long to wait for the user to finish in settings before giving up on
  /// the automatic re-check. They can always tap the feature again.
  static const Duration _settingsReturnTimeout = Duration(minutes: 3);

  /// Budget for a single fix.
  static const Duration _positionTimeout = Duration(seconds: 15);

  /// Ensures location access is usable, then returns the current [Position].
  ///
  /// State is re-read from the platform on every call and on every attempt
  /// within a call, so the feature can never be entered on a stale grant.
  ///
  /// If access is off the user gets an explanatory prompt with a one-tap route
  /// to the right settings screen. After they return, permission is re-checked
  /// automatically and the position is delivered without the feature having to
  /// be started again.
  ///
  /// Returns null if the user declined or access is still not granted — never
  /// silently: a prompt or a message is always shown first.
  static Future<Position?> getCurrentPositionWithPrompt(BuildContext context) async {
    for (var attempt = 0; attempt < _maxAttempts; attempt++) {
      final bool isFinalAttempt = attempt == _maxAttempts - 1;

      // 1. Device location service (GPS). Always reported enabled on web.
      if (!await _isServiceEnabled()) {
        if (!context.mounted) return null;
        final bool? wantsToFix = await showLocationServiceDialog(context);
        if (wantsToFix != true) return null;
        if (isFinalAttempt) {
          await _openSettings(serviceSettings: true);
          return null;
        }
        if (!await _openSettingsAndAwaitReturn(serviceSettings: true)) return null;
        continue;
      }

      // 2. Permission. Null means the platform could not tell us — Safari does
      //    not accept 'geolocation' in the Permissions API, so the query throws
      //    there. Unknown is not the same as denied: fall through and let the
      //    browser raise its own prompt during the read below.
      LocationPermission? permission = await _checkPermission();

      if (!kIsWeb && permission == LocationPermission.denied) {
        permission = await _requestPermission();
      }

      // On web the plugin implements requestPermission() as a position read
      // that reports EVERY failure — including a timeout — as deniedForever,
      // so it is never called here. Only a definite 'denied' state short
      // circuits; anything else goes to the read and is judged on its result.
      final bool definitelyBlocked = kIsWeb
          ? permission == LocationPermission.deniedForever
          : (permission == LocationPermission.denied ||
              permission == LocationPermission.deniedForever);

      if (definitelyBlocked) {
        if (!context.mounted) return null;
        final bool? wantsToFix = await showLocationPermissionDialog(
          context,
          isPermanentlyDenied: permission == LocationPermission.deniedForever,
        );
        if (wantsToFix != true) return null;
        if (isFinalAttempt) {
          await _openSettings(serviceSettings: false);
          return null;
        }
        if (!await _openSettingsAndAwaitReturn(serviceSettings: false)) return null;
        continue;
      }

      // 3. Read the position and judge the outcome.
      final result = await _readPosition();

      if (result.outcome == _PositionOutcome.ok) return result.position;

      if (result.outcome == _PositionOutcome.permissionDenied) {
        if (!context.mounted) return null;
        final bool? wantsToFix = await showLocationPermissionDialog(
          context,
          isPermanentlyDenied: true,
        );
        if (wantsToFix != true) return null;
        if (isFinalAttempt) {
          await _openSettings(serviceSettings: false);
          return null;
        }
        if (!await _openSettingsAndAwaitReturn(serviceSettings: false)) return null;
        continue;
      }

      // Permission is fine, the fix just did not arrive. Saying "blocked"
      // here would send the user to settings that are already correct.
      if (context.mounted) {
        _showMessage(
          context,
          'Could not get your location. Please move to an open area and try again.',
        );
      }
      return null;
    }
    return null;
  }

  /// Whether location can be used right now, without prompting.
  static Future<bool> isLocationReady() async {
    if (!await _isServiceEnabled()) return false;
    final permission = await _checkPermission();
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  static Future<bool> _isServiceEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (_) {
      // Never block the flow on a failed probe — the read below is the real
      // test of whether location works.
      return true;
    }
  }

  /// Returns null when the platform cannot report a permission state, rather
  /// than letting the throw escape and abort the whole flow.
  static Future<LocationPermission?> _checkPermission() async {
    try {
      return await Geolocator.checkPermission();
    } catch (_) {
      return null;
    }
  }

  static Future<LocationPermission?> _requestPermission() async {
    try {
      return await Geolocator.requestPermission();
    } catch (_) {
      return null;
    }
  }

  /// Reads a position, mapping the platform's typed errors onto outcomes.
  ///
  /// The browser timeout cannot be relied on: the web plugin passes
  /// `Duration.inMicroseconds` into a field the browser reads as
  /// milliseconds, turning a 15 second limit into roughly four hours. The
  /// Dart-side timeout below is what actually bounds the wait.
  static Future<_PositionResult> _readPosition() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: _positionTimeout,
        ),
      ).timeout(_positionTimeout + const Duration(seconds: 3));
      return _PositionResult(_PositionOutcome.ok, position);
    } on PermissionDeniedException {
      return const _PositionResult(_PositionOutcome.permissionDenied);
    } catch (_) {
      // Timed out or the fix failed. A stale position still beats nothing.
      return _lastKnownPosition();
    }
  }

  static Future<_PositionResult> _lastKnownPosition() async {
    try {
      // Unsupported on web, where it throws rather than returning null.
      final position = await Geolocator.getLastKnownPosition();
      if (position != null) return _PositionResult(_PositionOutcome.ok, position);
    } catch (_) {}
    return const _PositionResult(_PositionOutcome.unavailable);
  }

  /// Sends the user where they can grant access and reports whether it is worth
  /// re-checking afterwards.
  ///
  /// On mobile this opens the system settings and waits for the app to come
  /// back. The web has no settings screen to open — permission is changed from
  /// the browser's own address-bar control, which does not background the tab —
  /// so the best available move is to re-check on the spot.
  static Future<bool> _openSettingsAndAwaitReturn({required bool serviceSettings}) async {
    if (kIsWeb) return true;

    // Registered before the settings screen launches, so the app leaving the
    // foreground cannot be missed.
    final waiter = _AppResumeWaiter()..start();
    if (!await _openSettings(serviceSettings: serviceSettings)) {
      waiter.dispose();
      return false;
    }

    try {
      return await waiter.wait(_settingsReturnTimeout);
    } finally {
      waiter.dispose();
    }
  }

  /// Launches the relevant settings screen. Returns false if the platform
  /// refused (there is nothing to open on web).
  static Future<bool> _openSettings({required bool serviceSettings}) async {
    if (kIsWeb) return false;
    try {
      return serviceSettings
          ? await Geolocator.openLocationSettings()
          : await Geolocator.openAppSettings();
    } catch (_) {
      return false;
    }
  }

  static void _showMessage(BuildContext context, String message) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
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
                      kIsWeb ? 'Enable Location' : 'Turn ON Location',
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
                      kIsWeb ? 'Allow Location' : 'Open Settings',
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
