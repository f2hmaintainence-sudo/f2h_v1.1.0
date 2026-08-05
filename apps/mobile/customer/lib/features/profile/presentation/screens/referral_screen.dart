import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'referral_faq_screen.dart';
import 'referral_terms_screen.dart';

// ----------------------------------------------------------
//  F2H REFER & EARN – Complete spec-aligned rewrite
//  Manual WhatsApp sharing only. No auto-messaging.
// ----------------------------------------------------------

// ponytail: brand colors from spec, kept inline to avoid
// creating a separate file for 6 constants.
const _kBgCream     = Color(0xFFFCFBF7);
const _kGreenDark   = Color(0xFF16653A);
const _kGreenMid    = Color(0xFF1F8A4D);
const _kGold        = Color(0xFFF5BD3A);
const _kTextPrimary = Color(0xFF17211B);
const _kTextSecond  = Color(0xFF6B746E);

class ReferralScreen extends StatefulWidget {
  final String? referralCode;
  final String? referralStatus;

  const ReferralScreen({
    super.key,
    this.referralCode,
    this.referralStatus,
  });

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String _code = '';
  String _status = 'locked';
  double _totalEarnings = 0.0;
  int _totalCount = 0;

  bool get _isLocked => _code.isEmpty || _status.toLowerCase() != 'unlocked';
  String get _activeCode => _code;
  String get _referralLink => 'https://f2h.app.link/$_activeCode';

  @override
  void initState() {
    super.initState();
    if (widget.referralCode != null && widget.referralCode!.isNotEmpty) {
      _code = widget.referralCode!;
    }
    if (widget.referralStatus != null && widget.referralStatus!.isNotEmpty) {
      _status = widget.referralStatus!;
    }
    _fetchReferralDashboard();
  }

