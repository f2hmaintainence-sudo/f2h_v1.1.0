import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class TermsConditionsScreen extends StatelessWidget {
  const TermsConditionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: const F2hAppBar(
        title: 'Terms & Conditions',
        subtitle: 'Partner policies and guidelines',
        icon: Icons.gavel_rounded,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTermsCard(
              title: "1. Delivery Partner Agreement",
              content:
                  "As an independent delivery partner with F2H Fresh, you agree to fulfill accepted orders in a timely, safe, and professional manner adhering to food hygiene and handling standards.",
            ),
            const SizedBox(height: 12),
            _buildTermsCard(
              title: "2. Payouts & Earnings",
              content:
                  "Earnings and incentives are calculated based on completed deliveries, active distance, and surge rates. Weekly payouts are disbursed directly to your verified bank account.",
            ),
            const SizedBox(height: 12),
            _buildTermsCard(
              title: "3. Code of Conduct",
              content:
                  "Partners are expected to maintain professional behavior with customers, store vendors, and support staff. Any breach of conduct may lead to temporary or permanent account suspension.",
            ),
            const SizedBox(height: 12),
            _buildTermsCard(
              title: "4. Vehicle & License Requirements",
              content:
                  "You must maintain a valid driver's license, vehicle registration, and active insurance for the vehicle used during delivery operations.",
            ),
            const SizedBox(height: 24),
            const Center(
              child: Text(
                "Effective: January 2026 • F2H Fresh Partner Terms",
                style: TextStyle(fontSize: 11, color: kTextSub),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTermsCard({required String title, required String content}) {
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
