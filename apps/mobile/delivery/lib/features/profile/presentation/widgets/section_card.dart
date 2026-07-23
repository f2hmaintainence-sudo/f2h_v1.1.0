import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class SectionCard extends StatelessWidget {
  final String title;
  final String? emoji;
  final IconData? icon;
  final List<Widget> children;
  final Widget? trailing;

  const SectionCard({
    super.key,
    required this.title,
    this.emoji,
    this.icon,
    required this.children,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: kText.withOpacity(0.01),
            blurRadius: 8,
            offset: const Offset(0, 4),
          )
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    if (emoji != null) ...[
                      Text(emoji!, style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: 8),
                    ] else if (icon != null) ...[
                      Icon(icon, color: kPrimary, size: 22),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: Text(
                        title.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: kTextSub,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: kBorderLt),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}
