import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class StatusBanner extends StatelessWidget {
  final String status; // pending, verified, rejected
  final String? message;

  const StatusBanner({
    super.key,
    required this.status,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    if (status.toLowerCase() == 'verified') return const SizedBox.shrink();

    Color bgColor;
    Color borderAndIconColor;
    IconData icon;
    String text;

    if (status.toLowerCase() == 'rejected') {
      bgColor = kRedLt;
      borderAndIconColor = kRed;
      icon = Icons.error_outline_rounded;
      text = message ?? 'Some details have been rejected. Please update and re-submit.';
    } else {
      // Pending
      bgColor = kAccentLt;
      borderAndIconColor = kAccent;
      icon = Icons.info_outline_rounded;
      text = message ?? 'Verification Pending: Your profile changes require admin review before approval.';
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderAndIconColor.withValues(alpha: 0.3), width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: borderAndIconColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 11.5,
                color: borderAndIconColor == kRed ? kRed : kTextMid,
                fontWeight: FontWeight.bold,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
