import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_typography.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/wallet/data/models/transaction_model.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/transaction_tile.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/topup_drawer.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/core/payments/payment_recovery_service.dart';

// ══════════════════════════════════════════════════════════
//  WALLET SCREEN — Clean white unique redesign
// ══════════════════════════════════════════════════════════

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen>
    with WidgetsBindingObserver {
  late final WalletTransactionsController _transactionsController;

  @override
  void initState() {
    super.initState();
    _transactionsController = WalletTransactionsController();
    WidgetsBinding.instance.addObserver(this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CustomerSessionCubit>().bootstrap();
      PaymentRecoveryService.instance.checkAndRecoverPendingPayment(context);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _handleAppResumed();
    }
  }

  Future<void> _handleAppResumed() async {
    if (!mounted) return;
    try {
      await PaymentRecoveryService.instance.checkAndRecoverPendingPayment(
        context,
        showToast: true,
      );
    } catch (_) {}

    if (!mounted) return;
    try {
      await context.read<CustomerSessionCubit>().refresh();
    } catch (_) {}

    if (mounted) {
      _transactionsController.refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _transactionsController.dispose();
    super.dispose();
  }

  void _handleTopupSuccess(TopupSuccessResult result) {
    if (!mounted) return;
    final session = context.read<CustomerSessionCubit>().state;
    final customerId = session.profile?.customerId ?? '';
    final currentBal = session.profile?.walletBalance ?? 0.0;
    final newBal = result.newBalance ?? (currentBal + result.amount);

    _transactionsController.prependTransaction(
      CustomerWalletTransaction(
        id: DateTime.now().millisecondsSinceEpoch,
        transactionId: result.transactionId ??
            'WT${DateTime.now().millisecondsSinceEpoch}',
        customerId: customerId,
        transactionType: 'credit',
        amount: result.amount,
        balanceAfter: newBal,
        referenceType: 'topup',
        referenceId: result.transactionId,
        remarks: 'Wallet top-up via Razorpay',
        createdBy: customerId,
        createdAt: DateTime.now(),
      ),
    );

    _transactionsController.refresh();
  }

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
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF16A34A),
                size: 44,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Top-up Successful!',
              style: AppTypography.titleLarge.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFF16A34A),
                letterSpacing: 0.0,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '₹${amount.toStringAsFixed(0)} added to your wallet.',
              style: AppTypography.bodySmall.copyWith(
                color: kTextSub,
                letterSpacing: 0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: Text(
                'Awesome',
                style: AppTypography.labelLarge.copyWith(
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: 0.1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8F9FA),
    body: RefreshIndicator(
      color: kPrimary,
      onRefresh: () async {
        await context.read<CustomerSessionCubit>().bootstrap();
        await _transactionsController.refresh();
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── APP BAR ─────────────────────────────────────
          SliverAppBar(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            pinned: true,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: kText),
              onPressed: () => Navigator.maybePop(context),
            ),
            title: Text(
              'Wallet & Transactions',
              style: AppTypography.headlineSmall.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: kText,
                letterSpacing: -0.3,
              ),
            ),
          ),

          // ── BALANCE HERO CARD ──────────────────────────
          SliverToBoxAdapter(
            child: BlocConsumer<CustomerSessionCubit, CustomerSessionState>(
              listenWhen: (previous, current) {
                final prevBal = previous.profile?.walletBalance ?? 0.0;
                final currBal = current.profile?.walletBalance ?? 0.0;
                return prevBal != currBal;
              },
              listener: (context, state) {
                _transactionsController.refresh();
              },
              builder: (context, state) {
                final profile = state.profile;
                final pBal = profile?.walletBalance ?? 0.0;
                final wBal =
                    double.tryParse(state.wallet['balance']?.toString() ?? '') ??
                        0.0;
                final balanceToDisplay = (pBal > wBal ? pBal : wBal);

                return _buildBalanceCard(
                  context,
                  balanceToDisplay,
                  isLoading: state.status == CustomerSessionStatus.loading,
                );
              },
            ),
          ),

          // ── TRANSACTIONS ──────────────────────────────
          SliverToBoxAdapter(child: _sectionHead('Transactions')),
          WalletTransactionsSliver(controller: _transactionsController),

          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    ),
  );

  Widget _buildBalanceCard(
    BuildContext context,
    double walletBalance, {
    required bool isLoading,
  }) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEEEEEE), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Balance display
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'F2H Wallet Balance',
                      style: AppTypography.labelMedium.copyWith(
                        fontSize: 12,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isLoading
                          ? 'Loading...'
                          : '₹${walletBalance.toStringAsFixed(2)}',
                      style: AppTypography.displayLarge.copyWith(
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                        color: kText,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: Icon(
                    Icons.account_balance_wallet_rounded,
                    color: Color(0xFF16A34A),
                    size: 26,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Status pill (Clean badge without valid thru)
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.circle, color: Color(0xFF16A34A), size: 7),
                    const SizedBox(width: 6),
                    Text(
                      'Active · F2H Platinum',
                      style: AppTypography.labelSmall.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF16A34A),
                        letterSpacing: 0.25,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Add money button
          GestureDetector(
            onTap: () async {
              HapticFeedback.lightImpact();
              final authState = context.read<AuthBloc>().state;
              final sessionState = context.read<CustomerSessionCubit>().state;
              final isLoggedIn =
                  authState is Authenticated || sessionState.profile != null;

              if (!isLoggedIn) {
                F2HToast.info(
                  context,
                  'Please sign in to add money to wallet.',
                  title: 'Sign In Required',
                  actionText: 'Sign In',
                  onAction: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const LoginScreen(popOnSuccess: true),
                      ),
                    );
                  },
                );
                return;
              }

              bool handledLive = false;
              final result = await showModalBottomSheet<dynamic>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(24)),
                ),
                builder: (_) => TopupDrawer(
                  onTopupSuccess: (topupResult) {
                    handledLive = true;
                    _handleTopupSuccess(topupResult);
                  },
                ),
              );

              if (!mounted) return;

              if (result is TopupSuccessResult) {
                if (!handledLive) {
                  _handleTopupSuccess(result);
                }
                _showTopUpSuccess(context, result.amount);
              } else {
                _transactionsController.refresh();
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.add_circle_outline_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Add Money',
                    style: AppTypography.labelLarge.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.1,
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

  Widget _sectionHead(String t) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 10),
    child: Text(
      t,
      style: AppTypography.headlineSmall.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: kText,
        letterSpacing: -0.3,
      ),
    ),
  );
}
