import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class VerificationBadge extends StatelessWidget {
  final String status; // pending, verified, rejected
  final String? rejectionReason;
  final bool showReason;

  const VerificationBadge({
    super.key,
    required this.status,
    this.rejectionReason,
    this.showReason = true,
  });

  @override
  Widget build(BuildContext context) {
    Color badgeColor;
    Color textColor;
    IconData icon;
    String label;

    switch (status.toLowerCase()) {
      case 'verified':
        badgeColor = kSuccess.withOpacity(0.12);
        textColor = kSuccess;
        icon = Icons.check_circle_rounded;
        label = 'Verified';
        break;
      case 'rejected':
        badgeColor = kDanger.withOpacity(0.12);
        textColor = kDanger;
        icon = Icons.cancel_rounded;
        label = 'Rejected';
        break;
      case 'pending':
      default:
        badgeColor = kAccent.withOpacity(0.15);
        textColor = kAccent;
        icon = Icons.hourglass_empty_rounded;
        label = 'Pending Verification';
        break;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: badgeColor,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: textColor, size: 14),
              const SizedBox(width: 5),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  color: textColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
        if (showReason && status.toLowerCase() == 'rejected' && rejectionReason != null && rejectionReason!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            'Reason: $rejectionReason',
            style: const TextStyle(
              color: kDanger,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ]
      ],
    );
  }
}
