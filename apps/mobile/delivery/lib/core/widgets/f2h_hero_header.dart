// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : f2h_hero_header.dart
// Description : The home hero — greeting, availability toggle and notification
//               bell over the rider artwork.
//
//               Replaces HomeAppHeader and DashboardHeader, which were two
//               competing implementations of the same thing.
//
//               The artwork is laid out as a sibling of the text rather than a
//               full-bleed background, because the old version positioned the
//               greeting with a hardcoded `right: 140` gutter: on a narrow
//               screen the name still ran under the scooter, and on a wide one
//               the text was needlessly cramped.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/date_formatter.dart';
import 'package:f2h_delivery/core/widgets/f2h_ui.dart';

class F2hHeroHeader extends StatelessWidget {
  final String driverName;
  final bool isOnline;
  final ValueChanged<bool> onToggleOnline;
  final VoidCallback? onNotifications;
  final int unreadCount;

  const F2hHeroHeader({
    super.key,
    required this.driverName,
    required this.isOnline,
    required this.onToggleOnline,
    this.onNotifications,
    this.unreadCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final firstName = driverName.trim().split(' ').first;
    final topInset = MediaQuery.of(context).padding.top;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        F2hSpace.md,
        topInset + F2hSpace.md,
        F2hSpace.md,
        F2hSpace.lg,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFE8F7EE), Color(0xFFF3FBF5), kBg],
          stops: [0.0, 0.55, 1.0],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Flexible, so a long name shortens the text block instead of
              // sliding underneath the artwork.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${AppGreeting.get()}, $firstName!',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: kText,
                        letterSpacing: -0.4,
                      ),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Ready to deliver happiness today',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: kTextSub,
                      ),
                    ),
                    const SizedBox(height: F2hSpace.md),
                    _AvailabilityToggle(
                      isOnline: isOnline,
                      onToggle: () => onToggleOnline(!isOnline),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: F2hSpace.sm),
              _BellButton(onTap: onNotifications, unreadCount: unreadCount),
            ],
          ),
        ],
      ),
    );
  }
}

/// Availability switch. The label sits opposite the knob so the control reads
/// as its current state rather than as the action it performs.
class _AvailabilityToggle extends StatelessWidget {
  final bool isOnline;
  final VoidCallback onToggle;

  const _AvailabilityToggle({required this.isOnline, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final tint = isOnline ? kPrimary : kMuted;
    return GestureDetector(
      onTap: onToggle,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          color: isOnline ? kPrimaryPl : kBgDeep,
          borderRadius: BorderRadius.circular(F2hRadius.pill),
          border: Border.all(color: tint.withValues(alpha: 0.45)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!isOnline) const SizedBox(width: 6),
            if (!isOnline)
              Text(
                'Offline',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: tint,
                ),
              ),
            if (!isOnline) const SizedBox(width: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              width: 26,
              height: 26,
              decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
              child: Icon(
                isOnline ? Icons.check_rounded : Icons.power_settings_new_rounded,
                size: 15,
                color: Colors.white,
              ),
            ),
            if (isOnline) const SizedBox(width: 8),
            if (isOnline)
              const Text(
                'Online',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: kPrimary,
                ),
              ),
            if (isOnline) const SizedBox(width: 6),
          ],
        ),
      ),
    );
  }
}

class _BellButton extends StatelessWidget {
  final VoidCallback? onTap;
  final int unreadCount;

  const _BellButton({this.onTap, this.unreadCount = 0});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: kSurface,
              shape: BoxShape.circle,
              boxShadow: const [
                BoxShadow(color: Color(0x140F172A), blurRadius: 10, offset: Offset(0, 3)),
              ],
            ),
            child: const Icon(Icons.notifications_none_rounded, color: kText, size: 22),
          ),
          if (unreadCount > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                constraints: const BoxConstraints(minWidth: 18),
                decoration: BoxDecoration(
                  color: kRed,
                  borderRadius: BorderRadius.circular(F2hRadius.pill),
                  border: Border.all(color: kSurface, width: 1.5),
                ),
                child: Text(
                  unreadCount > 9 ? '9+' : '$unreadCount',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
