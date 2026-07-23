import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/wallet/data/models/transaction_model.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/wallet/presentation/widgets/transaction_detaild.dart';

class WalletTransactionsSliver extends StatefulWidget {
  const WalletTransactionsSliver({super.key});

  @override
  State<WalletTransactionsSliver> createState() =>
      _WalletTransactionsSliverState();
}

class _WalletTransactionsSliverState extends State<WalletTransactionsSliver> {
  late Future<List<CustomerWalletTransaction>> _transactionsFuture;

  @override
  void initState() {
    super.initState();
    _transactionsFuture = _loadTransactions();
  }

  Future<List<CustomerWalletTransaction>> _loadTransactions() async {
    final response = await sl<DioClient>().dio.get(
          ApiEndpoints.customerWalletTransactions,
        );
    final raw = response.data;

    if (raw is Map && raw['status'] == false) {
      throw Exception(raw['message'] ?? 'Failed to load transactions');
    }

    final data = raw is Map ? raw['data'] : raw;
    if (data is! List) return [];

    return data
        .whereType<Map>()
        .map((item) => CustomerWalletTransaction.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList();
  }

  void _retry() {
    setState(() {
      _transactionsFuture = _loadTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CustomerWalletTransaction>>(
      future: _transactionsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SliverToBoxAdapter(
            child: _TransactionStateMessage(
              icon: Icons.receipt_long_outlined,
              title: 'Loading transactions...',
            ),
          );
        }

        if (snapshot.hasError) {
          final error = snapshot.error.toString().toLowerCase();

          if (error.contains('unauthorized') ||
              error.contains('401')) {
            return SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.account_circle_outlined,
                      size: 48,
                      color: kPrimary,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Login to Activate Wallet',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Sign in to view wallet transactions, rewards and recharge history.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const LoginScreen(),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(48),
                        ),
                        child: const Text(
                          'LOGIN',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return SliverToBoxAdapter(
            child: _TransactionStateMessage(
              icon: Icons.error_outline_rounded,
              title: _errorMessage(snapshot.error),
              actionLabel: 'Retry',
              onAction: _retry,
            ),
          );
        }
        final transactions = snapshot.data ?? const [];

        if (transactions.isEmpty) {
          return const SliverToBoxAdapter(
            child: _TransactionStateMessage(
              icon: Icons.receipt_long_outlined,
              title: 'No transactions yet',
            ),
          );
        }

        return SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => TransactionTile(transactions[index]),
            childCount: transactions.length,
          ),
        );
      },
    );
  }

  String _errorMessage(Object? error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
    }
    return 'Unable to load transactions';
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
      icon: isCredit ? Icons.arrow_downward : Icons.arrow_upward,
      iconBackground: isCredit ? kPrimaryPl : kRedLt,
      iconColor: isCredit ? kPrimary : kRed,
      title: _title(transaction),
      subtitle: _subtitle(transaction),
      amount: amountText,
      amountColor: isCredit ? kPrimary : kRed,
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
    final remarks = transaction.remarks?.trim();
    if (remarks != null && remarks.isNotEmpty) return remarks;

    final referenceType = transaction.referenceType?.trim();
    if (referenceType != null && referenceType.isNotEmpty) {
      return _capitalizeWords(referenceType.replaceAll('_', ' '));
    }

    return _isCredit(transaction.transactionType)
        ? 'Wallet credit'
        : 'Wallet debit';
  }

  static String _subtitle(CustomerWalletTransaction transaction) {
    final parts = <String>[
      _formatDate(transaction.createdAt),
    ];

    if (transaction.balanceAfter > 0) {
      parts.add(
        'Balance \u{20B9}${transaction.balanceAfter.toStringAsFixed(0)}',
      );
    }

    return parts.where((part) => part.trim().isNotEmpty).join(' | ');
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
      icon: t.isCredit ? Icons.arrow_downward : Icons.arrow_upward,
      iconBackground: t.isCredit ? kPrimaryPl : kRedLt,
      iconColor: t.isCredit ? kPrimary : kRed,
      title: t.desc,
      subtitle: t.date,
      amount:
          '${t.isCredit ? '+' : '-'}\u{20B9}${t.amount.toStringAsFixed(0)}',
      amountColor: t.isCredit ? kPrimary : kRed,
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
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBackground,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(icon, color: iconColor, size: 16),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: kText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 10, color: kMuted),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            amount,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: amountColor,
            ),
          ),
          if (showChevron) ...[
            const SizedBox(width: 6),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: kMuted,
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
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: kTextSub, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: kTextSub,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              child: Text(
                actionLabel!,
                style: const TextStyle(
                  color: kPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
