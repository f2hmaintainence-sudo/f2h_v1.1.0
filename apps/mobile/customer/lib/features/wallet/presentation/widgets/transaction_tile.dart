import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_typography.dart';
import 'package:f2h_customer/features/wallet/data/models/transaction_model.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/transaction_detaild.dart';

class WalletTransactionsController extends ChangeNotifier {
  List<CustomerWalletTransaction> _transactions = [];
  bool _isLoading = false;
  String? _error;
  bool _isUnauthorized = false;
  int _requestSeq = 0;

  List<CustomerWalletTransaction> get transactions => _transactions;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isUnauthorized => _isUnauthorized;

  /// Immediately prepends a newly created transaction (e.g. after top-up)
  /// so it reflects live on screen without requiring a reload or wait.
  void prependTransaction(CustomerWalletTransaction tx) {
    // Remove if already in list to avoid duplicates and ensure it moves to index 0
    _transactions.removeWhere(
      (t) =>
          (tx.transactionId != null &&
              tx.transactionId!.isNotEmpty &&
              t.transactionId == tx.transactionId) ||
          (tx.referenceId != null &&
              tx.referenceId!.isNotEmpty &&
              (t.referenceId == tx.referenceId || t.transactionId == tx.referenceId)) ||
          (tx.id > 0 && t.id == tx.id),
    );
    _transactions.insert(0, tx);
    notifyListeners();
  }

  Future<void> refresh() async {
    final seq = ++_requestSeq;

    if (_transactions.isEmpty) {
      _isLoading = true;
      notifyListeners();
    }

    try {
      final response = await sl<DioClient>().dio.get(
            ApiEndpoints.customerWalletTransactions,
          );

      // Discard superseded out-of-order responses
      if (seq != _requestSeq) return;

      final raw = response.data;
      if (raw is Map && raw['status'] == false) {
        throw Exception(raw['message'] ?? 'Failed to load transactions');
      }

      final data = raw is Map ? raw['data'] : raw;
      if (data is List) {
        final serverList = data
            .whereType<Map>()
            .map((item) => CustomerWalletTransaction.fromJson(
                  Map<String, dynamic>.from(item),
                ))
            .toList();

        // Intelligently preserve any recently prepended local transactions (< 2 minutes old)
        // that may still be committing or replicating on the server.
        final merged = <CustomerWalletTransaction>[...serverList];
        final now = DateTime.now();

        for (final localTx in _transactions) {
          final isRecent = localTx.createdAt != null &&
              now.difference(localTx.createdAt!).inMinutes < 2;

          if (isRecent) {
            final existsInServer = serverList.any(
              (s) =>
                  (localTx.transactionId != null &&
                      localTx.transactionId!.isNotEmpty &&
                      s.transactionId == localTx.transactionId) ||
                  (localTx.referenceId != null &&
                      localTx.referenceId!.isNotEmpty &&
                      (s.referenceId == localTx.referenceId ||
                          s.transactionId == localTx.referenceId)) ||
                  (localTx.id > 0 && s.id == localTx.id),
            );

            if (!existsInServer) {
              merged.insert(0, localTx);
            }
          }
        }

        _transactions = merged;
        _error = null;
        _isUnauthorized = false;
      }
    } catch (e) {
      if (seq != _requestSeq) return;

      final errStr = e.toString().toLowerCase();
      if (errStr.contains('unauthorized') || errStr.contains('401')) {
        _isUnauthorized = true;
      }
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map && data['message'] != null) {
          _error = data['message'].toString();
        } else {
          _error = 'Unable to load transactions';
        }
      } else {
        _error = 'Unable to load transactions';
      }
    } finally {
      if (seq == _requestSeq) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }
}

class WalletTransactionsSliver extends StatefulWidget {
  final int reloadKey;
  final WalletTransactionsController? controller;

  const WalletTransactionsSliver({
    super.key,
    this.reloadKey = 0,
    this.controller,
  });

  @override
  State<WalletTransactionsSliver> createState() =>
      _WalletTransactionsSliverState();
}

