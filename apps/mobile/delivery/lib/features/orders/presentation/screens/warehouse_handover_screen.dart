import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/bloc/handover_bloc.dart';

class WarehouseHandoverScreen extends StatefulWidget {
  const WarehouseHandoverScreen({super.key});

  @override
  State<WarehouseHandoverScreen> createState() => _WarehouseHandoverScreenState();
}

class _WarehouseHandoverScreenState extends State<WarehouseHandoverScreen> {
  bool _isSubmitting = false;
  bool _handoverDone = false;
  int _bottlesReturned = 0;
  List<DeliveryOrderItem> _itemsHandedOver = [];
  List<DeliveryOrderItem> _failedItems = [];
  List<DeliveryOrderItem> _remainingItems = [];

  final Map<String, bool> _itemReturnedCheck = {};
  bool _bottlesReturnedCheck = false;

  @override
  void initState() {
    super.initState();
    // Read initial data from the already-loaded BLoC state
    final sessionState = context.read<DeliverySessionBloc>().state;
    if (sessionState is DeliverySessionLoaded) {
      _bottlesReturned = sessionState.collectedBottlesCount;
      _itemsHandedOver = sessionState.itemsToReturn;
      _failedItems = sessionState.failedItems;
      _remainingItems = sessionState.remainingItems;
    }
  }

