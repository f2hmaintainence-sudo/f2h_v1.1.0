import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/order_detail_screen.dart';

import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';

/// Reusable **Call · Details · Navigate** action row for a delivery stop.
///
/// Eliminates the duplicated button row that previously appeared twice
/// inside [MapDeliverySheet] (once for the current-stop view and once
/// inside the all-stops list).
///
/// Set [compact] to `true` for the condensed list variant (smaller padding,
/// icons, and text). Defaults to full-size for the current-stop panel.
class StopActionButtons extends StatelessWidget {
  final GroupedStop stop;
  final bool compact;
  final VoidCallback? onNavigate;

  const StopActionButtons({
    super.key,
    required this.stop,
    this.compact = false,
    this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    final vertPad = compact ? 6.0 : 10.0;
    final radius = compact ? 8.0 : 12.0;
    final iconSize = compact ? 12.0 : 16.0;
    final fontSize = compact ? 11.0 : 13.0;

    return Row(
      children: [
        // Call
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => launchUrl(Uri.parse('tel:${stop.customerPhone}')),
            icon: Icon(Icons.phone_in_talk_rounded, color: Colors.blue, size: iconSize),
            label: Text(
              'Call',
              style: TextStyle(
                color: Colors.blue,
                fontWeight: FontWeight.w900,
                fontSize: fontSize,
              ),
            ),
            style: OutlinedButton.styleFrom(
              padding: EdgeInsets.symmetric(vertical: vertPad),
              side: BorderSide(color: Colors.blue.withValues(alpha: compact ? 0.2 : 0.3)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(radius),
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),

        // Details
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => OrderDetailScreen(stop: stop)),
            ),
            icon: Icon(Icons.info_outline_rounded, color: kPrimary, size: iconSize),
            label: Text(
              'Details',
              style: TextStyle(
                color: kPrimary,
                fontWeight: FontWeight.w900,
                fontSize: fontSize,
              ),
            ),
            style: OutlinedButton.styleFrom(
              padding: EdgeInsets.symmetric(vertical: vertPad),
              side: BorderSide(color: kPrimary.withValues(alpha: compact ? 0.2 : 0.3)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(radius),
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),

        // Navigate
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              if (onNavigate != null) {
                onNavigate!();
              } else {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => MapScreen(
                      focusedStop: stop,
                      isStandalonePage: true,
                    ),
                  ),
                );
              }
            },
            icon: Icon(Icons.navigation_rounded, color: Colors.white, size: iconSize),
            label: Text(
              compact ? 'Nav' : 'Navigate',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: fontSize,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              padding: EdgeInsets.symmetric(vertical: vertPad),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(radius),
              ),
              elevation: 0,
            ),
          ),
        ),
      ],
    );
  }
}
