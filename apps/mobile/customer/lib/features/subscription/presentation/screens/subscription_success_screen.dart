// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION SUCCESS SCREEN
//
//  Shown after a subscription is successfully created via
//  SubscriptionSetupScreen. Displays a confirmation with
//  the subscription ID, payment type, auto-renewal status,
//  delivery address, start date, and estimated monthly amount.
// ══════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../subscription/presentation/screens/my_subscriptions_screen.dart';

class SubscriptionSuccessScreen extends StatefulWidget {
  final String subscriptionId;
  final String paymentType;   // 'prepaid' | 'postpaid'
  final bool autoRenew;
  final String address;
  final String startDate;
  final double estimatedMonthlyAmount;
  final String productName;
  final String variantLabel;

  const SubscriptionSuccessScreen({
    super.key,
    required this.subscriptionId,
    required this.paymentType,
    required this.autoRenew,
    required this.address,
    required this.startDate,
    required this.estimatedMonthlyAmount,
    required this.productName,
    required this.variantLabel,
  });

  @override
  State<SubscriptionSuccessScreen> createState() => _SubscriptionSuccessScreenState();
}

class _SubscriptionSuccessScreenState extends State<SubscriptionSuccessScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;
  late Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _scale = CurvedAnimation(parent: _ctrl, curve: const Interval(0.0, 0.6, curve: Curves.elasticOut));
    _fade = CurvedAnimation(parent: _ctrl, curve: const Interval(0.4, 1.0, curve: Curves.easeOut));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isPostpaid = widget.paymentType == 'postpaid';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F9),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
          child: Column(
            children: [
              // ── Animated success icon ─────────────────────
              ScaleTransition(
                scale: _scale,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1B4332), Color(0xFF2E7D32)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1B4332).withOpacity(0.3),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 52,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // ── Title ─────────────────────────────────────
              FadeTransition(
                opacity: _fade,
                child: Column(
                  children: [
                    const Text(
                      'Subscription Confirmed!',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: kText,
                        height: 1.2,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${widget.productName} (${widget.variantLabel}) has been subscribed successfully.',
                      style: const TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                        height: 1.4,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // ── Details Card ──────────────────────────────
              FadeTransition(
                opacity: _fade,
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Header
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: const BoxDecoration(
                          color: Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFF1B4332)),
                            const SizedBox(width: 8),
                            const Text(
                              'Subscription Details',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1B4332),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              ' ${widget.subscriptionId}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1B4332),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Detail rows
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            _DetailRow(
                              icon: Icons.location_on_outlined,
                              label: 'Delivery Address',
                              value: widget.address,
                            ),
                            const _Divider(),
                            _DetailRow(
                              icon: Icons.play_circle_outline_rounded,
                              label: 'Starts From',
                              value: widget.startDate,
                            ),
                            const _Divider(),
                            _DetailRow(
                              icon: Icons.payments_outlined,
                              label: 'Payment Type',
                              value: isPostpaid ? 'Postpaid' : 'Prepaid',
                              valueColor: isPostpaid ? const Color(0xFF1565C0) : const Color(0xFF1B4332),
                            ),
                            const _Divider(),
                            _DetailRow(
                              icon: Icons.autorenew_rounded,
                              label: 'Auto Renewal',
                              value: widget.autoRenew ? 'Enabled' : 'Disabled',
                              valueColor: widget.autoRenew ? const Color(0xFF1B4332) : kTextSub,
                            ),
                            const _Divider(),
                            _DetailRow(
                              icon: Icons.calculate_outlined,
                              label: 'Est. Monthly Amount',
                              value: '₹${widget.estimatedMonthlyAmount.toStringAsFixed(0)}',
                              valueColor: const Color(0xFF1B4332),
                              bold: true,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Subscription pricing info card ────────────
              FadeTransition(
                opacity: _fade,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFDE7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE082)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFF9A825)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Subscription price is locked at the time of creation. You save on every delivery compared to one-time orders.',
                          style: TextStyle(fontSize: 10, color: Color(0xFF795548), height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // ── Action Buttons ────────────────────────────
              FadeTransition(
                opacity: _fade,
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pushAndRemoveUntil(
                            context,
                            MaterialPageRoute(builder: (_) => const SubsScreen()),
                            (route) => route.isFirst,
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B4332),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        icon: const Icon(Icons.repeat_rounded, size: 18),
                        label: const Text(
                          'View My Subscriptions',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () {
                          // Pop all subscription screens to get back to root/home
                          Navigator.of(context).popUntil((route) => route.isFirst);
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: kText,
                          side: const BorderSide(color: Color(0xFFDDE1E6)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text(
                          'Continue Shopping',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Detail Row ─────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: kTextSub),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                  color: valueColor ?? kText,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 10),
      child: Divider(color: Color(0xFFE5E7EB), height: 1),
    );
  }
}
