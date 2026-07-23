import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';

class CollectedItemsDialog extends StatefulWidget {
  final PickupResponse response;
  final Future<void> Function(List<PickupItem> confirmedItems) onConfirm;

  const CollectedItemsDialog({
    super.key,
    required this.response,
    required this.onConfirm,
  });

  @override
  State<CollectedItemsDialog> createState() => _CollectedItemsDialogState();
}

class _CollectedItemsDialogState extends State<CollectedItemsDialog> {
  final Set<String> checkedItems = {};
  bool isConfirming = false;

  @override
  Widget build(BuildContext context) {
    final response = widget.response;
    final totalQuantity = response.items.fold<double>(0, (sum, item) => sum + item.quantity);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: kPrimary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.playlist_add_check_rounded, color: kPrimary, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Items to Collect',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          color: kText,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${totalQuantity.toInt()} items (${response.items.length} types)',
                        style: const TextStyle(
                          fontSize: 13,
                          color: kTextSub,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: kTextSub),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Instructions
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: kBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: kPrimary, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Use this checklist as you verify and collect items from the warehouse.',
                      style: TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Items List
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.45,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: response.items.length,
                separatorBuilder: (c, i) => const Divider(height: 12),
                itemBuilder: (context, index) {
                  final item = response.items[index];
                  final isChecked = checkedItems.contains(item.productVariantId);
                  return CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      item.productName,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: isChecked ? kTextSub : kText,
                        decoration: isChecked ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    subtitle: Text(
                      '${item.quantity.toInt()} ${item.unit}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: kPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    value: isChecked,
                    activeColor: kPrimary,
                    onChanged: (bool? val) {
                      setState(() {
                        if (val == true) {
                          checkedItems.add(item.productVariantId);
                        } else {
                          checkedItems.remove(item.productVariantId);
                        }
                      });
                    },
                    controlAffinity: ListTileControlAffinity.leading,
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            // Action button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                onPressed: isConfirming
                    ? null
                    : () async {
                        if (response.pickupConfirmed) {
                          Navigator.pop(context);
                          return;
                        }

                        setState(() {
                          isConfirming = true;
                        });

                        try {
                          final confirmedItems = response.items.map((item) {
                            return PickupItem(
                              id: item.id,
                              dispatchId: item.dispatchId,
                              productVariantId: item.productVariantId,
                              productName: item.productName,
                              quantity: item.quantity,
                              unit: item.unit,
                              unitValue: item.unitValue,
                              isReturnable: item.isReturnable,
                              loadedQty: item.quantity,
                            );
                          }).toList();

                          await widget.onConfirm(confirmedItems);
                        } finally {
                          if (mounted) {
                            setState(() {
                              isConfirming = false;
                            });
                          }
                        }
                      },
                child: isConfirming
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        response.pickupConfirmed ? 'Close' : 'Confirm & Start Delivery',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
