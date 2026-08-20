import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
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

class _ReferralScreenState extends State<ReferralScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _loadReferrals();
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
    } catch (e) {
      setState(() { _error = 'Failed to load referrals. Please try again.'; _loading = false; });
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    AppSnackBar.success(context, 'Referral code copied!');
  }

  Future<void> _shareCode(String code) async {
    final message = 'Join Farm to Home using my referral code: $code\nDownload the app and get exclusive farm fresh benefits!\nhttps://f2hfresh.com';
    final encoded = Uri.encodeComponent(message);
    final url = Uri.parse('https://wa.me/?text=$encoded');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      _copyCode(code);
      if (mounted) AppSnackBar.info(context, 'Code copied! Share it with your friends.');
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'rewarded':
      case 'completed':
      case 'credited':
      case 'success':
      case 'active':
        return const Color(0xFF15803D);
      case 'pending':
        return const Color(0xFFB45309);
      case 'failed':
      case 'expired':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF64748B);
    }
  }

  Color _statusBg(String status) {
    switch (status.toLowerCase()) {
      case 'rewarded':
      case 'completed':
      case 'credited':
      case 'success':
      case 'active':
        return const Color(0xFFDCFCE7);
      case 'pending':
        return const Color(0xFFFEF3C7);
      case 'failed':
      case 'expired':
        return const Color(0xFFFEE2E2);
      default:
        return const Color(0xFFF1F5F9);
    }
  }

  bool _isRewarded(String status) {
    final s = status.toLowerCase();
    return s == 'rewarded' || s == 'completed' || s == 'credited' || s == 'success' || s == 'active';
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
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const F2hAppBar(
        title: 'Referrals',
        subtitle: 'Earn \u20b975 for every customer you refer',
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
                      _buildStatsRow(),
                      const SizedBox(height: 20),
                      _buildHowItWorks(),
                      const SizedBox(height: 20),
                      _buildReferralHistory(),
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
                  color: Colors.white.withOpacity(0.2),
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
                      'Your Referral Code',
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
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withOpacity(0.35), width: 1.2),
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
                      color: Colors.white.withOpacity(0.25),
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
                      color: Colors.white.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.35), width: 1.2),
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

  Widget _buildStatsRow() {
    final total = _data?['total_referrals'] ?? 0;
    final rewarded = _data?['rewarded_count'] ?? 0;
    final earningsRaw = _data?['total_earnings'];
    final earnings = earningsRaw is num ? earningsRaw.toDouble() : double.tryParse(earningsRaw?.toString() ?? '0') ?? 0.0;

    return Row(
      children: [
        _buildStatCard('Total Referred', '$total', Icons.people_outline_rounded, const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
        const SizedBox(width: 10),
        _buildStatCard('Rewarded', '$rewarded', Icons.check_circle_outline_rounded, const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
        const SizedBox(width: 10),
        _buildStatCard('Earnings', '\u20b9${earnings.toStringAsFixed(0)}', Icons.currency_rupee_rounded, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
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
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 1),
            Text(
              label,
              style: GoogleFonts.poppins(fontSize: 10.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
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
              const Icon(Icons.info_outline_rounded, color: Color(0xFF2563EB), size: 18),
              const SizedBox(width: 8),
              Text(
                'How It Works',
                style: GoogleFonts.poppins(fontSize: 14.5, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildStep('1', 'Share your referral code with new customers', const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
          const SizedBox(height: 10),
          _buildStep('2', 'Customer signs up and places their first order', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
          const SizedBox(height: 10),
          _buildStep('3', 'You deliver their first order successfully', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
          const SizedBox(height: 10),
          _buildStep('4', 'You earn \u20b975 credited directly to your wallet!', const Color(0xFF9333EA), const Color(0xFFF3E8FF)),
        ],
      ),
    );
  }

  Widget _buildStep(String number, String text, Color fg, Color bg) {
    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(number, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w800, color: fg)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF475569), fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  Widget _buildReferralHistory() {
    final referrals = _data?['referrals'] as List<dynamic>? ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Referral History',
              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A)),
            ),
            Text(
              '${referrals.length} total',
              style: GoogleFonts.poppins(fontSize: 11.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (referrals.isEmpty)
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
            child: Column(
              children: [
                const Icon(Icons.people_outline_rounded, size: 42, color: Color(0xFF94A3B8)),
                const SizedBox(height: 12),
                Text(
                  'No referrals yet',
                  style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Text(
                  'Share your code and start earning \u20b975 per successful referral!',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          )
        else
          Container(
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
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: referrals.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (_, i) {
                final r = referrals[i] as Map<String, dynamic>;
                final status = r['status'] as String? ?? 'pending';
                final rewarded = _isRewarded(status);
                final name = r['referred_name'] as String? ?? 'Customer';
                final phone = r['referred_phone'] as String? ?? '';
                final rewardRaw = r['reward_amount'];
                final reward = rewardRaw is num ? rewardRaw : double.tryParse(rewardRaw?.toString() ?? '75') ?? 75.0;
                final date = _formatDate(r['created_at']);
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: rewarded ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'C',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: rewarded ? const Color(0xFF15803D) : const Color(0xFF64748B),
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
                              style: GoogleFonts.poppins(fontSize: 13.5, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                            ),
                            if (phone.isNotEmpty)
                              Text(
                                phone,
                                style: GoogleFonts.poppins(fontSize: 11.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
                              ),
                            if (date.isNotEmpty)
                              Text(
                                date,
                                style: GoogleFonts.poppins(fontSize: 10.5, color: const Color(0xFF94A3B8)),
                              ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (rewarded)
                            Text(
                              '+\u20b9${reward.toStringAsFixed(0)}',
                              style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF16A34A)),
                            ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
                            child: Text(
                              status.toUpperCase(),
                              style: GoogleFonts.poppins(fontSize: 9.5, fontWeight: FontWeight.w800, color: _statusColor(status)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
