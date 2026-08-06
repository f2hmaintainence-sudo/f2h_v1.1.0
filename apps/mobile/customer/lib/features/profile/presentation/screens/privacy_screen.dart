import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  PRIVACY POLICY - Hardcoded Premium Design
// ══════════════════════════════════════════════════════════

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Privacy Policy',
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
                      'Effective Date: June 30, 2026',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your Trust is Our Commitment',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'At Farm to Home (F2H), we value your trust above all else. This Privacy Policy describes how we collect, use, share, and safeguard your personal information when you use our mobile application.',
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

            // Policy Sections
            _buildSection(
              title: '1. Information We Collect',
              icon: Icons.info_outline_rounded,
              content: '• Account Details: When you register, we collect your name, mobile phone number, email address, and F2H zone preferences.\n'
                  '• Delivery Addresses: We save your designated delivery addresses to facilitate accurate and timely milk/dairy drops.\n'
                  '• Location Data: We may ask for background location access to validate zone-based delivery coverage and provide precise real-time order tracking.',
            ),
            _buildSection(
              title: '2. How We Use Your Information',
              icon: Icons.settings_outlined,
              content: '• Fulfilling and managing your one-time and subscription orders.\n'
                  '• Processing wallet top-ups, transactions, and secure checkouts.\n'
                  '• Sending push notifications regarding active deliveries, pauses, or account status.\n'
                  '• Continuously optimizing our farm-to-table supply chain logistics and customer support experience.',
            ),
            _buildSection(
              title: '3. Data Security & Protection',
              icon: Icons.shield_outlined,
              content: 'We employ state-of-the-art security measures including SSL encryption, secure tokens, and hashed database storage to protect your personal details and order history. F2H is FSSAI compliant, assuring safety both in product delivery and digital infrastructure.',
            ),
            _buildSection(
              title: '4. Information Sharing',
              icon: Icons.share_outlined,
              content: 'F2H does not sell, trade, or rent your personal identification information to third parties. We only share essential details with delivery agents/vendors and payment processors to complete transactions and execute home deliveries.',
            ),
            _buildSection(
              title: '5. Your Rights & Management',
              icon: Icons.manage_accounts_outlined,
              content: 'You retain full control over your F2H profile data. You can view, modify, or update your personal details and saved addresses directly via the Profile Screen inside the app. To request permanent account deletion, contact our support team.',
            ),
            _buildSection(
              title: '6. Contact & Support',
              icon: Icons.help_outline_rounded,
              content: 'If you have any questions or feedback regarding this Privacy Policy, please reach out to us at:\n\n'
                  '• Email: support@f2h.com\n'
                  '• Helpline: +91 98765 43210\n'
                  '• Address: F2H Headquarters, Sector-4, Green Meadows, Bengaluru, India.',
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
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
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
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              content,
              style: const TextStyle(
                fontSize: 13,
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