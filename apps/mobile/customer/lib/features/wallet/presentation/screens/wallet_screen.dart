import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/transaction_tile.dart';
// import 'package:f2h_customer/features/orders/data/models/order_model.dart';
// import 'package:f2h_customer/features/orders/presentation/widgets/order_tile.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/topup_drawer.dart';
// ══════════════════════════════════════════════════════════
//  WALLET SCREEN — Clean white unique redesign
// ══════════════════════════════════════════════════════════

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final int _transactionsReload = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final state = context.read<CustomerSessionCubit>().state;
      if (state.status == CustomerSessionStatus.initial ||
          state.status == CustomerSessionStatus.failure) {
        context.read<CustomerSessionCubit>().bootstrap();
      }
    });
  }

  // void _showTopUpSheet(BuildContext context) {
  //   double selectedAmount = 500;
  //   showModalBottomSheet(
  //     context: context,
  //     backgroundColor: Colors.white,
  //     shape: const RoundedRectangleBorder(
  //       borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
  //     ),
  //     builder: (ctx) {
  //       return StatefulBuilder(
  //         builder: (context, setModalState) {
  //           return Padding(
  //             padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
  //             child: Column(
  //               mainAxisSize: MainAxisSize.min,
  //               crossAxisAlignment: CrossAxisAlignment.start,
  //               children: [
  //                 Center(
  //                   child: Container(
  //                     width: 36,
  //                     height: 4,
  //                     decoration: BoxDecoration(
  //                       color: kBorder,
  //                       borderRadius: BorderRadius.circular(2),
  //                     ),
  //                   ),
  //                 ),
  //                 const SizedBox(height: 16),
  //                 const Text(
  //                   'Add Money to Wallet',
  //                   style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: kText),
  //                 ),
  //                 const SizedBox(height: 20),
  //                 Container(
  //                   padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  //                   decoration: BoxDecoration(
  //                     color: const Color(0xFFF5F5F5),
  //                     borderRadius: BorderRadius.circular(14),
  //                   ),
  //                   child: Row(
  //                     mainAxisAlignment: MainAxisAlignment.spaceBetween,
  //                     children: [
  //                       const Text('Amount to add',
  //                           style: TextStyle(color: kTextSub, fontSize: 13)),
  //                       Text(
  //                         '₹${selectedAmount.toStringAsFixed(0)}',
  //                         style: const TextStyle(
  //                             color: kPrimary, fontSize: 22, fontWeight: FontWeight.w900),
  //                       ),
  //                     ],
  //                   ),
  //                 ),
  //                 const SizedBox(height: 16),
  //                 Row(
  //                   children: [200.0, 500.0, 1000.0].map((amt) {
  //                     final isSel = selectedAmount == amt;
  //                     return Expanded(
  //                       child: GestureDetector(
  //                         onTap: () => setModalState(() => selectedAmount = amt),
  //                         child: AnimatedContainer(
  //                           duration: const Duration(milliseconds: 200),
  //                           margin: const EdgeInsets.symmetric(horizontal: 4),
  //                           padding: const EdgeInsets.symmetric(vertical: 12),
  //                           decoration: BoxDecoration(
  //                             color: isSel ? kPrimary : Colors.white,
  //                             borderRadius: BorderRadius.circular(12),
  //                             border: Border.all(
  //                                 color: isSel ? kPrimary : kBorder),
  //                           ),
  //                           child: Text(
  //                             '+ ₹${amt.toStringAsFixed(0)}',
  //                             textAlign: TextAlign.center,
  //                             style: TextStyle(
  //                               fontWeight: FontWeight.w700,
  //                               fontSize: 13,
  //                               color: isSel ? Colors.white : kTextMid,
  //                             ),
  //                           ),
  //                         ),
  //                       ),
  //                     );
  //                   }).toList(),
  //                 ),
  //                 const SizedBox(height: 24),
  //                 ElevatedButton(
  //                   onPressed: () {
  //                     cartController.recharge(selectedAmount);
  //                     Navigator.pop(ctx);
  //                     _showTopUpSuccess(context, selectedAmount);
  //                   },
  //                   style: ElevatedButton.styleFrom(
  //                     backgroundColor: kPrimary,
  //                     foregroundColor: Colors.white,
  //                     minimumSize: const Size(double.infinity, 52),
  //                     shape: RoundedRectangleBorder(
  //                         borderRadius: BorderRadius.circular(14)),
  //                     elevation: 0,
  //                   ),
  //                   child: const Text('PROCEED TO PAY',
  //                       style:
  //                           TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
  //                 ),
  //               ],
  //             ),
  //           );
  //         },
  //       );
  //     },
  //   );
  // }

  void _showTopUpSuccess(BuildContext context, double amount) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: kPrimaryPl,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: kPrimary,
                size: 44,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Top-up Successful!',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '₹${amount.toStringAsFixed(0)} added to your wallet.',
              style: const TextStyle(fontSize: 13, color: kTextSub),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Awesome',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF5F5F5),
    body: CustomScrollView(
      slivers: [
        // ── APP BAR ─────────────────────────────────────
        const SliverAppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          pinned: true,
          elevation: 0,
          title: Text(
            'Wallet & Orders',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: kText,
            ),
          ),
        ),

        // ── BALANCE HERO CARD ──────────────────────────
        SliverToBoxAdapter(
          child: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
            builder: (context, state) {
              final profile = state.profile;
              return _buildBalanceCard(
                context,
                double.tryParse((profile?.walletBalance ?? 0).toString()) ?? 0,
                isLoading: state.status == CustomerSessionStatus.loading,
              );
            },
          ),
        ),

        // ── QUICK ACTIONS ─────────────────────────────
        // SliverToBoxAdapter(child: _buildQuickActions(context)),

        // ── REWARDS BANNER ─────────────────────────────
        // SliverToBoxAdapter(child: _buildRewardsBanner(context)),

        // ── TRANSACTIONS ──────────────────────────────
        SliverToBoxAdapter(child: _sectionHead('Transactions')),
        const WalletTransactionsSliver(),

        // ── RECENT ORDERS ─────────────────────────────
        // SliverToBoxAdapter(child: _sectionHead('Recent Orders')),
        // SliverList(
        //   delegate: SliverChildBuilderDelegate(
        //     (_, i) => ORow(mockOrders[i]),
        //     childCount: mockOrders.length,
        //   ),
        // ),
        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ],
    ),
  );

  Widget _buildBalanceCard(
    BuildContext context,
    double walletBalance, {
    required bool isLoading,
  }) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Balance display
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,

            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'F2H Wallet Balance',
                    style: TextStyle(
                      fontSize: 12,
                      color: kTextSub,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),

                  Text(
                    isLoading
                        ? 'Loading...'
                        : '₹${walletBalance.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      color: kText,
                      letterSpacing: -1,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: Icon(
                    Icons.account_balance_wallet_outlined,
                    color: kPrimary,
                    size: 26,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Status pill
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, color: kPrimaryLt, size: 7),
                    SizedBox(width: 6),
                    Text(
                      'Active · F2H Platinum',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: kPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              const Text(
                'VALID THRU 12/32',
                style: TextStyle(
                  fontSize: 10,
                  color: kMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Add money button
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                builder: (_) => const TopupDrawer(),
              );
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: kPrimary,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_circle_outline, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Add Money',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          _actionBtn(Icons.history_rounded, 'History', () {}),
          _actionBtn(
            Icons.card_giftcard_rounded,
            '234 Points',
            () => _showRewardsInfo(context),
          ),
          _actionBtn(
            Icons.share_rounded,
            'Refer & Earn',
            () => _showReferInfo(context),
          ),
          _actionBtn(Icons.receipt_outlined, 'Statement', () {}),
        ],
      ),
    );
  }

  Widget _actionBtn(IconData icon, String label, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
          child: Column(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(child: Icon(icon, color: kText, size: 20)),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: kTextSub,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRewardsBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF8E1), Color(0xFFFFF3CD)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kAccent.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: kAccent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Center(
              child: Icon(Icons.stars_rounded, color: kAccent, size: 26),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '234 Reward Points',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF6D4C00),
                  ),
                ),
                Text(
                  'Earn 1 point for every ₹10 spent',
                  style: TextStyle(
                    fontSize: 11,
                    color: kAccent.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: kAccent,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              'Redeem',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A1000),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showRewardsInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.card_giftcard, color: kPrimary, size: 24),
            SizedBox(width: 8),
            Text(
              'F2H Reward Points',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Current points: 234',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: kPrimary,
              ),
            ),
            SizedBox(height: 12),
            Text(
              'Earn 1 point for every ₹10 spent. Points can be redeemed for free delivery or discounts!',
              style: TextStyle(color: kTextMid, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Close',
              style: TextStyle(color: kPrimary, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  void _showReferInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.share, color: kAccent, size: 24),
            SizedBox(width: 8),
            Text('Refer & Earn', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Get ₹100 Wallet Cash',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: kAccent,
              ),
            ),
            SizedBox(height: 12),
            Text(
              'Share your referral code and get ₹100 cash back when your friend places their first order!',
              style: TextStyle(color: kTextMid, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Close',
              style: TextStyle(color: kPrimary, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHead(String t) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
    child: Text(
      t,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        color: kText,
      ),
    ),
  );
}