  void _submitHandover(BuildContext context) {
    final sessionState = context.read<DeliverySessionBloc>().state;
    final runId = sessionState is DeliverySessionLoaded
        ? sessionState.currentRun?.runId
        : null;
    if (runId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No active delivery run found for handover'),
          backgroundColor: kDanger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    context.read<HandoverBloc>().add(SubmitHandover(runId));
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => sl<HandoverBloc>(),
      child: BlocConsumer<HandoverBloc, HandoverState>(
        listener: (context, state) {
          if (state is HandoverSuccess) {
            setState(() {
              _handoverDone = true;
              _isSubmitting = false;
            });
            // Clear the active run from the BLoC so the next shift starts clean
            context.read<DeliverySessionBloc>().add(ClearActiveRunEvent());
          } else if (state is HandoverFailure) {
            setState(() {
              _isSubmitting = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.error),
                backgroundColor: kDanger,
                behavior: SnackBarBehavior.floating,
                action: SnackBarAction(
                  label: 'Retry',
                  textColor: Colors.white,
                  onPressed: () => _submitHandover(context),
                ),
              ),
            );
          } else if (state is HandoverLoading) {
            setState(() {
              _isSubmitting = true;
            });
          }
        },
        builder: (context, state) {
          if (_handoverDone) {
            return Scaffold(
              backgroundColor: kBg,
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: kSuccess.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.verified_rounded, size: 80, color: kSuccess),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Handover Complete!',
                        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: kText, letterSpacing: -0.5),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Shift completed successfully. Items have been registered back to the warehouse.',
                        style: TextStyle(color: kTextSub, fontSize: 14, fontWeight: FontWeight.w500),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      
                      // Summary Box
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: kBorder),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Empty Bottles Returned', style: TextStyle(fontWeight: FontWeight.w700, color: kTextSub)),
                                Text('$_bottlesReturned bottles', style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.teal, fontSize: 15)),
                              ],
                            ),
                            if (_itemsHandedOver.isNotEmpty) ...[
                              const Divider(height: 24),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Returned Items Count', style: TextStyle(fontWeight: FontWeight.w700, color: kTextSub)),
                                  Text('${_itemsHandedOver.length} unique items', style: const TextStyle(fontWeight: FontWeight.w900, color: kAccent, fontSize: 15)),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 48),
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pop();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kPrimary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text('Back to Home', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return Scaffold(
            backgroundColor: kBg,
            appBar: AppBar(
              title: const Text('Warehouse Handover', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
              backgroundColor: kSurface,
              elevation: 0,
              centerTitle: true,
            ),
            body: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Info description card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF0F766E), Color(0xFF115E59)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [BoxShadow(color: Colors.teal.withOpacity(0.15), blurRadius: 10, offset: const Offset(0, 4))],
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: Colors.white.withOpacity(0.18),
                              radius: 24,
                              child: const Icon(Icons.hail_rounded, color: Colors.white, size: 24),
                            ),
                            const SizedBox(width: 14),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Shift Handover Protocol',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Confirm returns of bottles and undelivered stock to the warehouse supervisor.',
                                    style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.3),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // 1. Bottles section
                      const Text(
                        '1. Collected Empty Bottles',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: _bottlesReturnedCheck ? kSuccess.withOpacity(0.3) : kBorder),
                        ),
                        child: CheckboxListTile(
                          value: _bottlesReturnedCheck,
                          onChanged: (val) => setState(() => _bottlesReturnedCheck = val ?? false),
                          activeColor: kSuccess,
                          controlAffinity: ListTileControlAffinity.leading,
                          title: Text(
                            'Return $_bottlesReturned Empty Bottles',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          subtitle: const Text('Bottles collected from subscription returns'),
                          secondary: CircleAvatar(
                            backgroundColor: Colors.teal.shade50,
                            child: const Icon(Icons.opacity, color: Colors.teal),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // 2. Failed Deliveries Stock
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '2. Failed Deliveries Stock',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText),
                          ),
                          Text(
                            '${_failedItems.length} items',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kTextSub),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (_failedItems.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(24),
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: kBorder),
                          ),
                          child: const Center(
                            child: Text('No failed delivery items to return today.', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold)),
                          ),
                        )
                      else
                        ..._failedItems.map((item) {
                          final itemKey = 'failed_${item.productName}_${item.unit}';
                          final isChecked = _itemReturnedCheck[itemKey] ?? false;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: isChecked ? kSuccess.withOpacity(0.3) : kBorder),
                            ),
                            child: CheckboxListTile(
                              value: isChecked,
                              onChanged: (val) => setState(() => _itemReturnedCheck[itemKey] = val ?? false),
                              activeColor: kSuccess,
                              controlAffinity: ListTileControlAffinity.leading,
                              title: Text(
                                item.productName,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14.5,
                                  decoration: isChecked ? TextDecoration.lineThrough : null,
                                  color: isChecked ? Colors.grey : kText,
                                ),
                              ),
                              subtitle: Text('Return Failed: ${item.quantity.toInt()} ${item.unit}'),
                              secondary: CircleAvatar(
                                backgroundColor: Colors.red.shade50,
                                child: const Icon(Icons.assignment_return_rounded, color: kDanger),
                              ),
                            ),
                          );
                        }),
                      const SizedBox(height: 24),

                      // 3. Remaining Undelivered Stock
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '3. Remaining Undelivered Stock',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText),
                          ),
                          Text(
                            '${_remainingItems.length} items',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kTextSub),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (_remainingItems.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(24),
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: kBorder),
                          ),
                          child: const Center(
                            child: Text('Perfect! No remaining undelivered stock.', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold)),
                          ),
                        )
                      else
                        ..._remainingItems.map((item) {
                          final itemKey = 'remaining_${item.productName}_${item.unit}';
                          final isChecked = _itemReturnedCheck[itemKey] ?? false;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: isChecked ? kSuccess.withOpacity(0.3) : kBorder),
                            ),
                            child: CheckboxListTile(
                              value: isChecked,
                              onChanged: (val) => setState(() => _itemReturnedCheck[itemKey] = val ?? false),
                              activeColor: kSuccess,
                              controlAffinity: ListTileControlAffinity.leading,
                              title: Text(
                                item.productName,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14.5,
                                  decoration: isChecked ? TextDecoration.lineThrough : null,
                                  color: isChecked ? Colors.grey : kText,
                                ),
                              ),
                              subtitle: Text('Return Stock: ${item.quantity.toInt()} ${item.unit}'),
                              secondary: CircleAvatar(
                                backgroundColor: Colors.orange.shade50,
                                child: const Icon(Icons.assignment_return_rounded, color: kAccent),
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
                
                // Bottom action button bar
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: kSurface,
                    border: const Border(top: BorderSide(color: kBorderLt)),
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _submitHandover(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 2,
                      ),
                      child: _isSubmitting
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_circle_rounded, size: 20),
                                SizedBox(width: 8),
                                Text('Confirm Handover & Close Shift', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                              ],
                            ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
