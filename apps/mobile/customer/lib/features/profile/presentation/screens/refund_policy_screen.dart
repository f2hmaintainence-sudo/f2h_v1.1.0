import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  REFUND & CANCELLATION POLICY - Customer Mobile Screen
// ══════════════════════════════════════════════════════════

class RefundPolicyScreen extends StatelessWidget {
  const RefundPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Cancellation & Refund Policy',
          style: TextStyle(
            color: kText,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: kBorderLt, width: 1.2),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.02),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  )
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Text(
                      '2-Hour Wallet Refund Guarantee',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2E7D32),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Clear, Hassle-Free Refunds',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'We are committed to delivering 100% pure, uncompromised dairy. Here are our exact cancellation cut-offs and refund timelines.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: kTextSub,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            _buildSection(
              title: '1. Order Cancellation Timelines',
              icon: Icons.timer_outlined,
              content: '• Morning Delivery (5:30 AM - 7:30 AM): Cancel before 9:00 PM the previous night for 100% free cancellation.\n'
                  '• Evening Delivery (5:00 PM - 7:30 PM): Cancel before 10:00 AM the same day for 100% free cancellation.\n'
                  '• After Cut-Off: Farm collection and pouch packing begin; orders cannot be cancelled in the app once cut-off passes.',
            ),
            _buildSection(
              title: '2. 2-Hour Wallet Refund Policy',
              icon: Icons.flash_on_rounded,
              content: '• Instant Wallet Credits: Approved claims for missing packets, unfulfilled shifts, or damaged milk are credited to your F2H Wallet within 2 hours.\n'
                  '• Always Available: Wallet funds never expire and apply automatically toward upcoming daily drops.',
            ),
            _buildSection(
              title: '3. Bank Source Refunds (5-7 Days)',
              icon: Icons.account_balance_outlined,
              content: '• Source Reversal: For wallet balance payouts or payment gateway transaction reversals, funds are credited via Razorpay back to your original payment method (Credit/Debit Card, NetBanking, UPI) within 5 to 7 working days.',
            ),
            _buildSection(
              title: '4. Quality Claims & Replacements',
              icon: Icons.verified_outlined,
              content: '• Fresh Milk & Curd: Report any curdling upon first boil or packaging leakage within 24 hours of delivery with a photo.\n'
                  '• Non-Perishables (Ghee, Oils, Dry Fruits): Report quality concerns within 3 days (72 hours).\n'
                  '• Resolution: We provide an immediate replacement on the next shift or a full refund.',
            ),
            _buildSection(
              title: '5. Customer Care & Disputes',
              icon: Icons.support_agent_rounded,
              content: '• In-App Help: Tap "Help & Support" in the profile drawer.\n'
                  '• WhatsApp: +91 91487 73591\n'
                  '• Email: support@f2hfresh.com\n'
                  '• Helpline: +91 91487 73591 / +91 79893 68142',
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required IconData icon,
    required String content,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderLt, width: 1.2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: kPrimary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              content,
              style: const TextStyle(
                fontSize: 12.5,
                height: 1.5,
                color: kTextSub,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
