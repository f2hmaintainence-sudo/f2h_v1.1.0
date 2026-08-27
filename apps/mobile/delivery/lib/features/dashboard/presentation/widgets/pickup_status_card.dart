import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_basket_modal.dart';

class PickupStatusCard extends StatelessWidget {
  final DeliveryRun? currentRun;

  const PickupStatusCard({super.key, required this.currentRun});

  @override
  Widget build(BuildContext context) {
    final run = currentRun;
    if (run == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 10, bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFECFDF5),
            Color(0xFFF0FDF4),
            Color(0xFFE0F2FE),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16A34A).withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Step & Status Header Row (Responsive Overflow Protection)
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.bolt_rounded, size: 12, color: Color(0xFF16A34A)),
                    SizedBox(width: 3),
                    Text(
                      'STEP 1 OF SHIFT • ACTION REQUIRED',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF15803D),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.inventory_2_outlined, size: 11, color: Color(0xFF0F172A)),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            'Run #${run.runId}',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Warehouse Details Row
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.warehouse_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Warehouse Product Pickup',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.2,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Verify inventory items & confirm package collection to start route deliveries.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF475569),
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Primary Action Button
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: ElevatedButton(
              onPressed: () {
                final sessionState = context.read<DeliverySessionBloc>().state;
                if (sessionState is DeliverySessionLoaded) {
                  DeliveryBasketModal.show(
                    context,
                    sessionState.orders,
                    groupedStops: sessionState.groupedStops,
                    currentRun: run,
                  );
                } else {
                  DeliveryBasketModal.show(
                    context,
                    const [],
                    groupedStops: const [],
                    currentRun: run,
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 10.5, horizontal: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner_rounded, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'VERIFY & CONFIRM PICKUP',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 11.5,
                      letterSpacing: 0.4,
                    ),
                  ),
                  Spacer(),
                  Icon(Icons.arrow_forward_rounded, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
