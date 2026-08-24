import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  TERMS & CONDITIONS - Customer Mobile Screen
// ══════════════════════════════════════════════════════════

class TermsConditionsScreen extends StatelessWidget {
  const TermsConditionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Terms & Conditions',
          style: TextStyle(
            color: kText,
            fontSize: 18,
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
            // Top Header Card
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
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Text(
                      'F2H - Farm to Home',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Terms of Service & Usage',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Please read these terms and conditions carefully before subscribing to our daily farm dairy delivery service or purchasing products through the F2H platform.',
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

            // Terms Sections
            _buildSection(
              title: '1. About F2H & Subscriptions',
              icon: Icons.local_shipping_outlined,
              content: '• Daily Doorstep Delivery: F2H delivers farm-fresh milk and dairy products in two daily shifts: Morning (5:30 AM - 7:30 AM) and Evening (5:00 PM - 7:30 PM).\n'
                  '• Active Subscriptions: You can create recurring schedules (Daily, Alternate Days, or Custom) with ₹0 delivery charges.',
            ),
            _buildSection(
              title: '2. Daily Cut-Off Times & Changes',
              icon: Icons.access_time_rounded,
              content: '• Morning Shift Cut-Off: Orders, pause requests, and quantity changes must be submitted by 9:00 PM the previous night.\n'
                  '• Evening Shift Cut-Off: Orders, pause requests, and modifications must be submitted by 10:00 AM the same day.\n'
                  '• Free Modifications: Any change made before the respective cut-off is 100% free of charge.',
            ),
            _buildSection(
              title: '3. Wallet, Billing & Payments',
              icon: Icons.account_balance_wallet_outlined,
              content: '• Prepaid Wallet: Money is deducted from your F2H Wallet only when the delivery manifest is dispatched for that shift.\n'
                  '• Secure Gateways: Online top-ups are powered by Razorpay supporting UPI, Cards, NetBanking, and AutoPay e-mandates.\n'
                  '• Postpaid Credit: Approved postpaid customers receive itemized monthly statements payable within 7 days.',
            ),
            _buildSection(
              title: '4. Cancellations & 2-Hour Refunds',
              icon: Icons.replay_circle_filled_outlined,
              content: '• 2-Hour Wallet Refund: Verified cancellations, missing packets, or damaged milk issues are credited to your F2H Wallet within 2 hours.\n'
                  '• Bank Settlement: Direct refunds to original payment methods (Cards/UPI) take 5-7 business days via standard banking gateways.\n'
                  '• Perishable Reporting: Dairy quality concerns must be reported within 24 hours of delivery with photo proof.',
            ),
            _buildSection(
              title: '5. Doorstep Milk Bag Protocol',
              icon: Icons.shopping_bag_outlined,
              content: '• Insulated Bag: Customers are requested to hang an insulated F2H delivery bag outside the door for early morning silent drops.\n'
                  '• Photo Confirmation: Delivery riders upload a drop photo upon successful delivery at your doorstep.',
            ),
            _buildSection(
              title: '6. Official Registered Entity',
              icon: Icons.business_outlined,
              content: '• Entity Name: F2H - Farm to Home\n'
                  '• Registered Office: 1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore - 560066, Karnataka, India\n'
                  '• Official Email: support@f2hfresh.com\n'
                  '• Phone: +91 91487 73591 / +91 79893 68142',
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