  Future<void> _fetchReferralDashboard() async {
    try {
      final dioClient = DioClient();
      final response = await dioClient.dio.get(ApiEndpoints.customerReferrals);
      if (response.data != null) {
        final raw = response.data;
        final data = (raw is Map && raw['data'] is Map) ? raw['data'] : raw;

        if (mounted) {
          setState(() {
            if (data['referral_code'] != null &&
                data['referral_code'].toString().isNotEmpty) {
              _code = data['referral_code'].toString();
            }
            if (data['referral_status'] != null) {
              _status = data['referral_status'].toString();
            }

            final earningsVal = data['total_earnings'] ??
                data['totalEarnings'] ??
                data['earnings'] ??
                data['reward_amount'];
            _totalEarnings =
                double.tryParse(earningsVal?.toString() ?? '0') ?? 0.0;

            final countVal = data['total_referrals'] ??
                data['totalReferrals'] ??
                data['referral_count'] ??
                data['count'];
            int count = int.tryParse(countVal?.toString() ?? '0') ?? 0;
            if (count == 0 && _totalEarnings > 0) {
              count = (_totalEarnings / 50).ceil();
            }
            _totalCount = count;

            _isLoading = false;
          });
        }
      }

      // Query wallet transactions for referral rewards directly to guarantee real-time balance accuracy
      try {
        final walletRes = await dioClient.dio.get('${ApiEndpoints.baseUrl}/customer/bootstrap');
        if (walletRes.data != null) {
          final wData = walletRes.data['data'] ?? walletRes.data;
          final txs = wData['wallet_transactions'] as List?;
          if (txs != null) {
            double sumRef = 0;
            int refCount = 0;
            for (final tx in txs) {
              final refType = (tx['reference_type'] ?? '').toString().toLowerCase();
              final remarks = (tx['remarks'] ?? '').toString().toLowerCase();
              if (refType.contains('referral') || remarks.contains('referral')) {
                final amt = double.tryParse(tx['amount']?.toString() ?? '0') ?? 0;
                sumRef += amt;
                refCount++;
              }
            }
            if (mounted) {
              setState(() {
                if (sumRef > _totalEarnings) _totalEarnings = sumRef;
                if (refCount > _totalCount) _totalCount = refCount;
              });
            }
          }
        }
      } catch (_) {}
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── WHATSAPP SHARING ──────────────────────────────────────
  Future<void> _shareOnWhatsApp() async {
    if (_isLocked) {
      F2HToast.error(
        context,
        'Complete your first delivered order to unlock Refer & Earn! 🔒',
      );
      return;
    }

    final message = 'Your F2H Invite is Ready\n\n'
        'Get ₹100 on your first order!\n'
        'Fresh farm products, delivered to your doorstep.\n\n'
        'Invite Code: $_activeCode\n'
        '$_referralLink\n\n'
        'F2H — Farm To Home\n'
        'Fresh. Smart. Rewarding. ';

    final encodedMsg = Uri.encodeComponent(message);
    final whatsappUri = Uri.parse('https://wa.me/?text=$encodedMsg');

    try {
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
      } else {
        final webWhatsapp =
            Uri.parse('https://api.whatsapp.com/send?text=$encodedMsg');
        if (await canLaunchUrl(webWhatsapp)) {
          await launchUrl(webWhatsapp, mode: LaunchMode.externalApplication);
        } else {
          // WhatsApp not installed – show error dialog
          if (mounted) _showWhatsAppNotInstalled(message);
        }
      }
    } catch (_) {
      Clipboard.setData(ClipboardData(text: message));
      if (mounted) {
        F2HToast.success(context, 'Referral message copied to clipboard!');
      }
    }
  }

  void _showWhatsAppNotInstalled(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                "WhatsApp isn't installed on this device.",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              // Share via system share sheet
              Clipboard.setData(ClipboardData(text: message));
              F2HToast.success(
                  context, 'Referral message copied! Share using any app.');
            },
            icon: const Icon(Icons.share_rounded, size: 16),
            label: const Text('Share Using Another App'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kGreenDark,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  void _copyToClipboard(String text, String toastMsg) {
    if (_isLocked) {
      F2HToast.error(
        context,
        'Complete your first delivered order to unlock Refer & Earn! 🔒',
      );
      return;
    }
    Clipboard.setData(ClipboardData(text: text));
    F2HToast.success(context, toastMsg);
  }

  // ── REWARD SUCCESS MODAL ──────────────────────────────────
  // ponytail: call this when a new reward is detected from API
  // ignore: unused_element — wired up when API detects a newly credited reward
  void _showRewardSuccessModal() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Container(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Confetti-like decoration circles
              SizedBox(
                height: 80,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Simple celebration rings
                    ...List.generate(3, (i) {
                      final size = 60.0 + (i * 20);
                      return Container(
                        width: size,
                        height: size,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _kGold.withOpacity(0.2 - (i * 0.05)),
                            width: 2,
                          ),
                        ),
                      );
                    }),
                    // Gift icon
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFEF3C7),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.card_giftcard_rounded,
                          color: Color(0xFFD97706), size: 30),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Referral Successful! 🎉',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: _kTextPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                "Your friend's eligible first order was successfully delivered.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: _kTextSecond),
              ),
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFDCFCE7)),
                ),
                child: const Text(
                  '₹50 Reward Earned',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreenDark,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Awesome!',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── BUILD ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBgCream,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _fetchReferralDashboard,
                color: _kGreenDark,
                child: _isLoading
                    ? _buildSkeletonBody()
                    : SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildHeroCard(),
                            const SizedBox(height: 16),
                            _buildStatsRow(),
                            const SizedBox(height: 20),
                            _buildHowItWorksSection(),
                            const SizedBox(height: 20),
                            _buildTrustBadges(),
                            const SizedBox(height: 20),
                            _buildActionList(),
                          ],
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── APP BAR ───────────────────────────────────────────────
  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Colors.white,
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F4F2),
                shape: BoxShape.circle,
                border: Border.all(color: kBorder),
              ),
              child: const Icon(Icons.arrow_back_rounded,
                  color: _kTextPrimary, size: 20),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Refer & Earn',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: _kTextPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                SizedBox(height: 1),
                Text(
                  'Invite friends. Earn rewards together! 💚',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _kTextSecond,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _showSupportInfo,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F4F2),
                shape: BoxShape.circle,
                border: Border.all(color: kBorder),
              ),
              child: const Icon(Icons.headset_mic_outlined,
                  color: _kGreenMid, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  // ── HERO CARD ─────────────────────────────────────────────
  Widget _buildHeroCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF072A17), Color(0xFF0F5132), Color(0xFF146C3E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0A3D22).withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Headline + Pill Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Share Goodness.',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: _kGold,
                        height: 1.15,
                      ),
                    ),
                    Text(
                      'Earn Rewards!',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: _kGold,
                        height: 1.15,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.25)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.card_giftcard_rounded, color: _kGold, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Refer & Earn ₹50',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Share your code or link and earn ₹50 for each successful referral!',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Colors.white70,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 16),

          // Dedicated Referral Code Box (Full Width - Zero Truncation)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.28),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.22)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'YOUR REFERRAL CODE',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.white60,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _isLocked ? '•••••••• 🔒' : _activeCode,
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          color: _isLocked ? _kGold : Colors.white,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      onPressed: () => _copyToClipboard(
                        _activeCode,
                        'Referral code $_activeCode copied!',
                      ),
                      icon: const Icon(Icons.copy_rounded, size: 14),
                      label: Text(_isLocked ? 'Locked' : 'Copy'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF0A3D22),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Referral Link Box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: Colors.white.withOpacity(0.18)),
            ),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, color: _kGold, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _isLocked ? 'https://f2h.app.link/locked 🔒' : _referralLink,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _copyToClipboard(
                    _referralLink,
                    'Referral link copied!',
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Copy Link',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Primary WhatsApp Share Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _shareOnWhatsApp,
              icon: const Icon(Icons.chat_rounded, size: 20),
              label: const Text('Share on WhatsApp'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Center(
            child: Text(
              'Share effortlessly with your friends',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Colors.white60,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── STATS ROW ─────────────────────────────────────────────
  Widget _buildStatsRow() {
    // ponytail: scale for 320-430+ screens
    final sw = MediaQuery.of(context).size.width;
    final s = (sw / 375).clamp(0.78, 1.15);
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            icon: Icons.account_balance_wallet_rounded,
            iconColor: const Color(0xFF16A34A),
            iconBg: const Color(0xFFDCFCE7),
            cardBg: const Color(0xFFF0FDF4),
            cardBorder: const Color(0xFFDCFCE7),
            title: 'Total Earnings',
            value: '₹${_totalEarnings.toStringAsFixed(2)}',
            valueColor: const Color(0xFF16A34A),
            subtitle: 'All time earnings',
            scale: s,
          ),
        ),
        SizedBox(width: 8 * s),
        Expanded(
          child: _buildStatCard(
            icon: Icons.group_rounded,
            iconColor: const Color(0xFFD97706),
            iconBg: const Color(0xFFFEF3C7),
            cardBg: const Color(0xFFFFFBEB),
            cardBorder: const Color(0xFFFEF3C7),
            title: 'Referred Friends',
            value: '$_totalCount',
            valueColor: const Color(0xFFD97706),
            subtitle: 'Successful referrals',
            scale: s,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required Color cardBg,
    required Color cardBorder,
    required String title,
    required String value,
    required Color valueColor,
    required String subtitle,
    required double scale,
  }) {
    return Container(
      padding: EdgeInsets.all(12 * scale),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: cardBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36 * scale,
            height: 36 * scale,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 18 * scale),
          ),
          SizedBox(width: 8 * scale),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 10 * scale,
                        fontWeight: FontWeight.w600,
                        color: _kTextSecond),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                SizedBox(height: 2 * scale),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(value,
                      style: TextStyle(
                          fontSize: 18 * scale,
                          fontWeight: FontWeight.w900,
                          color: valueColor)),
                ),
                SizedBox(height: 1 * scale),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 9 * scale,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF94A3B8)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── HOW IT WORKS ──────────────────────────────────────────
  Widget _buildHowItWorksSection() {
    final sw = MediaQuery.of(context).size.width;
    final s = (sw / 375).clamp(0.78, 1.15);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Expanded(child: Divider(color: Color(0xFFCBD5E1))),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Text('🌿', style: TextStyle(fontSize: 14)),
                  SizedBox(width: 6),
                  Text('How It Works',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: _kTextPrimary,
                          letterSpacing: -0.2)),
                  SizedBox(width: 6),
                  Text('🌿', style: TextStyle(fontSize: 14)),
                ],
              ),
            ),
            Expanded(child: Divider(color: Color(0xFFCBD5E1))),
          ],
        ),
        SizedBox(height: 14 * s),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _stepTile('1', Icons.assignment_turned_in_rounded,
                  'Place Your\nFirst Order',
                  bg: const Color(0xFFECFDF5), fg: const Color(0xFF059669), scale: s),
              _stepArrow(s),
              _stepTile('2', Icons.confirmation_number_rounded,
                  'Get Your\nReferral Code',
                  bg: const Color(0xFFECFDF5), fg: const Color(0xFF059669), scale: s),
              _stepArrow(s),
              _stepTile('3', Icons.chat_rounded, 'Share With\nFriends',
                  bg: const Color(0xFFDCFCE7), fg: const Color(0xFF25D366), scale: s),
              _stepArrow(s),
              _stepTile(
                  '4', Icons.people_alt_rounded, 'Friend Joins\nF2H',
                  bg: const Color(0xFFFEF3C7), fg: const Color(0xFFD97706), scale: s),
              _stepArrow(s),
              _stepTile('5', Icons.local_shipping_rounded,
                  'First Order\nDelivered',
                  bg: const Color(0xFFECFDF5), fg: const Color(0xFF047857), scale: s),
              _stepArrow(s),
              _stepTile(
                  '6', Icons.card_giftcard_rounded, 'You Both\nEarn',
                  bg: const Color(0xFFFEF3C7), fg: const Color(0xFFCA8A04), scale: s),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stepTile(String num, IconData icon, String label,
      {required Color bg, required Color fg, required double scale}) {
    return SizedBox(
      width: 80 * scale,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 50 * scale,
                height: 50 * scale,
                decoration: BoxDecoration(
                  color: bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: fg.withOpacity(0.2)),
                ),
                child: Icon(icon, color: fg, size: 22 * scale),
              ),
              Positioned(
                top: -2,
                left: -2,
                child: Container(
                  width: 18 * scale,
                  height: 18 * scale,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      color: _kGreenDark, shape: BoxShape.circle),
                  child: Text(num,
                      style: TextStyle(
                          fontSize: 9 * scale,
                          fontWeight: FontWeight.w900,
                          color: Colors.white)),
                ),
              ),
            ],
          ),
          SizedBox(height: 6 * scale),
          Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 10 * scale,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF334155),
                  height: 1.2)),
        ],
      ),
    );
  }

  Widget _stepArrow(double scale) {
    return Padding(
      padding: EdgeInsets.only(top: 16 * scale, left: 1, right: 1),
      child: Icon(Icons.arrow_forward_rounded,
          color: Colors.grey.shade400, size: 14 * scale),
    );
  }

  // ── TRUST BADGES ──────────────────────────────────────────
  Widget _buildTrustBadges() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: _trustItem(
              icon: Icons.shield_outlined,
              fg: const Color(0xFF15803D),
              bg: const Color(0xFFDCFCE7),
              title: 'Safe & Secure',
              desc: 'Your referral\ninformation is\nprotected',
            ),
          ),
          Container(width: 1, height: 50, color: kBorder),
          Expanded(
            child: _trustItem(
              icon: Icons.workspace_premium_outlined,
              fg: const Color(0xFFB45309),
              bg: const Color(0xFFFEF3C7),
              title: 'Simple Rewards',
              desc: 'Rewards processed\nafter eligible\nfirst order',
            ),
          ),
          Container(width: 1, height: 50, color: kBorder),
          Expanded(
            child: _trustItem(
              icon: Icons.card_giftcard_outlined,
              fg: const Color(0xFF047857),
              bg: const Color(0xFFECFDF5),
              title: 'Invite & Earn',
              desc: 'Share with more\nfriends and earn\nmore rewards',
            ),
          ),
        ],
      ),
    );
  }

  Widget _trustItem({
    required IconData icon,
    required Color fg,
    required Color bg,
    required String title,
    required String desc,
  }) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(icon, color: fg, size: 20),
        ),
        const SizedBox(height: 6),
        Text(title,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: _kTextPrimary)),
        const SizedBox(height: 2),
        Text(desc,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w500,
                color: _kTextSecond,
                height: 1.2)),
      ],
    );
  }

  // ── WHATSAPP CTA CARD (in-body) ───────────────────────────
  Widget _buildWhatsAppCTACard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF16653A), Color(0xFF1F8A4D)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _kGreenDark.withOpacity(0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.chat_rounded, color: Color(0xFF25D366), size: 22),
              SizedBox(width: 8),
              Text('Share on WhatsApp',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: Colors.white)),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Invite friends and earn together!',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.white70)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _shareOnWhatsApp,
              icon: const Icon(Icons.chat_rounded,
                  color: Color(0xFF25D366), size: 18),
              label: const Text('SHARE NOW'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: _kGreenDark,
                padding: const EdgeInsets.symmetric(vertical: 13),
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── ACTION LIST (FAQs / Terms) ────────────────────────────
  Widget _buildActionList() {
    return Column(
      children: [
        _actionTile(
          icon: Icons.help_outline_rounded,
          title: 'FAQs',
          subtitle: 'Find answers to common questions',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ReferralFaqScreen()),
          ),
        ),
        const SizedBox(height: 10),
        _actionTile(
          icon: Icons.verified_user_outlined,
          title: 'Terms & Conditions',
          subtitle: 'Read our referral program terms',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ReferralTermsScreen()),
          ),
        ),
      ],
    );
  }

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorder),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
              color: Color(0xFFECFDF5), shape: BoxShape.circle),
          child: Icon(icon, color: const Color(0xFF047857), size: 20),
        ),
        title: Text(title,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: _kTextPrimary)),
        subtitle: Text(subtitle,
            style: const TextStyle(fontSize: 11, color: _kTextSecond)),
        trailing: const Icon(Icons.chevron_right_rounded,
            color: Color(0xFF94A3B8)),
      ),
    );
  }

  // ── BOTTOM WHATSAPP BAR ───────────────────────────────────
  Widget _buildWhatsAppBottomBar() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0A3D22),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.12),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                  color: Color(0xFF25D366), shape: BoxShape.circle),
              child: const Icon(Icons.chat_rounded,
                  color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Share on WhatsApp',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Colors.white)),
                  SizedBox(height: 1),
                  Text('Invite friends and earn together!',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white70)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            ElevatedButton(
              onPressed: _shareOnWhatsApp,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: _kGreenDark,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.chat_rounded, color: Color(0xFF25D366), size: 16),
                  SizedBox(width: 6),
                  Text('Share Now',
                      style:
                          TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
                  SizedBox(width: 2),
                  Icon(Icons.chevron_right_rounded, size: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── SKELETON LOADER ───────────────────────────────────────
  Widget _buildSkeletonBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero card skeleton
          _shimmerBox(height: 280, radius: 24),
          const SizedBox(height: 16),
          // Stats row skeleton
          Row(
            children: [
              Expanded(child: _shimmerBox(height: 90, radius: 20)),
              const SizedBox(width: 12),
              Expanded(child: _shimmerBox(height: 90, radius: 20)),
            ],
          ),
          const SizedBox(height: 20),
          // How it works skeleton
          _shimmerBox(height: 120, radius: 16),
          const SizedBox(height: 20),
          // Trust badges skeleton
          _shimmerBox(height: 100, radius: 20),
        ],
      ),
    );
  }

  Widget _shimmerBox({required double height, double radius = 12}) {
    return Container(
      width: double.infinity,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          colors: [
            Colors.grey.shade200,
            Colors.grey.shade100,
            Colors.grey.shade200,
          ],
          stops: const [0.0, 0.5, 1.0],
        ),
      ),
    );
  }

  // ── SUPPORT MODAL ─────────────────────────────────────────
  void _showSupportInfo() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.headset_mic_rounded,
                color: Color(0xFF047857), size: 44),
            const SizedBox(height: 12),
            const Text('Need Help with Referrals?',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text(
              'If you have any questions regarding your referral code, rewards, or pending payouts, contact our F2H Support Team.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: _kTextSecond),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kGreenDark,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Close',
                    style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
