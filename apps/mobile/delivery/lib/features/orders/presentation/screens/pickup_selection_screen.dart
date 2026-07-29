import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/bloc/pickup_bloc.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';

class PickupSelectionScreen extends StatefulWidget {
  final PickupResponse response;

  const PickupSelectionScreen({
    super.key,
    required this.response,
  });

  @override
  State<PickupSelectionScreen> createState() => _PickupSelectionScreenState();
}

class _PickupSelectionScreenState extends State<PickupSelectionScreen> {
  final LocationService _locationService = LocationService();
  final Set<String> _selectedVariantIds = {};
  final Map<String, double> _pickedQuantities = {};
  bool _isConfirming = false;

  @override
  void initState() {
    super.initState();
    // Initialize all items as selected with their default expected quantities
    for (final item in widget.response.items) {
      _selectedVariantIds.add(item.productVariantId);
      _pickedQuantities[item.productVariantId] = item.quantity;
    }
  }

  void _toggleSelectAll(bool? checked) {
    setState(() {
      if (checked == true) {
        for (final item in widget.response.items) {
          _selectedVariantIds.add(item.productVariantId);
          // Only reset quantity if it is currently 0
          if ((_pickedQuantities[item.productVariantId] ?? 0.0) == 0.0) {
            _pickedQuantities[item.productVariantId] = item.quantity;
          }
        }
      } else {
        _selectedVariantIds.clear();
        for (final item in widget.response.items) {
          _pickedQuantities[item.productVariantId] = 0.0;
        }
      }
    });
  }

  void _toggleItemSelection(String variantId, bool? checked, double maxQty) {
    setState(() {
      if (checked == true) {
        _selectedVariantIds.add(variantId);
        if ((_pickedQuantities[variantId] ?? 0.0) == 0.0) {
          _pickedQuantities[variantId] = maxQty;
        }
      } else {
        _selectedVariantIds.remove(variantId);
        _pickedQuantities[variantId] = 0.0;
      }
    });
  }

  void _adjustQuantity(String variantId, double maxQty, double change) {
    setState(() {
      double current = _pickedQuantities[variantId] ?? 0.0;
      double updated = current + change;
      if (updated < 0.0) updated = 0.0;
      if (updated > maxQty) updated = maxQty;

      _pickedQuantities[variantId] = updated;

      if (updated > 0.0) {
        _selectedVariantIds.add(variantId);
      } else {
        _selectedVariantIds.remove(variantId);
      }
    });
  }

  Future<void> _onConfirmPickup() async {
    if (widget.response.pickupConfirmed) {
      Navigator.pop(context);
      return;
    }

    setState(() => _isConfirming = true);

    try {
      final position = await _locationService.getCurrentPosition();
      final ordersRepo = sl<OrdersRepository>();

      // Map all items. Selected items get their adjusted quantity.
      // Deselected items get 0.0 to sync loaded_qty = 0 on the dispatch.
      final confirmedItems = widget.response.items.map((item) {
        final isSelected = _selectedVariantIds.contains(item.productVariantId);
        final pickedQty = _pickedQuantities[item.productVariantId] ?? 0.0;

        return PickupItem(
          id: item.id,
          dispatchId: item.dispatchId,
          productVariantId: item.productVariantId,
          productName: item.productName,
          quantity: isSelected ? pickedQty : 0.0,
          unit: item.unit,
          unitValue: item.unitValue,
          isReturnable: item.isReturnable,
          loadedQty: isSelected ? pickedQty : 0.0,
        );
      }).toList();

      await ordersRepo.confirmPickup(
        runId: widget.response.runId!,
        items: confirmedItems,
        latitude: position?.latitude,
        longitude: position?.longitude,
      );

      // Refresh session via BLoC after pickup confirmation
      if (mounted) {
        context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
      }
      try {
        sl<PickupBloc>().add(LoadPickupItems());
      } catch (_) {}

      // Refresh mock data service cache
      await MockDataService().loadBackendData();

      if (mounted) {
        setState(() => _isConfirming = false);
        Navigator.pop(context, true); // Pop back to dashboard with success status
      }
    } catch (err) {
      if (mounted) {
        setState(() => _isConfirming = false);
        AppSnackBar.error(context, 'Error confirming pickup: $err');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final allSelected = widget.response.items.every(
      (item) => _selectedVariantIds.contains(item.productVariantId),
    );

    final totalSelectedQty = widget.response.items.fold<double>(
      0,
      (sum, item) {
        if (_selectedVariantIds.contains(item.productVariantId)) {
          return sum + (_pickedQuantities[item.productVariantId] ?? 0.0);
        }
        return sum;
      },
    );

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: kText),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Warehouse Collection',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: kText),
        ),
      ),
      body: Column(
        children: [
          // Summary Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: kPrimary.withOpacity(0.08),
            child: Row(
              children: [
                const Icon(Icons.inventory_2_rounded, color: kPrimaryMid, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Selected items: ${totalSelectedQty.toInt()} / ${widget.response.items.fold<double>(0, (sum, i) => sum + i.quantity).toInt()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: kPrimaryMid,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Select All Checkbox Card
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: kBorder),
              ),
              child: CheckboxListTile(
                value: allSelected,
                onChanged: _toggleSelectAll,
                activeColor: kPrimary,
                title: const Text(
                  'Select All Items',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: kText),
                ),
                subtitle: const Text(
                  'Check all products and auto-fill expected quantities',
                  style: TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w600),
                ),
                controlAffinity: ListTileControlAffinity.leading,
              ),
            ),
          ),

          // Items List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: widget.response.items.length,
              separatorBuilder: (c, i) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = widget.response.items[index];
                final isSelected = _selectedVariantIds.contains(item.productVariantId);
                final currentQty = _pickedQuantities[item.productVariantId] ?? 0.0;

                return Container(
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected ? kPrimary.withOpacity(0.3) : kBorder,
                      width: isSelected ? 1.5 : 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: kText.withOpacity(0.01),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                    child: Row(
                      children: [
                        Checkbox(
                          value: isSelected,
                          activeColor: kPrimary,
                          onChanged: (val) => _toggleItemSelection(
                            item.productVariantId,
                            val,
                            item.quantity,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.productName,
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                  color: isSelected ? kText : kTextSub,
                                  decoration: isSelected ? null : TextDecoration.lineThrough,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Text(
                                    'Expected: ${item.quantity.toInt()} ${item.unit}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: kTextSub,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  if (isSelected && currentQty != item.quantity) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: kAccentLt,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Modified',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: kAccent,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        
                        // Counter
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline_rounded),
                              color: currentQty > 0.0 ? kRed : kMuted,
                              onPressed: currentQty > 0.0
                                  ? () => _adjustQuantity(item.productVariantId, item.quantity, -1.0)
                                  : null,
                            ),
                            Container(
                              constraints: const BoxConstraints(minWidth: 24),
                              alignment: Alignment.center,
                              child: Text(
                                currentQty.toInt().toString(),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: isSelected ? kPrimaryMid : kTextSub,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline_rounded),
                              color: currentQty < item.quantity ? kPrimary : kMuted,
                              onPressed: currentQty < item.quantity
                                  ? () => _adjustQuantity(item.productVariantId, item.quantity, 1.0)
                                  : null,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomSheet: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          border: const Border(top: BorderSide(color: kBorder)),
          boxShadow: [
            BoxShadow(
              color: kText.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              onPressed: _isConfirming ? null : _onConfirmPickup,
              child: _isConfirming
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Text(
                      widget.response.pickupConfirmed ? 'Close' : 'Confirm & Start Delivery',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
