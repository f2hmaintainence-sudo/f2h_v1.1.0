import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/stop_status_helper.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/report_issue_screen.dart';
import 'package:f2h_delivery/features/tracking/presentation/widgets/stop_action_buttons.dart';

class MapDeliverySheet extends StatefulWidget {
  final List<GroupedStop> groupedStops;
  final GroupedStop nextStop;
  final Function(GroupedStop) onStopSelected;
  final Function(GroupedStop) onShowConfirmation;

  const MapDeliverySheet({
    super.key,
    required this.groupedStops,
    required this.nextStop,
    required this.onStopSelected,
    required this.onShowConfirmation,
  });

  @override
  State<MapDeliverySheet> createState() => _MapDeliverySheetState();
}

class _MapDeliverySheetState extends State<MapDeliverySheet> {
  @override
  Widget build(BuildContext context) {
    final nextStop = widget.nextStop;
    final hasSub = nextStop.orders.any((o) => o.orderType == 'subscription');
    final hasOneTime = nextStop.orders.any((o) => o.orderType == 'one-time');
    final primaryColor = hasSub ? kPrimary : kAccent;
    final primaryPlColor = hasSub ? kPrimaryPl : kAccentLt;

    return DraggableScrollableSheet(
      initialChildSize: 0.24,
      minChildSize: 0.24,
      maxChildSize: 0.9,
      builder: (BuildContext context, ScrollController scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, -4),
              )
            ],
            border: Border.all(color: kBorder),
          ),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            children: [
              // Drag Handle Indicator
              Center(
                child: Container(
                  width: 40,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 12, top: 4),
                  decoration: BoxDecoration(
                    color: kMuted.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              
              // Collapsed Header summary (always visible at top of scroll)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: primaryPlColor,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Stop #${nextStop.stop}',
                            style: TextStyle(
                              color: primaryColor,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          hasSub && hasOneTime 
                              ? 'SUBSCRIPTION & ONE-TIME' 
                              : (hasSub ? 'SUBSCRIPTION' : 'ONE-TIME'),
                          style: TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.w900,
                            fontSize: 10.5,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      nextStop.deliverySlot.toLowerCase() == 'morning' ? '☀️ Morning' : '🌙 Evening',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: kTextSub),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                
                // Customer Profile info
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: primaryColor.withValues(alpha: 0.08),
                      radius: 20,
                      child: Text(
                        nextStop.customerName.isNotEmpty ? nextStop.customerName[0].toUpperCase() : '?',
                        style: TextStyle(fontWeight: FontWeight.w900, color: primaryColor),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            nextStop.customerName,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            nextStop.address,
                            style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.3),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                
                // Call, Details, and Navigate Quick Action Buttons
                StopActionButtons(stop: nextStop),
                
                // Swipe up Hint
                const SizedBox(height: 8),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.keyboard_double_arrow_up_rounded, size: 12, color: kTextSub.withValues(alpha: 0.7)),
                      const SizedBox(width: 4),
                      Text(
                        'Swipe up to see summary details',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: kTextSub.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
                
                const Divider(height: 24, color: kBorder),
                
                // Value and Payment Status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TOTAL VALUE',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${nextStop.totalAmount.round()}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kText),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'PAYMENT STATE',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 4),
                        if (nextStop.isCod)
                          Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, size: 14, color: kDanger),
                              const SizedBox(width: 4),
                              Text(
                                'Collect Cash: ₹${nextStop.codAmount.round()}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: kDanger),
                              ),
                            ],
                          )
                        else
                          Row(
                            children: [
                              const Icon(Icons.check_circle_outline_rounded, size: 14, color: kSuccess),
                              const SizedBox(width: 4),
                              Text(
                                'Prepaid Online',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: kSuccess),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),

                // Bottles Outstanding (Only show if customer has containers to return)
                if (nextStop.bottlesWithCustomer > 0) ...[
                  const Divider(height: 24, color: kBorder),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'OUTSTANDING BOTTLES AT HOME',
                        style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                      ),
                      Text(
                        '${nextStop.bottlesWithCustomer} empty bottle${nextStop.bottlesWithCustomer == 1 ? '' : 's'}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Colors.teal),
                      ),
                    ],
                  ),
                ],
                
                // Special Instructions (if any)
                if (nextStop.specialInstructions != null && nextStop.specialInstructions!.isNotEmpty) ...[
                  const Divider(height: 24, color: kBorder),
                  const Text(
                    'SPECIAL INSTRUCTIONS',
                    style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline_rounded, color: Colors.amber, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            nextStop.specialInstructions!,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF92400E), height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                
                const Divider(height: 24, color: kBorder),
                
                // Expanded Actions: Deliver Now & Report Issue
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => ReportIssueScreen(order: nextStop.orders.first)),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: kDanger, width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('REPORT ISSUE', style: TextStyle(color: kDanger, fontWeight: FontWeight.w900, fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => widget.onShowConfirmation(nextStop),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('DELIVER NOW', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }
}
