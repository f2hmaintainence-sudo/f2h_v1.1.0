import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/subscription/presentation/widgets/subscription_card.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_event.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_calendar_screen.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';
import 'package:f2h_customer/core/network/network_state.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';
import 'package:f2h_customer/core/widgets/unpaid_bill_banner_widget.dart';

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTIONS
// ══════════════════════════════════════════════════════════

class SubsScreen extends StatefulWidget {
  final bool showConfetti;
  const SubsScreen({super.key, this.showConfetti = false});

  @override
  State<SubsScreen> createState() => _SubsScreenState();
}

class _SubsScreenState extends State<SubsScreen> {
  late List<Subscription> _subscriptions;
  DateTime? vacationStart;
  DateTime? vacationEnd;

  @override
  void initState() {
    super.initState();
    final bloc = context.read<SubscriptionBloc>();
    final blocState = bloc.state;
    if (blocState is SubscriptionLoaded) {
      _subscriptions = List.from(blocState.subscriptions);
    } else {
      _subscriptions = [];
    }
    final authState = context.read<AuthBloc>().state;
    final sessionState = context.read<CustomerSessionCubit>().state;
    if (authState is Authenticated || sessionState.profile != null) {
      bloc.add(LoadSubscriptions());
    }
  }





  void _deleteSubscription(Subscription sub) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Subscription', style: TextStyle(fontWeight: FontWeight.w800, color: kText)),
        content: Text('Are you sure you want to stop your subscription for ${_prettifyName(sub.productName)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: kTextSub)),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                _subscriptions.removeWhere((s) => s.id == sub.id);
              });
              Navigator.pop(ctx);
              F2HToast.success(context, 'Subscription cancelled.');
            },
            child: const Text('Delete', style: TextStyle(color: kRed, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showSkipDayDialog(Subscription sub) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SubscriptionCalendarScreen(subscription: sub),
      ),
    );
  }

  // void _showAddModifyModal({Subscription? existing}) {
  //   final isEdit = existing != null;
  //   Map<String, dynamic> selectedProduct = _availableProducts.firstWhere(
  //     (p) => p['name'] == existing?.productName,
  //     orElse: () => _availableProducts.first,
  //   );
  //   int qty = existing?.qty ?? 1;
  //   String freq = existing?.frequency ?? 'Daily';
  //   String slot = existing?.slot ?? '6:00 AM';

  //   showModalBottomSheet(
  //     context: context,
  //     isScrollControlled: true,
  //     backgroundColor: Colors.transparent,
  //     builder: (ctx) {
  //       return StatefulBuilder(
  //         builder: (context, setModalState) {
  //           final double totalPerDay = selectedProduct['price'] * qty;

  //           return Container(
  //             margin: EdgeInsets.only(
  //               bottom: MediaQuery.of(context).viewInsets.bottom,
  //             ),
  //             decoration: const BoxDecoration(
  //               color: kSurface,
  //               borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
  //             ),
  //             padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
  //             child: SingleChildScrollView(
  //               child: Column(
  //                 mainAxisSize: MainAxisSize.min,
  //                 crossAxisAlignment: CrossAxisAlignment.start,
  //                 children: [

  //                   Row(
  //                     mainAxisAlignment: MainAxisAlignment.spaceBetween,
  //                     children: [
  //                       Text(
  //                         isEdit ? 'Modify Subscription' : 'New Subscription Delivery',
  //                         style: const TextStyle(
  //                           fontSize: 18,
  //                           fontWeight: FontWeight.w900,
  //                           color: kText,
  //                         ),
  //                       ),
  //                       GestureDetector(
  //                         onTap: () => Navigator.pop(ctx),
  //                         child: Container(
  //                           padding: const EdgeInsets.all(4),
  //                           decoration: const BoxDecoration(
  //                             color: kBgDeep,
  //                             shape: BoxShape.circle,
  //                           ),
  //                           child: const Icon(Icons.close, size: 20, color: kTextMid),
  //                         ),
  //                       ),
  //                     ],
  //                   ),
  //                   const SizedBox(height: 20),
  //                   const Text(
  //                     'SELECT PRODUCT',
  //                     style: TextStyle(
  //                       fontSize: 10,
  //                       fontWeight: FontWeight.w800,
  //                       color: kTextSub,
  //                       letterSpacing: 1.2,
  //                     ),
  //                   ),
  //                   const SizedBox(height: 8),
  //                   SizedBox(
  //                     height: 90,
  //                     child: ListView.builder(
  //                       scrollDirection: Axis.horizontal,
  //                       itemCount: _availableProducts.length,
  //                       itemBuilder: (c, idx) {
  //                         final prod = _availableProducts[idx];
  //                         final isSel = selectedProduct['name'] == prod['name'];
  //                         return GestureDetector(
  //                           onTap: () {
  //                             setModalState(() {
  //                               selectedProduct = prod;
  //                             });
  //                           },
  //                           child: Container(
  //                             width: 165,
  //                             margin: const EdgeInsets.only(right: 12),
  //                             padding: const EdgeInsets.all(10),
  //                             decoration: BoxDecoration(
  //                               color: isSel ? kPrimaryPl : Colors.white,
  //                               borderRadius: BorderRadius.circular(16),
  //                               border: Border.all(
  //                                 color: isSel ? kPrimary : kBorder,
  //                                 width: 1.5,
  //                               ),
  //                               boxShadow: isSel
  //                                   ? [
  //                                       BoxShadow(
  //                                         color: kPrimary.withValues(alpha: 0.08),
  //                                         blurRadius: 8,
  //                                         offset: const Offset(0, 3),
  //                                       ),
  //                                     ]
  //                                   : [
  //                                       BoxShadow(
  //                                         color: Colors.black.withValues(alpha: 0.02),
  //                                         blurRadius: 6,
  //                                         offset: const Offset(0, 2),
  //                                       ),
  //                                     ],
  //                             ),
  //                             child: Row(
  //                               children: [
  //                                 Container(
  //                                   width: 42,
  //                                   height: 42,
  //                                   decoration: BoxDecoration(
  //                                     color: isSel ? kPrimary.withValues(alpha: 0.12) : kBgDeep,
  //                                     borderRadius: BorderRadius.circular(10),
  //                                   ),
  //                                   child: ClipRRect(
  //                                     borderRadius: BorderRadius.circular(9),
  //                                     child: buildProductImage(
  //                                       prod['name'],
  //                                       imageAsset: prod['imageAsset'],
  //                                       width: 42,
  //                                       height: 42,
  //                                       fit: BoxFit.cover,
  //                                       fallbackColor: isSel ? kPrimary : kTextSub,
  //                                     ),
  //                                   ),
  //                                 ),
  //                                 const SizedBox(width: 10),
  //                                 Expanded(
  //                                   child: Column(
  //                                     crossAxisAlignment: CrossAxisAlignment.start,
  //                                     mainAxisAlignment: MainAxisAlignment.center,
  //                                     children: [
  //                                       Text(
  //                                         _prettifyName(prod['name']),
  //                                         style: const TextStyle(
  //                                           fontSize: 12,
  //                                           fontWeight: FontWeight.w800,
  //                                           color: kText,
  //                                           letterSpacing: -0.1,
  //                                         ),
  //                                         maxLines: 1,
  //                                         overflow: TextOverflow.ellipsis,
  //                                       ),
  //                                       const SizedBox(height: 2),
  //                                       Text(
  //                                         '₹${prod['price'].toStringAsFixed(0)} /day',
  //                                         style: const TextStyle(
  //                                           fontSize: 10.5,
  //                                           color: kTextMid,
  //                                           fontWeight: FontWeight.w600,
  //                                         ),
  //                                       ),
  //                                     ],
  //                                   ),
  //                                 ),
  //                               ],
  //                             ),
  //                           ),
  //                         );
  //                       },
  //                     ),
  //                   ),
  //                   const SizedBox(height: 20),
  //                   Row(
  //                     mainAxisAlignment: MainAxisAlignment.spaceBetween,
  //                     children: [
  //                       const Column(
  //                         crossAxisAlignment: CrossAxisAlignment.start,
  //                         children: [
  //                           Text(
  //                             'DAILY QUANTITY',
  //                             style: TextStyle(
  //                               fontSize: 10,
  //                               fontWeight: FontWeight.w800,
  //                               color: kTextSub,
  //                               letterSpacing: 1.2,
  //                             ),
  //                           ),
  //                           SizedBox(height: 2),
  //                           Text(
  //                             'How many items per delivery?',
  //                             style: TextStyle(fontSize: 11, color: kMuted),
  //                           ),
  //                         ],
  //                       ),
  //                       Container(
  //                         height: 38,
  //                         decoration: BoxDecoration(
  //                           color: Colors.white,
  //                           borderRadius: BorderRadius.circular(30),
  //                           border: Border.all(color: kPrimary.withValues(alpha: 0.2), width: 1.5),
  //                           boxShadow: [
  //                             BoxShadow(
  //                               color: kPrimary.withValues(alpha: 0.04),
  //                               blurRadius: 6,
  //                               offset: const Offset(0, 2),
  //                             ),
  //                           ],
  //                         ),
  //                         child: Row(
  //                           mainAxisSize: MainAxisSize.min,
  //                           children: [
  //                             GestureDetector(
  //                               onTap: () {
  //                                 if (qty > 1) {
  //                                   setModalState(() => qty--);
  //                                 }
  //                               },
  //                               behavior: HitTestBehavior.opaque,
  //                               child: const Padding(
  //                                 padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
  //                                 child: Icon(
  //                                   Icons.remove,
  //                                   size: 16,
  //                                   color: kPrimary,
  //                                 ),
  //                               ),
  //                             ),
  //                             Text(
  //                               '$qty',
  //                               style: const TextStyle(
  //                                 fontSize: 14,
  //                                 fontWeight: FontWeight.w900,
  //                                 color: kPrimary,
  //                               ),
  //                             ),
  //                             GestureDetector(
  //                               onTap: () {
  //                                 setModalState(() => qty++);
  //                               },
  //                               behavior: HitTestBehavior.opaque,
  //                               child: const Padding(
  //                                 padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
  //                                 child: Icon(
  //                                   Icons.add,
  //                                   size: 16,
  //                                   color: kPrimary,
  //                                 ),
  //                               ),
  //                             ),
  //                           ],
  //                         ),
  //                       ),
  //                     ],
  //                   ),
  //                   const SizedBox(height: 20),
  //                   const Text(
  //                     'DELIVERY SCHEDULE',
  //                     style: TextStyle(
  //                       fontSize: 10,
  //                       fontWeight: FontWeight.w800,
  //                       color: kTextSub,
  //                       letterSpacing: 1.2,
  //                     ),
  //                   ),
  //                   const SizedBox(height: 10),
  //                   SingleChildScrollView(
  //                     scrollDirection: Axis.horizontal,
  //                     physics: const BouncingScrollPhysics(),
  //                     child: Row(
  //                       children: ['Daily', 'Alternate Days', 'Mon, Wed, Fri', 'Weekends'].map((f) {
  //                         final isSel = freq == f;
  //                         return GestureDetector(
  //                           onTap: () {
  //                             setModalState(() => freq = f);
  //                           },
  //                           child: Container(
  //                             margin: const EdgeInsets.only(right: 8),
  //                             padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
  //                             decoration: BoxDecoration(
  //                               color: isSel ? kPrimary : Colors.white,
  //                               borderRadius: BorderRadius.circular(30),
  //                               border: Border.all(
  //                                 color: isSel ? kPrimary : kBorder,
  //                                 width: 1.5,
  //                               ),
  //                               boxShadow: isSel
  //                                   ? [
  //                                       BoxShadow(
  //                                         color: kPrimary.withValues(alpha: 0.15),
  //                                         blurRadius: 6,
  //                                         offset: const Offset(0, 2),
  //                                       ),
  //                                     ]
  //                                   : [],
  //                             ),
  //                             child: Text(
  //                               f,
  //                               style: TextStyle(
  //                                 fontSize: 11.5,
  //                                 fontWeight: FontWeight.w800,
  //                                 color: isSel ? Colors.white : kTextMid,
  //                               ),
  //                             ),
  //                           ),
  //                         );
  //                       }).toList(),
  //                     ),
  //                   ),
  //                   /*
  //                   const Text(
  //                     'DELIVERY TIME SLOT',
  //                     style: TextStyle(
  //                       fontSize: 10,
  //                       fontWeight: FontWeight.w800,
  //                       color: kTextSub,
  //                       letterSpacing: 1.2,
  //                     ),
  //                   ),
  //                   const SizedBox(height: 10),
  //                   Row(
  //                     children: ['6:00 AM', '7:00 AM', '8:00 AM'].map((s) {
  //                       final isSel = slot == s;
  //                       return Expanded(
  //                         child: GestureDetector(
  //                           onTap: () {
  //                             setModalState(() => slot = s);
  //                           },
  //                           child: Container(
  //                             margin: const EdgeInsets.symmetric(horizontal: 4),
  //                             padding: const EdgeInsets.symmetric(vertical: 10),
  //                             decoration: BoxDecoration(
  //                               color: isSel ? kPrimaryPl : Colors.white,
  //                               borderRadius: BorderRadius.circular(30),
  //                               border: Border.all(
  //                                 color: isSel ? kPrimary : kBorder,
  //                                 width: 1.5,
  //                               ),
  //                             ),
  //                             child: Center(
  //                               child: Text(
  //                                 s,
  //                                 style: TextStyle(
  //                                   fontSize: 12,
  //                                   fontWeight: FontWeight.w800,
  //                                   color: isSel ? kPrimary : kTextMid,
  //                                 ),
  //                               ),
  //                             ),
  //                           ),
  //                         ),
  //                       );
  //                     }).toList(),
  //                   ),
  //                   const SizedBox(height: 24),
  //                   */
  //                   Container(
  //                     padding: const EdgeInsets.all(16),
  //                     decoration: BoxDecoration(
  //                       color: const Color(0xFFFAFBF9),
  //                       borderRadius: BorderRadius.circular(16),
  //                       border: Border.all(color: kPrimary.withValues(alpha: 0.08), width: 1),
  //                     ),
  //                     child: Row(
  //                       children: [
  //                         const Icon(Icons.info_outline, color: kPrimary, size: 20),
  //                         const SizedBox(width: 12),
  //                         Expanded(
  //                           child: RichText(
  //                             text: TextSpan(
  //                               style: const TextStyle(fontSize: 12, color: kTextMid, height: 1.4),
  //                               children: [
  //                                 const TextSpan(text: 'You will receive '),
  //                                 TextSpan(
  //                                   text: '$qty x ${_prettifyName(selectedProduct['name'])}',
  //                                   style: const TextStyle(fontWeight: FontWeight.w800, color: kText),
  //                                 ),
  //                                 const TextSpan(text: ' on a '),
  //                                 TextSpan(
  //                                   text: freq,
  //                                   style: const TextStyle(fontWeight: FontWeight.w800, color: kText),
  //                                 ),
  //                                 const TextSpan(text: '. Cost per delivery: '),
  //                                 TextSpan(
  //                                   text: '₹${totalPerDay.toStringAsFixed(0)}',
  //                                   style: const TextStyle(fontWeight: FontWeight.w900, color: kPrimary),
  //                                 ),
  //                               ],
  //                             ),
  //                           ),
  //                         ),
  //                       ],
  //                     ),
  //                   ),
  //                   const SizedBox(height: 24),
  //                   ElevatedButton(
  //                     onPressed: () {
  //                       if (isEdit) {
  //                         setState(() {
  //                           final idx = _subscriptions.indexWhere((sub) => sub.id == existing.id);
  //                           if (idx != -1) {
  //                             _subscriptions[idx] = Subscription(
  //                               id: existing.id,
  //                               productName: selectedProduct['name'],
  //                               vendorName: selectedProduct['vendor'],
  //                               emoji: '',
  //                               pricePerDay: (selectedProduct['price'] as num).toDouble(),
  //                               frequency: freq,
  //                               slot: slot,
  //                               qty: qty,
  //                               status: existing.status,
  //                               imageUrl: existing.imageUrl,
  //                             );
  //                           }
  //                         });
  //                       } else {
  //                         setState(() {
  //                           _subscriptions.add(
  //                             Subscription(
  //                               id: DateTime.now().millisecondsSinceEpoch.toString(),
  //                               productName: selectedProduct['name'],
  //                               vendorName: selectedProduct['vendor'],
  //                               emoji: '',
  //                               pricePerDay: (selectedProduct['price'] as num).toDouble(),
  //                               frequency: freq,
  //                               slot: slot,
  //                               qty: qty,
  //                               status: 'active',
  //                               imageUrl: selectedProduct['imageAsset'],
  //                             ),
  //                           );
  //                         });
  //                       }
  //                       Navigator.pop(ctx);
  //                       ScaffoldMessenger.of(context).showSnackBar(
  //                         SnackBar(
  //                           content: Text(
  //                             isEdit
  //                                 ? 'Subscription updated successfully!'
  //                                 : 'Subscription created successfully!',
  //                           ),
  //                           backgroundColor: kPrimary,
  //                         ),
  //                       );
  //                     },
  //                     style: ElevatedButton.styleFrom(
  //                       backgroundColor: kPrimary,
  //                       foregroundColor: Colors.white,
  //                       minimumSize: const Size(double.infinity, 46),
  //                       shape: RoundedRectangleBorder(
  //                         borderRadius: BorderRadius.circular(30),
  //                       ),
  //                       elevation: 0,
  //                     ),
  //                     child: Text(
  //                       isEdit ? 'SAVE CHANGES' : 'START SUBSCRIPTION',
  //                       style: const TextStyle(
  //                         fontSize: 14,
  //                         fontWeight: FontWeight.w900,
  //                         letterSpacing: 0.5,
  //                       ),
  //                     ),
  //                   ),
  //                 ],
  //               ),
  //             ),
  //           );
  //         },
  //       );
  //     },
  //   );
  // }

  Widget _subscriptionWalletCard(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final isPostpaidEnabled = sessionState.profile?.isPostpaidEnabled ?? false;
        final creditLimit = sessionState.profile?.postpaidCreditLimit ?? 0.0;
        final usedLimit = _subscriptions
            .where((s) => s.isActive && s.paymentType == 'postpaid')
            .fold<double>(0.0, (sum, s) => sum + (s.monthlyEstimate != null && s.monthlyEstimate! > 0 ? s.monthlyEstimate! : s.totalMonthlyCost));

        return Align(
          alignment: Alignment.center,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 360;

                return Container(
                  margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: kPrimary.withValues(alpha: 0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      )
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFF123E24), Color(0xFF1F8A4D), Color(0xFF38A169)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          right: -15,
                          top: -15,
                          child: Container(
                            width: 70,
                            height: 70,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.04),
                            ),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: isCompact ? 12 : 16,
                            vertical: isCompact ? 14 : 16,
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: EdgeInsets.all(isCompact ? 6 : 8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isPostpaidEnabled ? Icons.credit_card_rounded : Icons.credit_card_off_rounded,
                                  color: kAccent,
                                  size: isCompact ? 18 : 22,
                                ),
                              ),
                              SizedBox(width: isCompact ? 8 : 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    FittedBox(
                                      fit: BoxFit.scaleDown,
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                        isPostpaidEnabled ? 'POSTPAID CREDIT LIMIT' : 'POSTPAID STATUS',
                                        style: TextStyle(
                                          fontSize: isCompact ? 8.5 : 9.5,
                                          color: Colors.white.withValues(alpha: 0.6),
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: isCompact ? 0.4 : 1.0,
                                        ),
                                        maxLines: 1,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    FittedBox(
                                      fit: BoxFit.scaleDown,
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                        isPostpaidEnabled
                                            ? '₹${creditLimit.toStringAsFixed(0)} · Used: ₹${usedLimit.toStringAsFixed(0)}'
                                            : 'Not Enabled',
                                        style: TextStyle(
                                          fontSize: isCompact ? 14 : 17,
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.2,
                                        ),
                                        maxLines: 1,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  void _showContactSupportOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const Row(
                children: [
                  Icon(Icons.headset_mic_rounded, color: kPrimary, size: 24),
                  SizedBox(width: 10),
                  Text(
                    'Contact Customer Support',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF10291F),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Choose how you would like to connect with F2H support:',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 20),
              // Option 1: WhatsApp
              InkWell(
                onTap: () async {
                  Navigator.pop(ctx);
                  const msg = 'Hello F2H Support, I would like to request enabling Postpaid status for my account.';
                  final encoded = Uri.encodeComponent(msg);
                  final waUri = Uri.parse('https://wa.me/?text=$encoded');
                  try {
                    if (await canLaunchUrl(waUri)) {
                      await launchUrl(waUri, mode: LaunchMode.externalApplication);
                    } else {
                      final webUri = Uri.parse('https://api.whatsapp.com/send?text=$encoded');
                      if (await canLaunchUrl(webUri)) {
                        await launchUrl(webUri, mode: LaunchMode.externalApplication);
                      } else {
                        if (context.mounted) {
                          F2HToast.error(context, 'Could not open WhatsApp support');
                        }
                      }
                    }
                  } catch (_) {
                    if (context.mounted) {
                      F2HToast.error(context, 'Could not open WhatsApp support');
                    }
                  }
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFDCFCE7), width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(
                          color: Color(0xFF25D366),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.chat_rounded, color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Chat on WhatsApp',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF10291F),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Instant support chat on WhatsApp',
                              style: TextStyle(fontSize: 12, color: Color(0xFF16653A), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF16653A)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              // Option 2: Direct Call
              InkWell(
                onTap: () async {
                  Navigator.pop(ctx);
                  final callUri = Uri.parse('tel:+919876543210');
                  try {
                    if (await canLaunchUrl(callUri)) {
                      await launchUrl(callUri);
                    } else {
                      if (context.mounted) {
                        F2HToast.error(context, 'Could not initiate phone call');
                      }
                    }
                  } catch (_) {
                    if (context.mounted) {
                      F2HToast.error(context, 'Could not initiate phone call');
                    }
                  }
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAF8),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(
                          color: kPrimary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Call Support',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF10291F),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Speak directly with our support team',
                              style: TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: kTextSub),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUnauthenticatedEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: const BoxDecoration(
                color: kPrimaryPl,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.calendar_today_outlined,
                size: 48,
                color: kPrimary,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Manage Subscriptions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Subscribe to daily organic milk, fresh paneer, ghee, and dairy essentials delivered straight to your door.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                AppShell.of(context)?.setTab(1);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Subscribe Products',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.storefront_rounded, size: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;

    if (!isLoggedIn) {
      return Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text(
            'My Subscriptions',
            style: TextStyle(
              color: kText,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          centerTitle: true,
        ),
        body: _buildUnauthenticatedEmptyState(context),
      );
    }

    return BlocListener<SubscriptionBloc, SubscriptionState>(
      listener: (context, state) {
        if (state is SubscriptionLoaded) {
          setState(() {
            _subscriptions = List.from(state.subscriptions);
          });
        } else if (state is SubscriptionActionSuccess) {
          F2HToast.success(context, state.message);
        } else if (state is SubscriptionError) {
          final isOffline = context.read<NetworkBloc>().state is NetworkOffline;
          if (!isOffline) {
            F2HToast.error(context, state.message);
          }
        }
      },
      child: BlocBuilder<SubscriptionBloc, SubscriptionState>(
        builder: (context, state) {
          final isOffline = context.read<NetworkBloc>().state is NetworkOffline;
          if ((state is SubscriptionLoading && _subscriptions.isEmpty) || isOffline) {
            return const Scaffold(
              backgroundColor: kBg,
              body: Center(
                child: ScrollingItemsLoader(),
              ),
            );
          }
          final activeCount = _subscriptions.where((s) => s.status == 'active').length;
          final expiredCount = _subscriptions.where((s) => s.isExpired || s.status == 'expired' || s.status == 'expaired').length;
          final cancelledCount = _subscriptions.where((s) => s.status == 'cancelled').length;

          return Scaffold(
            backgroundColor: kBg,
            body: CustomScrollView(
              slivers: [
                SliverAppBar(
                  backgroundColor: kSurface,
                  surfaceTintColor: Colors.transparent,
                  pinned: true,
                  title: const Text('My Subscriptions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kText)),
                ),
                const SliverToBoxAdapter(
                  child: UnpaidBillBannerWidget(),
                ),
                SliverToBoxAdapter(
                  child: _subscriptionWalletCard(context),
                ),
                SliverToBoxAdapter(
                  child: _summaryRow(activeCount, expiredCount, cancelledCount),
                ),
                // SliverToBoxAdapter(child: _calendar()),
                _subscriptions.isEmpty
                    ? SliverToBoxAdapter(
                        child: Container(
                          margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: kBorderLt, width: 1.5),
                            boxShadow: [
                              BoxShadow(
                                color: kPrimary.withValues(alpha: 0.04),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.calendar_today_outlined, size: 48, color: kMuted),
                              const SizedBox(height: 16),
                              const Text(
                                'No Active Subscriptions',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kText),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Subscribe to daily milk, ghee, curd or fresh juices and get free morning delivery before 7 AM.',
                                style: TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 20),
                              ElevatedButton.icon(
                                onPressed: () {
                                      Navigator.push(context, 
                                        MaterialPageRoute(
                                          builder: (_) => const BrowseScreen(),
                                        ), );
                                      // or HomeScreen()
                                    },
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Add First Subscription', style: TextStyle(fontWeight: FontWeight.w800)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: kPrimary,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) {
                              final sub = _subscriptions[i];
                              return SubCard(
                                sub,
                                onSkip: () => _showSkipDayDialog(sub),
                                onDelete: () => _deleteSubscription(sub),
                              );
                            },
                            childCount: _subscriptions.length,
                          ),
                        ),
                      ),
                // SliverToBoxAdapter(child: _vacBanner()),
                const SliverToBoxAdapter(child: SizedBox(height: 40)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _summaryRow(int active, int expired, int cancelled) => Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderLt, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.03),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildStatItem('$active', 'Active', kPrimary, Icons.check_circle_outline_rounded),
            _buildStatDivider(),
            _buildStatItem('$expired', 'Expired', kAccent, Icons.pause_circle_outline_rounded),
            _buildStatDivider(),
            _buildStatItem('$cancelled', 'Cancelled', kRed, Icons.cancel_outlined),
          ],
        ),
      );

  Widget _buildStatItem(String val, String label, Color color, IconData icon) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 16, color: color.withValues(alpha: 0.8)),
          const SizedBox(height: 4),
          Text(
            val,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 9.5, color: kTextSub, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildStatDivider() {
    return Container(
      width: 1,
      height: 32,
      color: kBorderLt,
    );
  }

  // Widget _calendar() {
  //   final today = DateTime.now();
  //   final dates = List.generate(7, (i) => today.add(Duration(days: i)));

  //   return Container(
  //     margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
  //     padding: const EdgeInsets.all(16),
  //     decoration: BoxDecoration(
  //       color: kSurface,
  //       borderRadius: BorderRadius.circular(20),
  //       border: Border.all(color: kBorderLt, width: 1.5),
  //       boxShadow: [
  //         BoxShadow(
  //           color: kPrimary.withValues(alpha: 0.03),
  //           blurRadius: 12,
  //           offset: const Offset(0, 4),
  //         ),
  //       ],
  //     ),
  //     child: Column(
  //       crossAxisAlignment: CrossAxisAlignment.start,
  //       children: [
  //         Row(
  //           mainAxisAlignment: MainAxisAlignment.spaceBetween,
  //           children: [
  //             const Text(
  //               "This Week's Deliveries",
  //               style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kTextMid),
  //             ),
  //             if (skippedDates.isNotEmpty)
  //               GestureDetector(
  //                 onTap: () {
  //                   setState(() {
  //                     skippedDates.clear();
  //                   });
  //                   ScaffoldMessenger.of(context).showSnackBar(
  //                     const SnackBar(
  //                       content: Text('Cleared all skipped days.'),
  //                       backgroundColor: kPrimary,
  //                     ),
  //                   );
  //                 },
  //                 child: const Text(
  //                   "Reset Skips",
  //                   style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kPrimary),
  //                 ),
  //               ),
  //           ],
  //         ),
  //         const SizedBox(height: 16),
  //         Row(
  //           children: List.generate(7, (i) {
  //             final date = dates[i];
  //             final isToday = i == 0;
  //             final isVac = _isVacation(date);
  //             final isSkip = _isSkipped(date);

  //             final hasDel = _subscriptions.any((sub) => _hasDeliveryOn(date, sub));

  //             Color circleBg = Colors.transparent;
  //             Color borderCol = Colors.transparent;
  //             Color textCol = kMuted;

  //             if (isToday) {
  //               circleBg = kPrimary;
  //               borderCol = kPrimary;
  //               textCol = Colors.white;
  //             } else if (isVac) {
  //               circleBg = kAccentLt;
  //               borderCol = kAccent.withOpacity(0.3);
  //               textCol = const Color(0xFF8A5A00);
  //             } else if (isSkip) {
  //               circleBg = kBgDeep;
  //               borderCol = kBorder;
  //               textCol = kTextSub.withOpacity(0.5);
  //             } else if (hasDel) {
  //               circleBg = kPrimaryPl;
  //               borderCol = kPrimaryLt.withOpacity(0.3);
  //               textCol = kPrimary;
  //             }

  //             return Expanded(
  //               child: Column(
  //                 children: [
  //                   Text(
  //                     _getWeekdayShort(date.weekday).substring(0, 1),
  //                     style: TextStyle(
  //                       fontSize: 10,
  //                       fontWeight: FontWeight.w800,
  //                       color: isToday ? kPrimary : kMuted,
  //                     ),
  //                   ),
  //                   const SizedBox(height: 6),
  //                   AnimatedContainer(
  //                     duration: const Duration(milliseconds: 200),
  //                     width: 32,
  //                     height: 32,
  //                     decoration: BoxDecoration(
  //                       color: circleBg,
  //                       shape: BoxShape.circle,
  //                       border: Border.all(color: borderCol, width: 1.5),
  //                     ),
  //                     child: Center(
  //                       child: isVac
  //                           ? const Icon(Icons.beach_access_outlined, size: 14, color: Color(0xFF8A5A00))
  //                           : isSkip
  //                               ? Text(
  //                                   '${date.day}',
  //                                   style: TextStyle(
  //                                     fontSize: 11,
  //                                     fontWeight: FontWeight.w700,
  //                                     color: textCol,
  //                                     decoration: TextDecoration.lineThrough,
  //                                   ),
  //                                 )
  //                               : Text(
  //                                   '${date.day}',
  //                                   style: TextStyle(
  //                                     fontSize: 11,
  //                                     fontWeight: FontWeight.w800,
  //                                     color: textCol,
  //                                   ),
  //                                 ),
  //                     ),
  //                   ),
  //                   const SizedBox(height: 4),
  //                   Container(
  //                     width: 5,
  //                     height: 5,
  //                     decoration: BoxDecoration(
  //                       color: isVac
  //                           ? kAccent
  //                           : isSkip
  //                               ? kRed
  //                               : (hasDel ? kPrimary : Colors.transparent),
  //                       shape: BoxShape.circle,
  //                     ),
  //                   ),
  //                 ],
  //               ),
  //             );
  //           }),
  //         ),
  //       ],
  //     ),
  //   );
  // }
}

String _prettifyName(String name) {
  return name
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) {
        if (word.isEmpty) return '';
        return word[0].toUpperCase() + word.substring(1);
      })
      .join(' ');
}

