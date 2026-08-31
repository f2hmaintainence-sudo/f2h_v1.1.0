import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';

/// Shows a dialog modal popup confirming that a stop has been successfully delivered or marked as failed.
class DeliveryResultDialog extends StatelessWidget {
  final GroupedStop stop;
  final String status;
  final int emptyBottlesCollected;
  final String? paymentMode;
  final VoidCallback? onNext;

  const DeliveryResultDialog({
    super.key,
    required this.stop,
    required this.status,
    this.emptyBottlesCollected = 0,
    this.paymentMode,
    this.onNext,
  });

  static Future<void> show(
    BuildContext context, {
    required GroupedStop stop,
    required String status,
    int emptyBottlesCollected = 0,
    String? paymentMode,
    VoidCallback? onNext,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => DeliveryResultDialog(
        stop: stop,
        status: status,
        emptyBottlesCollected: emptyBottlesCollected,
        paymentMode: paymentMode,
        onNext: onNext,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDelivered = status.toLowerCase() == 'delivered' || status.toLowerCase() == 'completed';
    final primaryColor = isDelivered ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final lightBg = isDelivered ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2);
    final borderCol = isDelivered ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5);

    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Badge Icon with Glow
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: lightBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: borderCol, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withValues(alpha: 0.22),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    isDelivered ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    color: primaryColor,
                    size: 40,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Title & Subtitle
            Text(
              isDelivered ? 'Stop #${stop.stop} Delivered!' : 'Stop #${stop.stop} Failed',
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              isDelivered
                  ? 'Delivery marked successfully for this stop.'
                  : 'Delivery status updated as failed.',
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 18),

            // Customer Summary Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: primaryColor.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            stop.customerName.isNotEmpty ? stop.customerName[0].toUpperCase() : '?',
                            style: GoogleFonts.roboto(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: primaryColor,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              stop.customerName,
                              style: GoogleFonts.roboto(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0F172A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              stop.customerPhone,
                              style: GoogleFonts.roboto(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1, color: Color(0xFFE2E8F0)),
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined, color: Color(0xFF64748B), size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          stop.address,
                          style: GoogleFonts.roboto(
                            fontSize: 11.5,
                            color: const Color(0xFF475569),
                            height: 1.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Additional Mini Metrics Row
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          stop.isCod ? Icons.payments_rounded : Icons.check_circle_outline_rounded,
                          size: 15,
                          color: stop.isCod ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            stop.isCod
                                ? '₹${stop.codAmount.round()} (${paymentMode?.toUpperCase() ?? "COD"})'
                                : 'Prepaid Online',
                            style: GoogleFonts.roboto(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF1E293B),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (emptyBottlesCollected > 0 || stop.emptyBottlesCollected > 0) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.opacity_rounded, size: 15, color: Color(0xFF0D9488)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${emptyBottlesCollected > 0 ? emptyBottlesCollected : stop.emptyBottlesCollected} Bottles Col.',
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F766E),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 20),

            // Confirm / Continue Button
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                onNext?.call();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Done',
                    style: GoogleFonts.roboto(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(Icons.arrow_forward_rounded, size: 17),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
