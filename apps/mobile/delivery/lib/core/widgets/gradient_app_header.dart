import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

// ══════════════════════════════════════════════════════════
//  DEPRECATED WRAPPER — GradientAppHeader now delegates to
//  F2hAppBar for a unified look across all screens.
//  Kept for backward compatibility with existing call sites.
// ══════════════════════════════════════════════════════════
class GradientAppHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Color>? gradientColors;
  final Color backgroundColor;
  final Widget? rightWidget;
  final IconData? rightIcon;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final List<Widget>? actions;

  final Widget? leading;

  const GradientAppHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.gradientColors,
    this.backgroundColor = const Color(0xFFF4F9F5),
    this.leading,
    this.rightWidget,
    this.rightIcon,
    this.showBackButton = true,
    this.onBackPressed,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    // Build actions list including rightWidget/rightIcon
    final List<Widget> mergedActions = [
      ...?actions,
      if (rightWidget != null) ...[
        const SizedBox(width: 4),
        rightWidget!,
      ] else if (rightIcon != null) ...[
        const SizedBox(width: 4),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
            color: kPrimaryPl,
            shape: BoxShape.circle,
          ),
          child: Icon(rightIcon, color: kPrimary, size: 20),
        ),
      ],
      const SizedBox(width: 8),
    ];

    return F2hAppBar(
      title: title,
      subtitle: subtitle,
      leading: leading,
      showBackButton: showBackButton,
      onBackPressed: onBackPressed,
      actions: mergedActions.isNotEmpty ? mergedActions : null,
      backgroundGradient: gradientColors != null ? LinearGradient(colors: gradientColors!) : null,
    );
  }
}
