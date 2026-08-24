import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  DELIVERY & SHIPPING POLICY - Customer Mobile Screen
// ══════════════════════════════════════════════════════════

class DeliveryPolicyScreen extends StatelessWidget {
  const DeliveryPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Delivery & Shipping Policy',
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
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Text(
                      'Pure Cold-Chain Logistics',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Doorstep Delivery Before 7:30 AM',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Our dedicated delivery fleet collects milk directly from dairy farms and drops it at your door within 3 hours, strictly maintaining 2–6°C cold-chain.',
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
              title: '1. Daily Delivery Shifts',
              icon: Icons.access_time_filled_rounded,
              content: '• Morning Shift: 5:30 AM – 7:30 AM (Collected fresh from partner farms at 4:00 AM).\n'
                  '• Evening Shift: 5:00 PM – 7:30 PM (Fresh evening milk and pantry staples).\n'
                  '• ₹0 Delivery Fee: Free doorstep delivery on all active daily/scheduled subscriptions.',
            ),
            _buildSection(
              title: '2. Coverage & Service Zones',
              icon: Icons.map_outlined,
              content: '• Active Hubs: Whitefield, Nagondanahalli, Kadugodi, Hoodi, ITPL, Marathahalli, Varthur, Belathur, and adjoining Bengaluru clusters.\n'
                  '• Expansion: New pin codes added weekly across Greater Bengaluru.',
            ),
            _buildSection(
              title: '3. Doorstep Bag & Silent Drops',
              icon: Icons.door_front_door_outlined,
              content: '• Milk Bag Setup: Please hang an insulated bag outside your door for silent morning drops.\n'
                  '• Photo Proof: Riders take a photo upon delivery, and an instant WhatsApp confirmation is sent to your registered number.',
            ),
            _buildSection(
              title: '4. Missed or Delayed Deliveries',
              icon: Icons.shield_outlined,
              content: '• Immediate Resolution: If your delivery is delayed due to weather or logistics, our team coordinates an instant replacement or a 2-hour wallet refund.',
            ),
            _buildSection(
              title: '5. Delivery Team Contact',
              icon: Icons.phone_in_talk_outlined,
              content: '• Delivery Operations: 5:00 AM – 9:00 PM IST\n'
                  '• Phone: +91 91487 73591 / +91 79893 68142\n'
                  '• WhatsApp: +91 91487 73591\n'
                  '• Email: support@f2hfresh.com',
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
