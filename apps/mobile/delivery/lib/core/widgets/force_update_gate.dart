// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : force_update_gate.dart
// Description : Blocks an unsupported build from reaching the partner app.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:f2h_delivery/core/utils/app_update_service.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

/// Keeps an already-running session honest.
///
/// The splash screen decides whether a build may start at all. This wrapper
/// covers the other case: a partner who was inside the app when the build was
/// retired, and who would otherwise keep running it until the process is
/// killed — which for a delivery partner can be the whole shift.
class ForceUpdateGate extends StatefulWidget {
  final Widget child;

  const ForceUpdateGate({super.key, required this.child});

  @override
  State<ForceUpdateGate> createState() => _ForceUpdateGateState();
}

class _ForceUpdateGateState extends State<ForceUpdateGate> with WidgetsBindingObserver {
  bool _blocked = false;
  AppUpdateStatus? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Once blocked it stays blocked — resuming must not be a way back in.
    if (state == AppLifecycleState.resumed && !_blocked) {
      _recheck();
    }
  }

  Future<void> _recheck() async {
    final result = await AppUpdateService.check();
    if (!mounted || !result.mustUpdate) return;
    setState(() {
      _blocked = true;
      _status = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_blocked && _status != null) {
      return MandatoryUpdateScreen(status: _status!);
    }
    return widget.child;
  }
}

/// The one screen an unsupported build can reach.
///
/// It offers a single action. There is deliberately no "Later", no close icon,
/// no back gesture and no barrier to tap away — the build cannot talk to the
/// current dispatch API correctly, so continuing is not an outcome worth
/// offering to someone about to run deliveries against it.
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
        : 'This version of the F2H Partner app is no longer supported. Please update to continue delivering.';

    // canPop: false takes the system back gesture and the hardware back button
    // out of play, so the gate cannot be dismissed into the app behind it.
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: kSurface,
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
                        color: kPrimary.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
                      ),
                      child: const Center(
                        child: Icon(Icons.system_update_rounded, size: 44, color: kPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.roboto(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.roboto(
                      fontSize: 14,
                      height: 1.5,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  if (status.releaseNotes.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text(
                      "WHAT'S NEW",
                      style: GoogleFonts.roboto(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 160),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: kBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: SingleChildScrollView(
                        child: Text(
                          status.releaseNotes,
                          style: GoogleFonts.roboto(
                            fontSize: 12,
                            height: 1.5,
                            color: const Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: () => _openStore(context),
                    child: Text(
                      'Update Now',
                      style: GoogleFonts.roboto(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  if (status.installedVersion.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text(
                      status.latestVersion.isNotEmpty
                          ? 'Installed ${status.installedVersion} · Latest ${status.latestVersion}'
                          : 'Installed ${status.installedVersion}',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.roboto(fontSize: 11, color: const Color(0xFF94A3B8)),
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
