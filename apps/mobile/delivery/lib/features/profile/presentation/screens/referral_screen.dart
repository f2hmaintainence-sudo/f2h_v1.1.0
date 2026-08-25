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
    super.dispose();
  }

  Future<void> _loadReferrals() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dioClient = DioClient();
      final res = await dioClient.dio.get(ApiEndpoints.profileReferrals);
      final body = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
      final data = body['data'] is Map ? Map<String, dynamic>.from(body['data'] as Map) : <String, dynamic>{};
      setState(() { _data = data; _loading = false; });
    } on DioException catch (e) {
      setState(() { _error = e.response?.data?['message'] ?? 'Failed to load referrals. Please try again.'; _loading = false; });
    } catch (_) {
      setState(() { _error = 'Failed to load referrals. Please try again.'; _loading = false; });
    }
  }

  String _getShareMessage(String code) {
    return '🥛 Order 100% Pure, Farm-Fresh Milk, Organic Vegetables & Daily Groceries delivered to your doorstep with Farm to Home (F2H)!\n\n'
        '🎁 Use my Customer Referral Code: $code to get special discounts on your first order!\n\n'
        '📲 Download the F2H Customer App now:\n'
        '$_customerAppUrl';
  }

  void _copyCode(String code) {
    final fullMessage = _getShareMessage(code);
    Clipboard.setData(ClipboardData(text: fullMessage));
    AppSnackBar.success(context, 'Customer referral link & code copied!');
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

  void _showShareBottomSheet(String code) {
    final message = _getShareMessage(code);
    final encoded = Uri.encodeComponent(message);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Share Customer Referral Link',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Invite customers to order fresh farm products & earn \u20b975 per customer',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildShareOption(
                    icon: Icons.chat_rounded,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('https://wa.me/?text=$encoded');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      } else {
                        _copyCode(code);
                      }
                    },
                  ),
                  _buildShareOption(
                    icon: Icons.send_rounded,
                    label: 'Telegram',
                    color: const Color(0xFF0088CC),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('https://t.me/share/url?url=${Uri.encodeComponent(_customerAppUrl)}&text=${Uri.encodeComponent(message)}');
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
                    icon: Icons.share_rounded,
                    label: 'All Apps',
                    color: const Color(0xFF16A34A),
                    onTap: () {
                      Navigator.pop(ctx);
                      Share.share(
                        message,
                        subject: 'Farm to Home (F2H) - Fresh Milk & Groceries Referral',
                      );
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
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.poppins(
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

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const F2hAppBar(
        title: 'Refer & Earn \u20b975',
        subtitle: 'Earn \u20b975 for every customer referred',
        icon: Icons.card_giftcard_rounded,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadReferrals,
                  color: kPrimary,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                    children: [
                      _buildReferralCodeCard(),
                      const SizedBox(height: 16),
                      _buildStatsRow(
                        total: total,
                        eligible: eligible,
                        totalPaid: totalPaid,
                        outstanding: outstanding,
                      ),
                      const SizedBox(height: 16),
                      _buildOfflinePaymentNotice(),
                      const SizedBox(height: 16),
                      _buildHowItWorks(),
                      const SizedBox(height: 20),
                      _buildTabsSection(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 56, color: kDanger),
            const SizedBox(height: 16),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(color: const Color(0xFF64748B), fontSize: 13.5),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _loadReferrals,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReferralCodeCard() {
    final code = _data?['referral_code'] as String? ?? 'F2HDR-789';
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF15803D), Color(0xFF16A34A), Color(0xFF22C55E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(color: Color(0x2816A34A), blurRadius: 16, offset: Offset(0, 6)),
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
                  color: Colors.white.withValues(alpha: 0.20),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.card_giftcard_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Customer Referral Code',
                      style: GoogleFonts.poppins(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      'Share & Earn \u20b975 per customer',
                      style: GoogleFonts.poppins(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.2),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    code,
                    style: GoogleFonts.poppins(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 2.0,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => _copyCode(code),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.copy_rounded, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _copyCode(code),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.2),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.copy_rounded, color: Colors.white, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Copy Code',
                          style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => _shareCode(code),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(color: Color(0x1A000000), blurRadius: 8, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.share_rounded, color: Color(0xFF16A34A), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Share Now',
                          style: GoogleFonts.poppins(color: const Color(0xFF16A34A), fontWeight: FontWeight.w800, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow({
    required dynamic total,
    required dynamic eligible,
    required double totalPaid,
    required double outstanding,
  }) {
    return Column(
      children: [
        Row(
          children: [
            _buildStatCard('Total Referrals', '$total', Icons.people_outline_rounded, const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
            const SizedBox(width: 10),
            _buildStatCard('Eligible (\u20b975)', '$eligible', Icons.check_circle_outline_rounded, const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _buildStatCard('Paid Out', '\u20b9${totalPaid.toStringAsFixed(0)}', Icons.payments_outlined, const Color(0xFF0D9488), const Color(0xFFCCFBF1)),
            const SizedBox(width: 10),
            _buildStatCard('Outstanding', '\u20b9${outstanding.toStringAsFixed(0)}', Icons.hourglass_bottom_rounded, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x04000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
                  ),
                  Text(
                    label,
                    style: GoogleFonts.poppins(fontSize: 10.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfflinePaymentNotice() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFF16A34A), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Offline Monthly Settlement',
                  style: GoogleFonts.poppins(fontSize: 12.5, fontWeight: FontWeight.w800, color: const Color(0xFF14532D)),
                ),
                const SizedBox(height: 2),
                Text(
                  'Referral bonuses (\u20b975 per eligible customer) are disbursed offline via cash or direct bank transfer at month-end.',
                  style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF166534), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorks() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lightbulb_outline_rounded, color: Color(0xFF2563EB), size: 18),
              const SizedBox(width: 8),
              Text(
                'How Customer Referral Works',
                style: GoogleFonts.poppins(fontSize: 14.5, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildStep('1', 'Share your customer referral link with friends, family & neighbors', const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
          const SizedBox(height: 10),
          _buildStep('2', 'Customer downloads the F2H Customer App using your link', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
          const SizedBox(height: 10),
          _buildStep('3', 'Customer signs up, adds your code, and places their first order', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
          const SizedBox(height: 10),
          _buildStep('4', 'You earn \u20b975 per customer, paid out offline at month-end settlement!', const Color(0xFF9333EA), const Color(0xFFF3E8FF)),
        ],
      ),
    );
  }

  Widget _buildStep(String number, String text, Color fg, Color bg) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(number, style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.poppins(fontSize: 11.5, color: const Color(0xFF475569), fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  Widget _buildTabsSection() {
    final referrals = _data?['referrals'] as List<dynamic>? ?? [];
    final payments = _data?['payments_history'] as List<dynamic>? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.all(3),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1)),
              ],
            ),
            labelColor: const Color(0xFF0F172A),
            unselectedLabelColor: const Color(0xFF64748B),
            labelStyle: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w800),
            unselectedLabelStyle: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600),
            tabs: [
              Tab(text: 'Referred Customers (${referrals.length})'),
              Tab(text: 'Payouts (${payments.length})'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 380,
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

  Widget _buildReferralsList(List<dynamic> referrals) {
    if (referrals.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.people_outline_rounded, size: 42, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(
              'No referrals yet',
              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            Text(
              'Share your code and earn \u20b975 for each new customer who orders!',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 6),
        itemCount: referrals.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
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
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: isPaid
                        ? const Color(0xFFDCFCE7)
                        : (isEligible ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'C',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
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
                        style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                      ),
                      if (phone.isNotEmpty)
                        Text(
                          phone,
                          style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF64748B)),
                        ),
                      if (date.isNotEmpty)
                        Text(
                          'Referred: $date',
                          style: GoogleFonts.poppins(fontSize: 10, color: const Color(0xFF94A3B8)),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '+\u20b975.00',
                      style: GoogleFonts.poppins(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: isEligible ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: isPaid
                            ? const Color(0xFFDCFCE7)
                            : (isEligible ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9)),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isPaid ? 'PAID' : (isEligible ? 'ELIGIBLE' : 'PENDING'),
                        style: GoogleFonts.poppins(
                          fontSize: 9,
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
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.receipt_long_rounded, size: 42, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(
              'No payout history yet',
              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            Text(
              'Referral earnings will appear here once settled offline by admin.',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 6),
        itemCount: payments.length,
        separatorBuilder: (context, index) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
        itemBuilder: (_, i) {
          final p = payments[i] as Map<String, dynamic>;
          final amount = (p['amount'] is num ? p['amount'] : double.tryParse(p['amount']?.toString() ?? '75') ?? 75.0).toDouble();
          final date = _formatDate(p['paid_at']);
          final ref = p['payment_reference'] as String? ?? 'Physical / Cash Payout';
          final referee = p['referee_name'] as String? ?? 'Customer';

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payout: $ref',
                        style: GoogleFonts.poppins(fontSize: 12.5, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                      ),
                      Text(
                        'Referee: $referee',
                        style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF64748B)),
                      ),
                      if (date.isNotEmpty)
                        Text(
                          'Paid on $date',
                          style: GoogleFonts.poppins(fontSize: 10, color: const Color(0xFF94A3B8)),
                        ),
                    ],
                  ),
                ),
                Text(
                  '\u20b9${amount.toStringAsFixed(2)}',
                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF15803D)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
