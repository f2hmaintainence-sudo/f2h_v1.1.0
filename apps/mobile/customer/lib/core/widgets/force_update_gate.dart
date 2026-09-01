// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : force_update_gate.dart
// Description : Blocks an unsupported build from reaching the app at all.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:f2h_customer/core/utils/app_update_service.dart';

/// Stands between the splash screen and everything else.
///
/// The check has to happen here rather than inside the home screen: a customer
/// on an unsupported build must never reach the catalog, the cart or checkout,
/// because those are exactly the flows an outdated client gets wrong.
///
/// While the check is in flight the gate shows [pending] — in practice the
/// splash animation is still on screen, so the customer sees no extra wait.
class ForceUpdateGate extends StatefulWidget {
  final Widget child;

  /// Shown while the verdict is unknown. Never shown for longer than the
  /// service timeout, because the check resolves to "allowed" on any failure.
  final Widget pending;

  const ForceUpdateGate({
    super.key,
    required this.child,
    required this.pending,
  });

  @override
  State<ForceUpdateGate> createState() => _ForceUpdateGateState();
}

class _ForceUpdateGateState extends State<ForceUpdateGate> with WidgetsBindingObserver {
  AppUpdateStatus? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _runCheck();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-checked on resume so a build that is retired while the app sits in the
    // background is caught when the customer comes back, instead of running on
    // until the process is killed. Once blocked it stays blocked — a resume
    // must not be a way out of the gate.
    if (state == AppLifecycleState.resumed && _status?.mustUpdate != true) {
      _runCheck();
    }
  }

  Future<void> _runCheck() async {
    final result = await AppUpdateService.check();
    if (!mounted) return;
    setState(() => _status = result);
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    if (status == null) return widget.pending;
    if (status.mustUpdate) return MandatoryUpdateScreen(status: status);
    return widget.child;
  }
}

/// The one screen an unsupported build can reach.
///
/// It offers a single action. There is deliberately no "Later", no close icon,
/// no back gesture and no barrier to tap away — the build cannot talk to the
/// current API correctly, so continuing is not an outcome worth offering.
class MandatoryUpdateScreen extends StatelessWidget {
  final AppUpdateStatus status;

  const MandatoryUpdateScreen({super.key, required this.status});

  Future<void> _openStore(BuildContext context) async {
    final target = status.storeUrl.trim().isNotEmpty
        ? status.storeUrl.trim()
        : AppUpdateService.playStoreFallbackUrl;

    for (final url in <String>{target, AppUpdateService.playStoreFallbackUrl}) {
      try {
        final launched = await launchUrl(
          Uri.parse(url),
          mode: LaunchMode.externalApplication,
        );
        if (launched) return;
      } catch (_) {
        // Try the next candidate.
      }
    }

    if (!context.mounted) return;
    // Every launch route failed — the Play Store may be missing or disabled on
    // this device. Hand over the link so the update is still reachable.
    await Clipboard.setData(
      const ClipboardData(text: AppUpdateService.playStoreFallbackUrl),
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open the Play Store. Update link copied — paste it in your browser.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = status.title.isNotEmpty ? status.title : 'Update Required';
    final message = status.message.isNotEmpty
        ? status.message
        : 'This version of F2H Fresh is no longer supported. Please update to continue ordering.';

    // canPop: false takes the system back gesture and the hardware back button
    // out of play, so the gate cannot be dismissed into the app behind it.
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: const Color(0xFFC8E6C9)),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.system_update_rounded,
                          size: 44,
                          color: Color(0xFF0C831F),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  if (status.releaseNotes.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      "WHAT'S NEW",
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 160),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: SingleChildScrollView(
                        child: Text(
                          status.releaseNotes,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.5,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0C831F),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: () => _openStore(context),
                    child: const Text(
                      'Update Now',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  if (status.installedVersion.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text(
                      status.latestVersion.isNotEmpty
                          ? 'Installed ${status.installedVersion} · Latest ${status.latestVersion}'
                          : 'Installed ${status.installedVersion}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