class _WalletTransactionsSliverState extends State<WalletTransactionsSliver> {
  late WalletTransactionsController _effectiveController;
  bool _createdInternalController = false;

  @override
  void initState() {
    super.initState();
    if (widget.controller != null) {
      _effectiveController = widget.controller!;
    } else {
      _effectiveController = WalletTransactionsController();
      _createdInternalController = true;
    }
    _effectiveController.addListener(_onControllerUpdate);
    _effectiveController.refresh();
  }

  @override
  void didUpdateWidget(covariant WalletTransactionsSliver oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.controller != oldWidget.controller) {
      oldWidget.controller?.removeListener(_onControllerUpdate);
      if (widget.controller != null) {
        _effectiveController = widget.controller!;
        _createdInternalController = false;
      } else {
        _effectiveController = WalletTransactionsController();
        _createdInternalController = true;
      }
      _effectiveController.addListener(_onControllerUpdate);
      _effectiveController.refresh();
    } else if (widget.reloadKey != oldWidget.reloadKey) {
      _effectiveController.refresh();
    }
  }

  void _onControllerUpdate() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _effectiveController.removeListener(_onControllerUpdate);
    if (_createdInternalController) {
      _effectiveController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_effectiveController.isLoading &&
        _effectiveController.transactions.isEmpty) {
      return const SliverToBoxAdapter(
        child: _TransactionStateMessage(
          icon: Icons.receipt_long_outlined,
          title: 'Loading transactions...',
        ),
      );
    }

    if (_effectiveController.isUnauthorized) {
      return SliverToBoxAdapter(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFEEEEEE)),
          ),
          child: Column(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(
                  color: Color(0xFFE8F5E9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.account_circle_outlined,
                  size: 30,
                  color: kPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Login to View Transactions',
                textAlign: TextAlign.center,
                style: AppTypography.titleLarge.copyWith(
                  fontWeight: FontWeight.w700,
                  color: kText,
                  letterSpacing: 0.0,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Sign in to view wallet balance, history, and rewards.',
                textAlign: TextAlign.center,
                style: AppTypography.bodySmall.copyWith(
                  color: kTextSub,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(46),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  'LOGIN',
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

    if (_effectiveController.error != null &&
        _effectiveController.transactions.isEmpty) {
      return SliverToBoxAdapter(
        child: _TransactionStateMessage(
          icon: Icons.error_outline_rounded,
          title: _effectiveController.error!,
          actionLabel: 'Retry',
          onAction: () => _effectiveController.refresh(),
        ),
      );
    }

    final transactions = _effectiveController.transactions;

    if (transactions.isEmpty) {
      return SliverToBoxAdapter(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFEEEEEE)),
          ),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
                  size: 26,
                  color: kTextSub,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'No transactions yet',
                style: AppTypography.titleMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: kText,
                  letterSpacing: 0.0,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Your top-ups and order payments will show up here.',
                style: AppTypography.bodySmall.copyWith(
                  color: kTextSub,
                  letterSpacing: 0.2,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => TransactionTile(transactions[index]),
        childCount: transactions.length,
      ),
    );
  }
}

class TransactionTile extends StatelessWidget {
  final CustomerWalletTransaction transaction;

  const TransactionTile(this.transaction, {super.key});

  @override
  Widget build(BuildContext context) {
    final isCredit = _isCredit(transaction.transactionType);
    final amountText =
        '${isCredit ? '+' : '-'}\u{20B9}${transaction.amount.toStringAsFixed(0)}';

    Widget tile = _TransactionContainer(
      icon: isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
      iconBackground: isCredit ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
      iconColor: isCredit ? const Color(0xFF16A34A) : const Color(0xFFE53935),
      title: _title(transaction),
      subtitle: _subtitle(transaction),
      amount: amountText,
      amountColor: isCredit ? const Color(0xFF16A34A) : const Color(0xFFE53935),
      showChevron: true,
    );

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TransactionDetaildScreen(transaction: transaction),
          ),
        );
      },
      child: tile,
    );
  }

  static bool _isCredit(String type) {
    final normalized = type.toLowerCase().trim();
    return normalized == 'credit' ||
        normalized == 'refund' ||
        normalized == 'cashback';
  }

  static String _title(CustomerWalletTransaction transaction) {
    final remarks = transaction.remarks?.trim() ?? '';
    final refType = transaction.referenceType?.trim().toLowerCase() ?? '';

    if (remarks.isNotEmpty) {
      final lower = remarks.toLowerCase();
      // Clean up gateway payment ids from title: "Wallet top-up via Razorpay (pay_TafIS1...)"
      if (lower.contains('wallet top-up') || lower.contains('wallet topup')) {
        return 'Wallet Top-up';
      }
      if (lower.startsWith('checkout order placement') ||
          lower.startsWith('order placement')) {
        return 'Checkout Order Placement';
      }
      if (lower.contains('refund')) {
        return 'Refund Credited';
      }
      return remarks;
    }

    if (refType.isNotEmpty) {
      if (refType == 'topup') return 'Wallet Top-up';
      if (refType == 'order' || refType == 'checkout') return 'Checkout Order Placement';
      if (refType == 'refund') return 'Refund Credited';
      return _capitalizeWords(refType.replaceAll('_', ' '));
    }

    return _isCredit(transaction.transactionType)
        ? 'Wallet Top-up'
        : 'Checkout Order Placement';
  }

  static String _subtitle(CustomerWalletTransaction transaction) {
    final parts = <String>[];
    final dateStr = _formatDate(transaction.createdAt);
    if (dateStr.isNotEmpty) parts.add(dateStr);

    if (transaction.balanceAfter > 0) {
      parts.add('Balance \u{20B9}${transaction.balanceAfter.toStringAsFixed(0)}');
    }

    return parts.join('  •  ');
  }

  static String _capitalizeWords(String value) {
    return value
        .split(' ')
        .where((word) => word.trim().isNotEmpty)
        .map((word) {
          final trimmed = word.trim();
          return trimmed[0].toUpperCase() + trimmed.substring(1).toLowerCase();
        })
        .join(' ');
  }

  static String _formatDate(DateTime? value) {
    if (value == null) return '';

    final local = value.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(local.year, local.month, local.day);
    final dayDiff = today.difference(date).inDays;

    if (dayDiff == 0) return 'Today';
    if (dayDiff == 1) return 'Yesterday';

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '${local.day} ${months[local.month - 1]}';
  }
}

