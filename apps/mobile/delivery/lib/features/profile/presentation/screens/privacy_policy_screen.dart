import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: const F2hAppBar(
        title: 'Privacy Policy',
        subtitle: 'Read how your data is protected',
        icon: Icons.privacy_tip_outlined,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildPolicyCard(
              title: "1. Information We Collect",
              content:
                  "We collect your personal details (name, email, phone number), vehicle information, government identification proof, and live location data to enable delivery dispatching and payout processing.",
            ),
            const SizedBox(height: 12),
            _buildPolicyCard(
              title: "2. Location Services",
              content:
                  "Background location access is required during active delivery shifts to provide live tracking for customers, estimate accurate arrival times, and calculate distance-based earnings.",
            ),
            const SizedBox(height: 12),
            _buildPolicyCard(
              title: "3. Data Security & Storage",
              content:
                  "Your bank details and identification documents are encrypted using industry-standard protocols and stored securely. We never sell your personal information to third parties.",
            ),
            const SizedBox(height: 12),
            _buildPolicyCard(
              title: "4. Your Rights & Support",
              content:
                  "You have the right to request access to your personal data, update your account details, or request account deletion by contacting our partner support team at support@f2hfresh.com or +91 91487 73591.",
            ),
            const SizedBox(height: 12),
            _buildPolicyCard(
              title: "5. Official Entity & Support",
              content:
                  "F2H - Farm to Home\nRegistered Office: 1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066, Karnataka, India\nEmail: support@f2hfresh.com | Phone: +91 91487 73591",
            ),
            const SizedBox(height: 24),
            const Center(
              child: Text(
                "Last updated: August 2026 • F2H Fresh Partner Platform",
                style: TextStyle(fontSize: 11, color: kTextSub),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPolicyCard({required String title, required String content}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: kText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: const TextStyle(
              fontSize: 12.5,
              color: kTextSub,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}
