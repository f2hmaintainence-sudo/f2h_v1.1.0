import 'dart:ui';
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
//  WALLET SCREEN — Premium Emerald Redesign
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
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 32),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 32, 28, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF15803D), Color(0xFF22C55E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: Colors.white,
                  size: 36,
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'Money Added!',
                style: AppTypography.titleLarge.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  color: kText,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: AppTypography.bodyMedium.copyWith(
                    color: kTextSub,
                    height: 1.5,
                  ),
                  children: [
                    const TextSpan(text: '₹'),
                    TextSpan(
                      text: amount.toStringAsFixed(0),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF16A34A),
                        fontSize: 18,
                      ),
                    ),
                    const TextSpan(
                        text: ' has been credited\nto your F2H Wallet.'),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    'Great, Thanks!',
                    style: AppTypography.labelLarge.copyWith(
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openTopup() async {
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
      backgroundColor: Colors.transparent,
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
  }

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
    child: Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: RefreshIndicator(
        color: kPrimary,
        onRefresh: () async {
          await context.read<CustomerSessionCubit>().bootstrap();
          await _transactionsController.refresh();
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── GRADIENT HERO (replaces flat AppBar + card) ──────
            BlocConsumer<CustomerSessionCubit, CustomerSessionState>(
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
                    double.tryParse(
                      state.wallet['balance']?.toString() ?? '',
                    ) ??
                    0.0;
                final balanceToDisplay = (pBal > wBal ? pBal : wBal);

                return _HeroHeader(
                  balance: balanceToDisplay,
                  isLoading: state.status == CustomerSessionStatus.loading,
                  onBack: () => Navigator.maybePop(context),
                  onAddMoney: _openTopup,
                );
              },
            ),

            // ── QUICK STATS STRIP ────────────────────────────────
            SliverToBoxAdapter(
              child: _QuickStatsStrip(
                controller: _transactionsController,
              ),
            ),

            // ── TRANSACTIONS HEADER ──────────────────────────────
            SliverToBoxAdapter(child: _sectionHead('Recent Transactions')),
            WalletTransactionsSliver(controller: _transactionsController),

            const SliverToBoxAdapter(child: SizedBox(height: 48)),
          ],
        ),
      ),
    ),
  );

  Widget _sectionHead(String t) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
    child: Row(
      children: [
        Text(
          t,
          style: AppTypography.headlineSmall.copyWith(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: kText,
            letterSpacing: -0.3,
          ),
        ),
        const Spacer(),
        ListenableBuilder(
          listenable: _transactionsController,
          builder: (context, _) {
            final count = _transactionsController.transactions.length;
            if (count == 0) return const SizedBox.shrink();
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$count',
                style: AppTypography.labelSmall.copyWith(
                  color: kPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
            );
          },
        ),
      ],
    ),
  );
}

// ═══════════════════════════════════════════════════════════════
//  HERO HEADER — Full gradient card with sliver behaviour
// ═══════════════════════════════════════════════════════════════
class _HeroHeader extends StatelessWidget {
  final double balance;
  final bool isLoading;
  final VoidCallback onBack;
  final VoidCallback onAddMoney;

  const _HeroHeader({
    required this.balance,
    required this.isLoading,
    required this.onBack,
    required this.onAddMoney,
  });

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF064E3B), Color(0xFF15803D), Color(0xFF16A34A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top nav row ──
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 4, 16, 0),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                      onPressed: onBack,
                    ),
                    Expanded(
                      child: Text(
                        'My Wallet',
                        style: AppTypography.titleMedium.copyWith(
                          color: Colors.white.withValues(alpha: 0.92),
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ),
                    // Wallet icon badge
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // ── Balance area ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'F2H Wallet Balance',
                      style: AppTypography.labelMedium.copyWith(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: isLoading
                          ? Container(
                              key: const ValueKey('loading'),
                              height: 46,
                              width: 160,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(10),
                              ),
                            )
                          : Text(
                              '₹${balance.toStringAsFixed(2)}',
                              key: ValueKey(balance),
                              style: AppTypography.displayLarge.copyWith(
                                fontSize: 40,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: -1.0,
                                height: 1.0,
                              ),
                            ),
                    ),
                    const SizedBox(height: 12),

                    // Status pill
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF86EFAC),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Active · F2H Platinum',
                                style: AppTypography.labelSmall.copyWith(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // ── CTA Button ──
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                child: GestureDetector(
                  onTap: onAddMoney,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          decoration: const BoxDecoration(
                            color: Color(0xFFDCFCE7),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.add_rounded,
                            color: Color(0xFF16A34A),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Add Money',
                          style: AppTypography.labelLarge.copyWith(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF16A34A),
                            letterSpacing: 0.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  QUICK STATS STRIP
// ═══════════════════════════════════════════════════════════════
class _QuickStatsStrip extends StatelessWidget {
  final WalletTransactionsController controller;

  const _QuickStatsStrip({required this.controller});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final txns = controller.transactions;
        double totalSpent = 0;
        double lastTopup = 0;

        for (final t in txns) {
          final isCredit =
              t.transactionType.toLowerCase() == 'credit' ||
              t.transactionType.toLowerCase() == 'refund' ||
              t.transactionType.toLowerCase() == 'cashback';
          if (!isCredit) {
            totalSpent += t.amount;
          } else if (lastTopup == 0) {
            lastTopup = t.amount;
          }
        }

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(20),
              bottomRight: Radius.circular(20),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              _StatCell(
                label: 'Total Spent',
                value: '₹${totalSpent.toStringAsFixed(0)}',
                icon: Icons.shopping_bag_outlined,
                iconColor: const Color(0xFFEF4444),
                iconBg: const Color(0xFFFEE2E2),
              ),
              Container(
                width: 1,
                height: 40,
                color: const Color(0xFFF1F5F9),
              ),
              _StatCell(
                label: 'Last Top-up',
                value: lastTopup > 0
                    ? '₹${lastTopup.toStringAsFixed(0)}'
                    : '—',
                icon: Icons.north_east_rounded,
                iconColor: const Color(0xFF16A34A),
                iconBg: const Color(0xFFDCFCE7),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatCell extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;

  const _StatCell({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: AppTypography.labelSmall.copyWith(
                    fontSize: 10.5,
                    color: kTextSub,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: AppTypography.titleMedium.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: kText,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
