import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:dio/dio.dart';

import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';
import 'package:qr_flutter/qr_flutter.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> with SingleTickerProviderStateMixin {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;
  late TabController _tabController;

  // Filter & Search
  String _searchQuery = '';
  String _selectedStatusFilter = 'all';
  final TextEditingController _searchController = TextEditingController();

  static const String _customerAppUrl =
      'https://play.google.com/store/apps/details?id=com.f2h.customer&pcampaignid=web_share';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadReferrals();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadReferrals() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dioClient = DioClient();
      final res = await dioClient.dio.get(ApiEndpoints.profileReferrals);
      final body = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
      final data = body['data'] is Map ? Map<String, dynamic>.from(body['data'] as Map) : <String, dynamic>{};
      setState(() {
        _data = data;
        _loading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['message'] ?? 'Failed to load referral dashboard. Please try again.';
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Failed to load referral dashboard. Please try again.';
        _loading = false;
      });
    }
  }

  String _getShareMessage(String code) {
    return '🥛 Order 100% Pure, Farm-Fresh Milk, Organic Vegetables & Daily Groceries delivered to your doorstep with Farm to Home (F2H)!\n\n'
        '🎁 Use my Exclusive Customer Referral Code: *$code* to get special introductory discounts on your first order!\n\n'
        '📲 Download the F2H Customer App now:\n'
        '$_customerAppUrl';
  }

  void _copyCode(String code) {
    final fullMessage = _getShareMessage(code);
    Clipboard.setData(ClipboardData(text: fullMessage));
    AppSnackBar.success(context, 'Referral code & app link copied to clipboard!');
  }

  Future<void> _shareCode(String code) async {
    final message = _getShareMessage(code);
    try {
      await Share.share(
        message,
        subject: 'Farm to Home (F2H) - Fresh Milk & Groceries Referral',
      );
    } catch (_) {
      _showShareBottomSheet(code);
    }
  }

  Future<void> _shareWhatsApp(String code) async {
    final message = _getShareMessage(code);
    final encoded = Uri.encodeComponent(message);
    final url = Uri.parse('https://wa.me/?text=$encoded');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      _copyCode(code);
    }
  }

  void _showShareBottomSheet(String code) {
    final message = _getShareMessage(code);
    final encoded = Uri.encodeComponent(message);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.share_rounded, color: Color(0xFF16A34A), size: 22),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Share Customer Referral',
                    style: GoogleFonts.roboto(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Invite customers to order fresh milk & produce. You earn ₹75 per customer upon their first delivery!',
                textAlign: TextAlign.center,
                style: GoogleFonts.roboto(
                  fontSize: 12,
                  color: const Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildShareOption(
                    icon: Icons.chat_rounded,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () {
                      Navigator.pop(ctx);
                      _shareWhatsApp(code);
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.send_rounded,
                    label: 'Telegram',
                    color: const Color(0xFF0088CC),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse(
                          'https://t.me/share/url?url=${Uri.encodeComponent(_customerAppUrl)}&text=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      } else {
                        _copyCode(code);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.sms_rounded,
                    label: 'SMS',
                    color: const Color(0xFFEA580C),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('sms:?body=$encoded');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      } else {
                        _copyCode(code);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.copy_rounded,
                    label: 'Copy Text',
                    color: const Color(0xFF2563EB),
                    onTap: () {
                      Navigator.pop(ctx);
                      _copyCode(code);
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShareOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: color.withValues(alpha: 0.25), width: 1.2),
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.roboto(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQrCodeDialog(String code) {
    final qrData = 'https://play.google.com/store/apps/details?id=com.f2h.customer&referrer=$code';

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.qr_code_2_rounded, color: Color(0xFF16A34A), size: 20),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Customer QR Code',
                        style: GoogleFonts.roboto(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 12,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: QrImageView(
                        data: qrData,
                        version: QrVersions.auto,
                        size: 190.0,
                        gapless: false,
                        backgroundColor: Colors.white,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Color(0xFF0F172A),
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'CODE: $code',
                        style: GoogleFonts.roboto(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          letterSpacing: 1.5,
                          color: const Color(0xFF15803D),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Scan using any Camera, Google Lens, or Scanner to download app with your referral tag applied!',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.roboto(
                        fontSize: 11,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _shareCode(code);
                  },
                  icon: const Icon(Icons.share_rounded, size: 18),
                  label: const Text('Share Referral Link'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    textStyle: GoogleFonts.roboto(fontWeight: FontWeight.w800, fontSize: 13.5),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(dynamic rawDate) {
    if (rawDate == null) return '';
    try {
      final dt = DateTime.parse(rawDate.toString());
      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return rawDate.toString().split('T').first;
    }
  }

  @override
  Widget build(BuildContext context) {
    final stats = (_data?['stats'] as Map<String, dynamic>?) ?? {};
    final total = stats['total_referrals'] ?? _data?['total_referrals'] ?? 0;
    final eligible = stats['eligible_referrals'] ?? stats['successful_referrals'] ?? 0;
    final totalEarned = (stats['total_earned'] ?? (eligible * 75)).toDouble();
    final totalPaid = (stats['total_paid'] ?? 0).toDouble();
    final outstanding = (stats['outstanding_amount'] ?? (totalEarned - totalPaid)).toDouble();
    final code = _data?['referral_code'] as String? ?? 'F2HDR-789';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const F2hAppBar(
        title: 'Referral Hub',
        subtitle: 'Earn ₹75 for every new customer',
        icon: Icons.card_giftcard_rounded,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadReferrals,
                  color: const Color(0xFF16A34A),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    children: [
                      _buildHeroCard(code, totalEarned),
                      const SizedBox(height: 16),
                      _buildMetricCards(
                        total: total,
                        eligible: eligible,
                        totalPaid: totalPaid,
                        outstanding: outstanding,
                      ),
                      const SizedBox(height: 16),
                      _buildMilestoneTracker(eligible: eligible),
                      const SizedBox(height: 16),
                      _buildQuickShareStrip(code),
                      const SizedBox(height: 16),
                      _buildHowItWorksCard(),
                      const SizedBox(height: 20),
                      _buildLedgerSection(),
                      const SizedBox(height: 20),
                      _buildFaqSection(),
                    ],
                  ),
                ),
      bottomNavigationBar: _loading || _error != null
          ? null
          : _buildStickyBottomBar(code),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFFEE2E2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded, size: 48, color: kDanger),
            ),
            const SizedBox(height: 16),
            Text(
              'Unable to load referrals',
              style: GoogleFonts.roboto(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(color: const Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _loadReferrals,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroCard(String code, double totalEarned) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFF0F172A),
            Color(0xFF1E293B),
            Color(0xFF064E3B),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33064E3B),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background decorative glow shapes
          Positioned(
            right: -20,
            top: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF22C55E).withValues(alpha: 0.15),
              ),
            ),
          ),
          Positioned(
            left: -30,
            bottom: -30,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF38BDF8).withValues(alpha: 0.10),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF22C55E).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF22C55E).withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bolt_rounded, color: Color(0xFF4ADE80), size: 14),
                          const SizedBox(width: 4),
                          Text(
                            'UNLIMITED EARNINGS',
                            style: GoogleFonts.roboto(
                              color: const Color(0xFF4ADE80),
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    GestureCarbonQrButton(
                      onTap: () => _showQrCodeDialog(code),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Earn ₹75 Per Customer',
                  style: GoogleFonts.roboto(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Share your referral link with customers on your route. When they place their first order, ₹75 is credited to your settlement.',
                  style: GoogleFonts.roboto(
                    fontSize: 12,
                    color: const Color(0xFF94A3B8),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 18),

                // Referral Code Highlight Box
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'YOUR REFERRAL CODE',
                            style: GoogleFonts.roboto(
                              color: const Color(0xFF94A3B8),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            code,
                            style: GoogleFonts.roboto(
                              color: const Color(0xFF4ADE80),
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2.0,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      ElevatedButton.icon(
                        onPressed: () => _copyCode(code),
                        icon: const Icon(Icons.copy_rounded, size: 14),
                        label: const Text('Copy'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF22C55E),
                          foregroundColor: const Color(0xFF0F172A),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          textStyle: GoogleFonts.roboto(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCards({
    required dynamic total,
    required dynamic eligible,
    required double totalPaid,
    required double outstanding,
  }) {
    return Column(
      children: [
        Row(
          children: [
            _buildMetricTile(
              title: 'Total Referrals',
              value: '$total',
              subtitle: 'Customers invited',
              icon: Icons.people_alt_rounded,
              accentColor: const Color(0xFF2563EB),
              bgGradient: const [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
            ),
            const SizedBox(width: 12),
            _buildMetricTile(
              title: 'Eligible (₹75)',
              value: '$eligible',
              subtitle: '1st order placed',
              icon: Icons.verified_rounded,
              accentColor: const Color(0xFF16A34A),
              bgGradient: const [Color(0xFFF0FDF4), Color(0xFFDCFCE7)],
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildMetricTile(
              title: 'Paid Out',
              value: '₹${totalPaid.toStringAsFixed(0)}',
              subtitle: 'Transferred / Cash',
              icon: Icons.payments_rounded,
              accentColor: const Color(0xFF0D9488),
              bgGradient: const [Color(0xFFF0FDFA), Color(0xFFCCFBF1)],
            ),
            const SizedBox(width: 12),
            _buildMetricTile(
              title: 'Pending Payout',
              value: '₹${outstanding.toStringAsFixed(0)}',
              subtitle: 'Settlement due',
              icon: Icons.account_balance_wallet_rounded,
              accentColor: const Color(0xFFD97706),
              bgGradient: const [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color accentColor,
    required List<Color> bgGradient,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 10,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: bgGradient),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: accentColor, size: 18),
                ),
                const Spacer(),
                Text(
                  title,
                  style: GoogleFonts.roboto(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: GoogleFonts.roboto(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: GoogleFonts.roboto(
                fontSize: 10.5,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMilestoneTracker({required dynamic eligible}) {
    final count = (eligible is num ? eligible : int.tryParse(eligible.toString()) ?? 0).toInt();
    int nextMilestone = 5;
    if (count >= 5 && count < 10) nextMilestone = 10;
    if (count >= 10 && count < 25) nextMilestone = 25;
    if (count >= 25 && count < 50) nextMilestone = 50;
    if (count >= 50) nextMilestone = 100;

    final progress = (count / nextMilestone).clamp(0.0, 1.0);
    final remaining = (nextMilestone - count).clamp(0, nextMilestone);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.workspace_premium_rounded, color: Color(0xFFD97706), size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rider Milestone Reward',
                      style: GoogleFonts.roboto(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      remaining > 0
                          ? '$remaining more customer referrals to unlock Milestone bonus'
                          : 'Milestone reached! Claim bonus with admin.',
                      style: GoogleFonts.roboto(fontSize: 11, color: const Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$count / $nextMilestone',
                  style: GoogleFonts.roboto(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: const Color(0xFFF1F5F9),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickShareStrip(String code) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.flash_on_rounded, color: Color(0xFF16A34A), size: 18),
              const SizedBox(width: 6),
              Text(
                'Instant One-Tap Share',
                style: GoogleFonts.roboto(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF14532D),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: ElevatedButton.icon(
                  onPressed: () => _shareWhatsApp(code),
                  icon: const Icon(Icons.chat_rounded, size: 18, color: Colors.white),
                  label: const Text('WhatsApp'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: GoogleFonts.roboto(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  onPressed: () => _shareCode(code),
                  icon: const Icon(Icons.share_rounded, size: 16, color: Color(0xFF16A34A)),
                  label: const Text('More'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF16A34A),
                    side: const BorderSide(color: Color(0xFF16A34A), width: 1.4),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: GoogleFonts.roboto(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorksCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF2563EB), size: 18),
              ),
              const SizedBox(width: 10),
              Text(
                'How Referral Works',
                style: GoogleFonts.roboto(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildJourneyStep('1', 'Share Your Code', 'Send your customer invite link via WhatsApp, SMS, or QR code.', const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
          const SizedBox(height: 12),
          _buildJourneyStep('2', 'Friend Installs App', 'Customer signs up on the F2H Customer App using your referral code.', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
          const SizedBox(height: 12),
          _buildJourneyStep('3', 'First Order Placed', 'Customer receives pure milk / fresh produce at their doorstep.', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
          const SizedBox(height: 12),
          _buildJourneyStep('4', '₹75 Cash Credited', '₹75 per eligible referral is paid out offline in your monthly settlement.', const Color(0xFF9333EA), const Color(0xFFF3E8FF)),
        ],
      ),
    );
  }

  Widget _buildJourneyStep(String number, String title, String subtitle, Color fg, Color bg) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Text(
            number,
            style: GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w900, color: fg),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.roboto(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0F172A),
                ),
              ),
              Text(
                subtitle,
                style: GoogleFonts.roboto(
                  fontSize: 11.5,
                  color: const Color(0xFF64748B),
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLedgerSection() {
    final rawReferrals = _data?['referrals'] as List<dynamic>? ?? [];
    final payments = _data?['payments_history'] as List<dynamic>? ?? [];

    // Filter referrals by status and search query
    final referrals = rawReferrals.where((r) {
      final item = r as Map<String, dynamic>;
      final name = (item['referee_name'] as String? ?? '').toLowerCase();
      final phone = (item['referee_phone'] as String? ?? '').toLowerCase();
      final status = (item['status'] as String? ?? '').toLowerCase();
      final paymentStatus = (item['payment_status'] as String? ?? '').toLowerCase();

      final matchesQuery = _searchQuery.isEmpty || name.contains(_searchQuery) || phone.contains(_searchQuery);
      if (!matchesQuery) return false;

      if (_selectedStatusFilter == 'eligible') {
        return status == 'eligible' || status == 'rewarded' || status == 'completed';
      } else if (_selectedStatusFilter == 'paid') {
        return paymentStatus == 'paid';
      } else if (_selectedStatusFilter == 'pending') {
        return status == 'pending';
      }
      return true;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Activity Ledger',
              style: GoogleFonts.roboto(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF0F172A),
              ),
            ),
            const Spacer(),
            Text(
              '${rawReferrals.length} Total',
              style: GoogleFonts.roboto(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF64748B),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Segmented Tabs
        Container(
          height: 44,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(14),
          ),
          child: TabBar(
            controller: _tabController,
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            splashFactory: NoSplash.splashFactory,
            overlayColor: WidgetStateProperty.resolveWith<Color?>((states) => Colors.transparent),
            indicator: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            labelColor: const Color(0xFF0F172A),
            unselectedLabelColor: const Color(0xFF64748B),
            labelStyle: GoogleFonts.roboto(fontSize: 12.5, fontWeight: FontWeight.w800),
            unselectedLabelStyle: GoogleFonts.roboto(fontSize: 12.5, fontWeight: FontWeight.w600),
            labelPadding: EdgeInsets.zero,
            tabs: [
              Tab(
                height: 36,
                child: Center(
                  child: Text(
                    'Referred Customers (${rawReferrals.length})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              Tab(
                height: 36,
                child: Center(
                  child: Text(
                    'Payouts (${payments.length})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Search & Filter Bar for Referrals Tab
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: _searchController,
            onChanged: (val) {
              setState(() {
                _searchQuery = val.trim().toLowerCase();
              });
            },
            decoration: InputDecoration(
              hintText: 'Search customer name or phone...',
              hintStyle: GoogleFonts.roboto(color: const Color(0xFF94A3B8), fontSize: 12.5),
              prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            style: GoogleFonts.roboto(fontSize: 13, color: const Color(0xFF0F172A)),
          ),
        ),
        const SizedBox(height: 10),

        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildFilterChip('All', 'all'),
              const SizedBox(width: 8),
              _buildFilterChip('Eligible (₹75)', 'eligible'),
              const SizedBox(width: 8),
              _buildFilterChip('Paid', 'paid'),
              const SizedBox(width: 8),
              _buildFilterChip('Pending', 'pending'),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Content Area
        SizedBox(
          height: 420,
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildReferralsList(referrals),
              _buildPaymentsList(payments),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedStatusFilter == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedStatusFilter = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFCBD5E1),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.roboto(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  Widget _buildReferralsList(List<dynamic> referrals) {
    if (referrals.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.people_outline_rounded, size: 36, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 14),
            Text(
              _searchQuery.isNotEmpty ? 'No matches found' : 'No referrals yet',
              style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Try a different search term or filter'
                  : 'Share your referral code to start earning ₹75 on each new customer!',
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(fontSize: 12, color: const Color(0xFF64748B)),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: referrals.length,
        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
        itemBuilder: (_, i) {
          final r = referrals[i] as Map<String, dynamic>;
          final name = r['referee_name'] as String? ?? 'Customer';
          final phone = r['referee_phone'] as String? ?? '';
          final date = _formatDate(r['created_at']);
          final status = (r['status'] as String? ?? 'pending').toLowerCase();
          final paymentStatus = (r['payment_status'] as String? ?? 'unpaid').toLowerCase();
          final isPaid = paymentStatus == 'paid';
          final isEligible = status == 'eligible' || status == 'rewarded' || status == 'completed';

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: isPaid
                        ? const Color(0xFFDCFCE7)
                        : (isEligible ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9)),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'C',
                    style: GoogleFonts.roboto(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: isPaid
                          ? const Color(0xFF15803D)
                          : (isEligible ? const Color(0xFFB45309) : const Color(0xFF64748B)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: GoogleFonts.roboto(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (phone.isNotEmpty)
                        Text(
                          phone,
                          style: GoogleFonts.roboto(fontSize: 11, color: const Color(0xFF64748B)),
                        ),
                      if (date.isNotEmpty)
                        Text(
                          'Referred: $date',
                          style: GoogleFonts.roboto(fontSize: 10, color: const Color(0xFF94A3B8)),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '+₹75.00',
                      style: GoogleFonts.roboto(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: isEligible || isPaid ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isPaid
                            ? const Color(0xFFDCFCE7)
                            : (isEligible ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isPaid ? 'PAID' : (isEligible ? 'ELIGIBLE' : 'PENDING'),
                        style: GoogleFonts.roboto(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          color: isPaid
                              ? const Color(0xFF15803D)
                              : (isEligible ? const Color(0xFFB45309) : const Color(0xFF64748B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPaymentsList(List<dynamic> payments) {
    if (payments.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.receipt_long_rounded, size: 36, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 14),
            Text(
              'No payout history yet',
              style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            Text(
              'Referral earnings will appear here once settled offline by admin.',
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(fontSize: 12, color: const Color(0xFF64748B)),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: payments.length,
        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
        itemBuilder: (_, i) {
          final p = payments[i] as Map<String, dynamic>;
          final amount = (p['amount'] is num ? p['amount'] : double.tryParse(p['amount']?.toString() ?? '75') ?? 75.0).toDouble();
          final date = _formatDate(p['paid_at']);
          final ref = p['payment_reference'] as String? ?? 'Physical / Bank Settlement';
          final referee = p['referee_name'] as String? ?? 'Customer Referral';

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payout: $ref',
                        style: GoogleFonts.roboto(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                      ),
                      Text(
                        'Referee: $referee',
                        style: GoogleFonts.roboto(fontSize: 11, color: const Color(0xFF64748B)),
                      ),
                      if (date.isNotEmpty)
                        Text(
                          'Paid on $date',
                          style: GoogleFonts.roboto(fontSize: 10, color: const Color(0xFF94A3B8)),
                        ),
                    ],
                  ),
                ),
                Text(
                  '₹${amount.toStringAsFixed(2)}',
                  style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w900, color: const Color(0xFF15803D)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildFaqSection() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.help_outline_rounded, color: Color(0xFF16A34A), size: 20),
              const SizedBox(width: 8),
              Text(
                'Frequently Asked Questions',
                style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildFaqItem(
            'When do I receive my ₹75 referral bonus?',
            'Referral bonuses become eligible once the referred customer places and successfully receives their first order. Payouts are settled offline at month-end.',
          ),
          _buildFaqItem(
            'Is there any limit on referrals?',
            'No! You can refer as many customers, apartments, and neighbors as you want. There is no ceiling on your earnings.',
          ),
          _buildFaqItem(
            'What benefit does the customer get?',
            'Customers signing up with your code receive special introductory discounts and bonus milk credits on their subscription.',
          ),
        ],
      ),
    );
  }

  Widget _buildFaqItem(String question, String answer) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: Text(
          question,
          style: GoogleFonts.roboto(fontSize: 12.5, fontWeight: FontWeight.w700, color: const Color(0xFF1E293B)),
        ),
        children: [
          Text(
            answer,
            style: GoogleFonts.roboto(fontSize: 11.5, color: const Color(0xFF64748B), height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildStickyBottomBar(String code) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _shareWhatsApp(code),
                icon: const Icon(Icons.chat_rounded, size: 20, color: Colors.white),
                label: const Text('Share on WhatsApp'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF25D366),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: GoogleFonts.roboto(fontWeight: FontWeight.w800, fontSize: 13.5),
                ),
              ),
            ),
            const SizedBox(width: 10),
            IconButton.filled(
              onPressed: () => _copyCode(code),
              icon: const Icon(Icons.copy_rounded, size: 18),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xFFF1F5F9),
                foregroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.all(14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GestureCarbonQrButton extends StatelessWidget {
  final VoidCallback onTap;

  const GestureCarbonQrButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.qr_code_rounded, color: Colors.white, size: 16),
            const SizedBox(width: 6),
            Text(
              'QR Code',
              style: GoogleFonts.roboto(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 11.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
