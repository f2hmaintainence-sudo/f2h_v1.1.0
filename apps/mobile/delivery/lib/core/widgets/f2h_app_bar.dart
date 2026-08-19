import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/security_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';

// ══════════════════════════════════════════════════════════════════════════════
//  F2H APP BAR — Reference Design Standard for All Delivery Partner Screens
//  Design: Soft mint gradient header, curved bottom corners, circular pills
// ══════════════════════════════════════════════════════════════════════════════
class F2hAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? subtitle;
  final bool showBackButton;
  final Widget? leading;
  final VoidCallback? onBackPressed;
  final List<Widget>? actions;
  final IconData? icon;
  final PreferredSizeWidget? bottom;
  final Color? backgroundColor;
  final Gradient? backgroundGradient;
  final bool isDark;
  final bool centerTitle;
  final double? titleFontSize;
  final double? bottomRadius;

  const F2hAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.showBackButton = true,
    this.leading,
    this.onBackPressed,
    this.actions,
    this.icon,
    this.bottom,
    this.backgroundColor,
    this.backgroundGradient,
    this.isDark = false,
    this.centerTitle = false,
    this.titleFontSize,
    this.bottomRadius = 0.0,
  });

  /// Standard Screen Icon Action Pill (for profile & child screens)
  static Widget iconAction(
    IconData icon, {
    VoidCallback? onTap,
    Color? color,
    Color? iconColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color ?? Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 4,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: Icon(
          icon,
          color: iconColor ?? const Color(0xFF0F172A),
          size: 20,
        ),
      ),
    );
  }

  /// Standard Notification Bell Action Pill (with red unread count badge)
  static Widget notificationAction(BuildContext context, {int unreadCount = 0, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap ??
          () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              ),
      behavior: HitTestBehavior.opaque,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x08000000),
                  blurRadius: 4,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: const Icon(
              Icons.notifications_none_rounded,
              color: Color(0xFF0F172A),
              size: 20,
            ),
          ),
          if (unreadCount > 0)
            Positioned(
              right: -1,
              top: -1,
              child: Container(
                padding: const EdgeInsets.all(3.5),
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                child: Text(
                  unreadCount > 9 ? '9+' : unreadCount.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    height: 1,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Standard Settings Gear Action Pill (for Profile screen)
  static Widget settingsAction(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const SecurityScreen()),
      ),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 4,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: const Icon(
          Icons.settings_outlined,
          color: Color(0xFF0F172A),
          size: 20,
        ),
      ),
    );
  }

  /// Standard Support Headset Action Pill (for Active Delivery / Help screens)
  static Widget supportAction(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const SupportScreen(initialTabIndex: 0)),
      ),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 4,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: const Icon(
          Icons.headset_mic_outlined,
          color: Color(0xFF0F172A),
          size: 20,
        ),
      ),
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(
    (subtitle != null ? 70.0 : 62.0) + (bottom?.preferredSize.height ?? 0.0),
  );

  @override
  Widget build(BuildContext context) {
    final Color textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final Color subtitleColor = isDark ? Colors.white70 : const Color(0xFF64748B);

    final Gradient defaultGradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: isDark
          ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
          : [
              const Color(0xFFEAF7EE),
              const Color(0xFFF3FAF5),
              const Color(0xFFF8FAFC),
            ],
    );

    final List<Widget>? effectiveActions = actions ?? (icon != null ? [iconAction(icon!)] : null);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Container(
        decoration: BoxDecoration(
          color: backgroundColor,
          gradient: backgroundColor == null ? (backgroundGradient ?? defaultGradient) : null,
          borderRadius: bottomRadius != null && bottomRadius! > 0
              ? BorderRadius.vertical(bottom: Radius.circular(bottomRadius!))
              : null,
          border: Border.all(
            color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isDark ? const Color(0x20000000) : const Color(0x08000000),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: SafeArea(
          bottom: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Leading Avatar / Back Button Pill
                    if (leading != null) ...[
                      leading!,
                      const SizedBox(width: 12),
                    ] else if (showBackButton) ...[
                      GestureDetector(
                        onTap: onBackPressed ?? () => Navigator.maybePop(context),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B) : Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                              width: 1,
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x06000000),
                                blurRadius: 4,
                                offset: Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.arrow_back_rounded,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            size: 20,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],

                    // Title & Subtitle
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: centerTitle ? CrossAxisAlignment.center : CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: TextStyle(
                              fontSize: titleFontSize ?? ((showBackButton && centerTitle) ? 16.0 : 16.5),
                              fontWeight: FontWeight.w800,
                              color: textColor,
                              letterSpacing: -0.2,
                              height: 1.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: centerTitle ? TextAlign.center : TextAlign.start,
                          ),
                          if (subtitle != null && subtitle!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              subtitle!,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                                color: subtitleColor,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: centerTitle ? TextAlign.center : TextAlign.start,
                            ),
                          ],
                        ],
                      ),
                    ),

                    // Actions Area (Pills)
                    if (effectiveActions != null && effectiveActions.isNotEmpty) ...[
                      const SizedBox(width: 10),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: effectiveActions,
                      ),
                    ] else if (centerTitle) ...[
                      // Balance spacing when center-aligned
                      SizedBox(width: (leading != null || showBackButton) ? 38 : 0),
                    ],
                  ],
                ),
              ),
              ?bottom,
            ],
          ),
        ),
      ),
    );
  }
}

