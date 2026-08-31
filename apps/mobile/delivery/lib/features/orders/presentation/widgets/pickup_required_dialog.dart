import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_basket_modal.dart';

/// Shows a dialog informing the delivery partner that warehouse pickup must be
/// confirmed before any delivery stops can be fulfilled.
void showPickupRequiredDialog(
  BuildContext context, {
  required List<DeliveryOrderModel> orders,
  required List<GroupedStop> groupedStops,
  DeliveryRun? currentRun,
}) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      contentPadding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: const Icon(
              Icons.warehouse_rounded,
              color: Color(0xFFD97706),
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pickup Required',
                  style: GoogleFonts.roboto(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: const Color(0xFF0F172A),
                    letterSpacing: -0.2,
                  ),
                ),
                Text(
                  'Warehouse Handover Pending',
                  style: GoogleFonts.roboto(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFD97706),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'You cannot deliver stops until items are picked up and confirmed from the warehouse.',
            style: GoogleFonts.roboto(
              fontSize: 13,
              color: const Color(0xFF334155),
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF64748B)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Please verify your physical bag inventory against assigned order demand in the Delivery Basket Ledger.',
                    style: GoogleFonts.roboto(
                      fontSize: 11.5,
                      color: const Color(0xFF64748B),
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        Row(
          children: [
            Expanded(
              child: TextButton(
                onPressed: () => Navigator.pop(ctx),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  'Dismiss',
                  style: GoogleFonts.roboto(
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  DeliveryBasketModal.show(
                    context,
                    orders,
                    groupedStops: groupedStops,
                    currentRun: currentRun,
                  );
                },
                icon: const Icon(Icons.shopping_basket_outlined, size: 15, color: Colors.white),
                label: Text(
                  'Open Basket Ledger',
                  style: GoogleFonts.roboto(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}
