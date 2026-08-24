import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:url_launcher/url_launcher.dart';

// ══════════════════════════════════════════════════════════
//  CONTACT US & GRIEVANCE SCREEN - Customer Mobile Screen
// ══════════════════════════════════════════════════════════

class ContactUsScreen extends StatelessWidget {
  const ContactUsScreen({super.key});

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Contact & Support',
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
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Text(
                      '7 Days a Week • 5 AM – 9 PM',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'We are Here to Help',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Reach out to our customer care and delivery operations team anytime for subscription assistance, delivery issues, or feedback.',
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
            const SizedBox(height: 20),

            // Quick Action Buttons
            _buildContactTile(
              icon: Icons.phone_outlined,
              title: 'Primary Helpline',
              subtitle: '+91 91487 73591',
              color: kPrimary,
              onTap: () => _launchUrl('tel:+919148773591'),
            ),
            _buildContactTile(
              icon: Icons.phone_outlined,
              title: 'Secondary Helpline',
              subtitle: '+91 79893 68142',
              color: kPrimary,
              onTap: () => _launchUrl('tel:+917989368142'),
            ),
            _buildContactTile(
              icon: Icons.chat_bubble_outline_rounded,
              title: 'WhatsApp Instant Chat',
              subtitle: '+91 91487 73591 (Instant support & photo upload)',
              color: const Color(0xFF25D366),
              onTap: () => _launchUrl('https://wa.me/919148773591'),
            ),
            _buildContactTile(
              icon: Icons.mail_outline_rounded,
              title: 'Customer Support Email',
              subtitle: 'support@f2hfresh.com',
              color: const Color(0xFF1E88E5),
              onTap: () => _launchUrl('mailto:support@f2hfresh.com'),
            ),

            const SizedBox(height: 12),

            // Registered Office & Grievance Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorderLt, width: 1.2),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Registered & Operating Office',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'F2H - Farm to Home\n1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066, Karnataka, India',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      color: kTextSub,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Grievance Officer',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Email: grievanceofficer@f2hfresh.com\nTurnaround: Acknowledged in 48 hours; resolved in 30 days.',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      color: kTextSub,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildContactTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kBorderLt, width: 1.2),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: kTextSub),
            ],
          ),
        ),
      ),
    );
  }
}
