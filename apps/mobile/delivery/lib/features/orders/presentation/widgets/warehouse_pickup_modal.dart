import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/core/widgets/app_loading_button.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';

class WarehousePickupModal extends StatefulWidget {
  final List<DeliveryOrderModel> orders;

  const WarehousePickupModal({super.key, required this.orders});

  static void show(BuildContext context, List<DeliveryOrderModel> orders) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => WarehousePickupModal(orders: orders),
    );
  }

  @override
  State<WarehousePickupModal> createState() => _WarehousePickupModalState();
}

class _WarehousePickupModalState extends State<WarehousePickupModal> {
  bool _isConfirming = false;
  final Map<String, bool> _verifiedItems = {};

  List<DeliveryOrderItem> get _consolidatedItems {
    final Map<String, DeliveryOrderItem> m = {};
    for (final order in widget.orders) {
      for (final item in order.products) {
        final key = '${item.productName}_${item.unit}';
        if (m.containsKey(key)) {
          m[key] = DeliveryOrderItem(
            productName: item.productName,
            quantity: m[key]!.quantity + item.quantity,
            unit: item.unit,
            price: item.price,
          );
        } else {
          m[key] = item;
        }
      }
    }
    return m.values.toList();
  }

  int get _totalUnits => _consolidatedItems.fold(0, (sum, i) => sum + i.quantity);

  void _handleConfirmPickup() {
    setState(() => _isConfirming = true);
    context.read<DeliverySessionBloc>().add(
          ConfirmWarehousePickupEvent(
            onSuccess: () {
              if (mounted) {
                setState(() => _isConfirming = false);
                Navigator.pop(context);
                AppSnackBar.show(
                  context,
                  '✅ Items verified & collected from warehouse! All items added to basket. Navigation enabled.',
                  backgroundColor: kSuccess,
                );
              }
            },
            onError: (err) {
              if (mounted) {
                setState(() => _isConfirming = false);
                AppSnackBar.error(context, err);
              }
            },
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final items = _consolidatedItems;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle & Header
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: kPrimaryPl,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.warehouse_rounded, color: kPrimary, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Warehouse Item Handover',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: kText),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Verify dispatched items from warehouse admin',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Text(
                    '$_totalUnits Units',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange.shade800),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Items List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = items[index];
                final key = '${item.productName}_${item.unit}';
                final isChecked = _verifiedItems[key] ?? true;

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: isChecked ? kPrimaryPl.withValues(alpha: 0.4) : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isChecked ? kPrimaryLt.withValues(alpha: 0.5) : Colors.grey.shade300,
                    ),
                  ),
                  child: Row(
                    children: [
                      Checkbox(
                        value: isChecked,
                        activeColor: kPrimary,
                        onChanged: (val) {
                          setState(() {
                            _verifiedItems[key] = val ?? false;
                          });
                        },
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: kText),
                            ),
                            if (item.unit.isNotEmpty &&
                                !item.productName.toLowerCase().contains(item.unit.toLowerCase()) &&
                                !(item.productName.contains('0.5L') && item.unit.contains('500ml')) &&
                                !(item.productName.contains('1L') && item.unit.contains('1000ml')))
                              Text(
                                item.unit,
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: kPrimary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${item.quantity} × ${item.unit.isNotEmpty ? item.unit : 'pcs'}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: AppLoadingButton(
              onPressed: _handleConfirmPickup,
              isLoading: _isConfirming,
              label: 'Verify & Confirm Pickup (Add to Basket)',
              icon: Icons.check_circle_rounded,
              height: 48,
              fontSize: 14,
              backgroundColor: kPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
