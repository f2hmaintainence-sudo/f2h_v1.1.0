import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../profile/data/models/profile_model.dart';
import '../../../wallet/presentation/screens/wallet_screen.dart';

class SubscriptionPaymentSheet extends StatelessWidget {
  final String paymentType; // 'prepaid' | 'postpaid'
  final double estimatedTotal;               // Actual charge this month (partial)
  final double monthlyEstimateForCreditCheck; // Full-month estimate used for postpaid limit check
  final ProfileModel? profile;
  final double existingPostpaidCommitted;
  final Function({required String paymentType, required String paymentMethod}) onConfirm;
  final VoidCallback onSwitchToPrepaid;

  const SubscriptionPaymentSheet({
    super.key,
    required this.paymentType,
    required this.estimatedTotal,
    required this.monthlyEstimateForCreditCheck,
    required this.profile,
    required this.existingPostpaidCommitted,
    required this.onConfirm,
    required this.onSwitchToPrepaid,
  });

  static void show({
    required BuildContext context,
    required String paymentType,
    required double estimatedTotal,
    required double monthlyEstimateForCreditCheck,
    required ProfileModel? profile,
    required double existingPostpaidCommitted,
    required Function({required String paymentType, required String paymentMethod}) onConfirm,
    required VoidCallback onSwitchToPrepaid,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SubscriptionPaymentSheet(
        paymentType: paymentType,
        estimatedTotal: estimatedTotal,
        monthlyEstimateForCreditCheck: monthlyEstimateForCreditCheck,
        profile: profile,
        existingPostpaidCommitted: existingPostpaidCommitted,
        onConfirm: onConfirm,
        onSwitchToPrepaid: onSwitchToPrepaid,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final walletBalance = profile?.walletBalance ?? 0.0;
    final isWalletSufficient = walletBalance >= estimatedTotal;

    final creditLimit = profile?.postpaidCreditLimit ?? 0.0;
    final isPostpaidEnabled = profile?.isPostpaidEnabled ?? false;
    // Use full-month estimate for credit limit check, not the partial-month charge
    final combinedPostpaidTotal = existingPostpaidCommitted + monthlyEstimateForCreditCheck;
    final isPostpaidOverLimit = !isPostpaidEnabled || (creditLimit > 0 && combinedPostpaidTotal > creditLimit);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: paymentType == 'prepaid'
                      ? const Color(0xFFE8F5E9)
                      : const Color(0xFFE3F2FD),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  paymentType == 'prepaid'
                      ? Icons.account_balance_wallet_rounded
                      : Icons.credit_card_rounded,
                  color: paymentType == 'prepaid' ? kPrimary : const Color(0xFF1976D2),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      paymentType == 'prepaid'
                          ? 'Prepaid Checkout'
                          : 'Postpaid Verification',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      paymentType == 'postpaid'
                          ? 'Monthly Est: ₹${monthlyEstimateForCreditCheck.toStringAsFixed(0)}/mo'
                          : 'Estimation: ₹${estimatedTotal.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20, color: kTextSub),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── PREPAID CONTENT ─────────────────────────────
          if (paymentType == 'prepaid') ...[
            // Wallet Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isWalletSufficient ? const Color(0xFFF0FDF4) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isWalletSufficient ? const Color(0xFFBBF7D0) : const Color(0xFFFDE68A),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_rounded, size: 18, color: kPrimary),
                      const SizedBox(width: 8),
                      const Text(
                        'F2H Wallet Balance',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                      ),
                      const Spacer(),
                      Text(
                        '₹${walletBalance.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: isWalletSufficient ? const Color(0xFF166534) : const Color(0xFF92400E),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (isWalletSufficient) ...[
                    Row(
                      children: [
                        const Icon(Icons.check_circle_outline_rounded, size: 14, color: Color(0xFF166534)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Sufficient balance for this subscription estimation (₹${estimatedTotal.toStringAsFixed(0)})',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF166534), fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          Navigator.pop(context);
                          onConfirm(paymentType: 'prepaid', paymentMethod: 'wallet');
                        },
                        icon: const Icon(Icons.check_rounded, size: 18),
                        label: Text(
                          'Pay ₹${estimatedTotal.toStringAsFixed(0)} from Wallet',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B4332),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ] else ...[
                    Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, size: 14, color: Colors.amber.shade900),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Need ₹${(estimatedTotal - walletBalance).toStringAsFixed(2)} more for wallet checkout',
                            style: TextStyle(fontSize: 11, color: Colors.amber.shade900, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const WalletScreen()),
                          );
                        },
                        icon: const Icon(Icons.add_circle_outline_rounded, size: 16),
                        label: const Text(
                          'Top Up Wallet',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: kPrimary,
                          side: const BorderSide(color: kPrimary, width: 1.5),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 18),
            // Razorpay & UPI options
            Row(
              children: [
                const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    'OR PAY VIA RAZORPAY / UPI',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.grey.shade500,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
              ],
            ),
            const SizedBox(height: 14),

            // Razorpay Online Payment Tile
            InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.pop(context);
                onConfirm(paymentType: 'prepaid', paymentMethod: 'online');
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withOpacity(0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.bolt_rounded,
                        color: Color(0xFF16A34A),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Razorpay Online Payment',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF14532D),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF16A34A).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'FAST & SECURE',
                                  style: TextStyle(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF15803D),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'UPI, Cards, NetBanking & Wallets',
                            style: TextStyle(
                              fontSize: 10.5,
                              color: Color(0xFF166534),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: Color(0xFF16A34A),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _UpiOptionTile(
                    label: 'Google Pay',
                    icon: Icons.account_balance_rounded,
                    accentColor: const Color(0xFF4285F4),
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      onConfirm(paymentType: 'prepaid', paymentMethod: 'upi');
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _UpiOptionTile(
                    label: 'PhonePe / UPI',
                    icon: Icons.qr_code_scanner_rounded,
                    accentColor: const Color(0xFF5F259F),
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      onConfirm(paymentType: 'prepaid', paymentMethod: 'upi');
                    },
                  ),
                ),
              ],
            ),
          ],

          // ── POSTPAID CONTENT ────────────────────────────
          if (paymentType == 'postpaid') ...[
            if (isPostpaidOverLimit) ...[
              // Red Error Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.red.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.error_outline_rounded, size: 20, color: Colors.red.shade700),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            !isPostpaidEnabled
                                ? 'Postpaid Not Enabled'
                                : 'Postpaid Credit Limit Exceeded',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: Colors.red.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (!isPostpaidEnabled)
                      const Text(
                        'Postpaid facility is not activated on your account. Please re-select Prepaid to complete your subscription.',
                        style: TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                      )
                    else ...[
                      _CreditRow(label: 'Postpaid Credit Limit:', value: '₹${creditLimit.toStringAsFixed(0)}'),
                      _CreditRow(label: 'Existing Postpaid Subs:', value: '₹${existingPostpaidCommitted.toStringAsFixed(0)}/mo'),
                      _CreditRow(label: 'New Subscription Est:', value: '₹${estimatedTotal.toStringAsFixed(0)}/mo'),
                      const Divider(color: Color(0xFFFCA5A5)),
                      _CreditRow(
                        label: 'Total Postpaid Commitment:',
                        value: '₹${combinedPostpaidTotal.toStringAsFixed(0)}/mo',
                        isBold: true,
                        valueColor: Colors.red.shade900,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Your total committed amount (₹${combinedPostpaidTotal.toStringAsFixed(0)}) exceeds your credit limit of ₹${creditLimit.toStringAsFixed(0)}. Please switch to Prepaid.',
                        style: TextStyle(fontSize: 11.5, color: Colors.red.shade900, fontWeight: FontWeight.w600, height: 1.35),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          Navigator.pop(context);
                          onSwitchToPrepaid();
                        },
                        icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                        label: const Text(
                          'Switch to Prepaid Option',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B4332),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // Green Limit Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_user_rounded, size: 20, color: Color(0xFF15803D)),
                        const SizedBox(width: 8),
                        const Text(
                          'Postpaid Credit Verified',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _CreditRow(label: 'Postpaid Credit Limit:', value: '₹${creditLimit.toStringAsFixed(0)}'),
                    _CreditRow(label: 'Existing Postpaid Subs:', value: '₹${existingPostpaidCommitted.toStringAsFixed(0)}/mo'),
                    _CreditRow(label: 'New Subscription Est:', value: '₹${monthlyEstimateForCreditCheck.toStringAsFixed(0)}/mo'),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (combinedPostpaidTotal / (creditLimit > 0 ? creditLimit : 1.0)).clamp(0.0, 1.0),
                        backgroundColor: const Color(0xFFDCFCE7),
                        color: const Color(0xFF15803D),
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Remaining Credit Limit: ₹${(creditLimit - combinedPostpaidTotal).toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF15803D)),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          Navigator.pop(context);
                          onConfirm(paymentType: 'postpaid', paymentMethod: 'postpaid');
                        },
                        icon: const Icon(Icons.check_rounded, size: 18),
                        label: const Text(
                          'Confirm Postpaid Subscription',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B4332),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _UpiOptionTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color accentColor;
  final VoidCallback onTap;

  const _UpiOptionTile({
    required this.label,
    required this.icon,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: accentColor),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreditRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? valueColor;

  const _CreditRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
              color: isBold ? kText : kTextSub,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: valueColor ?? kText,
            ),
          ),
        ],
      ),
    );
  }
}