class TRow extends StatelessWidget {
  final Transaction t;

  const TRow(this.t, {super.key});

  @override
  Widget build(BuildContext context) {
    return _TransactionContainer(
      icon: t.isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
      iconBackground: t.isCredit ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
      iconColor: t.isCredit ? const Color(0xFF16A34A) : const Color(0xFFE53935),
      title: t.desc,
      subtitle: t.date,
      amount:
          '${t.isCredit ? '+' : '-'}\u{20B9}${t.amount.toStringAsFixed(0)}',
      amountColor: t.isCredit ? const Color(0xFF16A34A) : const Color(0xFFE53935),
    );
  }
}

class _TransactionContainer extends StatelessWidget {
  final IconData icon;
  final Color iconBackground;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String amount;
  final Color amountColor;
  final bool showChevron;

  const _TransactionContainer({
    required this.icon,
    required this.iconBackground,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.amountColor,
    this.showChevron = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4.5),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0F0F0), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBackground,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(icon, color: iconColor, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTypography.titleMedium.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: kText,
                    letterSpacing: 0.0,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: AppTypography.bodySmall.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: kTextSub,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            amount,
            style: AppTypography.labelLarge.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: amountColor,
              letterSpacing: 0.1,
            ),
          ),
          if (showChevron) ...[
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Color(0xFF9CA3AF),
            ),
          ],
        ],
      ),
    );
  }
}

class _TransactionStateMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _TransactionStateMessage({
    required this.icon,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: kTextSub, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: AppTypography.bodySmall.copyWith(
                color: kTextSub,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              child: Text(
                actionLabel!,
                style: AppTypography.labelLarge.copyWith(
                  color: kPrimary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.1,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
