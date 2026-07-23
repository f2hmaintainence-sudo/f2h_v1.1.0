import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/date_formatter.dart';

class DashboardHeader extends StatelessWidget {
  final String driverName;
  final int completedCount;
  final int totalStops;
  final VoidCallback onCollectTap;

  const DashboardHeader({
    super.key,
    required this.driverName,
    required this.completedCount,
    required this.totalStops,
    required this.onCollectTap,
  });

  Widget _buildMetricCard(String label, String value, IconData icon, Color bg, Color fg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: fg.withOpacity(0.1), width: 1),
        ),
        child: Row(
          children: [
            Icon(icon, color: fg, size: 20),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    color: fg,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    color: fg.withOpacity(0.7),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final int completionRate = totalStops == 0 ? 0 : ((completedCount / totalStops) * 100).round();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppGreeting.get(),
                    style: TextStyle(
                      fontSize: 12,
                      color: kTextSub.withOpacity(0.8),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    driverName,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onCollectTap,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: kPrimary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kPrimary.withOpacity(0.3), width: 1.2),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.playlist_add_check_rounded, color: kPrimary, size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Collect Items',
                      style: TextStyle(
                        color: kPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _buildMetricCard(
              "Today's Stops",
              totalStops.toString(),
              Icons.inventory_2_rounded,
              kPrimaryPl,
              kPrimary,
            ),
            const SizedBox(width: 12),
            _buildMetricCard(
              "Completion",
              "$completionRate%",
              Icons.task_alt_rounded,
              const Color(0xFFF0FDF4),
              kSuccess,
            ),
          ],
        ),
      ],
    );
  }
}
