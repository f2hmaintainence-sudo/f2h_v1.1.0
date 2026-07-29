import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class InfoTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData? leadingIcon;
  final VoidCallback? onTap;
  final bool copyable;

  const InfoTile({
    super.key,
    required this.label,
    required this.value,
    this.leadingIcon,
    this.onTap,
    this.copyable = false,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          if (leadingIcon != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: kBgDeep,
                shape: BoxShape.circle,
              ),
              child: Icon(leadingIcon, color: kPrimary, size: 16),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isEmpty ? 'Not Setup' : value,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: kText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          if (copyable && value.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.copy_rounded, size: 16, color: kTextSub),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$label copied to clipboard'),
                    duration: const Duration(seconds: 1),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
          if (onTap != null)
            Icon(Icons.arrow_forward_ios_rounded, color: kTextSub.withValues(alpha: 0.4), size: 12),
        ],
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: content,
      );
    }

    return content;
  }
}
