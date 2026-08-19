import 'package:flutter/material.dart';
import 'package:f2h_delivery/core/widgets/app_loading_button.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/warehouse_pickup_modal.dart';

class WarehouseCollectCard extends StatelessWidget {
  final List<DeliveryOrderModel> orders;

  const WarehouseCollectCard({super.key, required this.orders});

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) return const SizedBox.shrink();

    final totalItems = orders.fold(
      0,
      (sum, o) => sum + o.products.fold(0, (s, p) => s + p.quantity),
    );

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFFFFF7ED),
            Colors.orange.shade50,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.shade300, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.warehouse_rounded, color: Colors.orange.shade900, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Collect Items from Warehouse',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange.shade900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Verify & confirm dispatch items to enable navigation',
                      style: TextStyle(fontSize: 11.5, color: Colors.orange.shade800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '📦 ${orders.length} Orders · $totalItems Total Units',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.orange.shade900,
                ),
              ),
              AppLoadingButton(
                onPressed: () => WarehousePickupModal.show(context, orders),
                label: 'Pickup Items',
                icon: Icons.inventory_2_rounded,
                height: 36,
                fontSize: 11.5,
                backgroundColor: Colors.orange.shade800,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
