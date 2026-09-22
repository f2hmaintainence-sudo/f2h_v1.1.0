// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : offline_banner.dart
// Description : Displays an animated amber banner at the top of any screen
//               when the device has no network connectivity.
//               Automatically hides once the connection is restored.
//               Subscribes to NetworkService.isOnlineStream (registered in DI).
//
// Usage:
//   Column(
//     children: [
//       const OfflineBanner(),
//       Expanded(child: YourScreen()),
//     ],
//   )
//
// ============================================================================

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:f2h_delivery/core/network/network_service.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final NetworkService? networkService = GetIt.I.isRegistered<NetworkService>()
        ? GetIt.I<NetworkService>()
        : null;

    if (networkService == null) return const SizedBox.shrink();

    return StreamBuilder<bool>(
      stream: networkService.isOnlineStream,
      initialData: networkService.isOnline,
      builder: (context, snap) {
        final isOnline = snap.data ?? true;
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          transitionBuilder: (child, animation) => SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, -1),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeOut,
            )),
            child: child,
          ),
          child: isOnline
              ? const SizedBox.shrink(key: ValueKey('online'))
              : _BannerContent(key: const ValueKey('offline')),
        );
      },
    );
  }
}

class _BannerContent extends StatelessWidget {
  const _BannerContent({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFF59E0B), // amber-500
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            const Icon(
              Icons.wifi_off_rounded,
              color: Colors.white,
              size: 18,
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'No network — delivery updates will sync automatically when connection returns.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
