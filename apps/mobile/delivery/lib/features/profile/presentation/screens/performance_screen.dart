import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/attendance_day_details_screen.dart';

enum PerformanceTab { attendance, leaderboard, kyc }

class PerformanceScreen extends StatefulWidget {
  final ProfileModel profile;
  final PerformanceTab initialTab;

  const PerformanceScreen({
    super.key,
    required this.profile,
    required this.initialTab,
  });

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  late int _year;
  late int _month;

  Map<String, dynamic>? _attendanceData;
  Map<String, dynamic>? _leaderboardData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _year = now.year;
    _month = now.month;
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final bloc = context.read<ProfileBloc>();
      final repo = bloc.repository;

      if (widget.initialTab == PerformanceTab.attendance) {
        _attendanceData = await repo.fetchAttendance(_year, _month);
      } else if (widget.initialTab == PerformanceTab.leaderboard) {
        _leaderboardData = await repo.fetchLeaderboard(_year, _month);
      }

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _month += delta;
      if (_month > 12) {
        _month = 1;
        _year++;
      } else if (_month < 1) {
        _month = 12;
        _year--;
      }
    });
    _loadData();
  }

  String _getTitle() {
    switch (widget.initialTab) {
      case PerformanceTab.attendance:
        return 'Attendance Log';
      case PerformanceTab.leaderboard:
        return 'Leaderboard Rank';
      case PerformanceTab.kyc:
        return 'KYC Documents';
    }
  }

  static const _monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _getTitle(),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (widget.initialTab == PerformanceTab.kyc) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [_buildKycStatusCard()],
      );
    }

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: kRed, size: 48),
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: kTextSub, fontSize: 13), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadData,
                style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
                child: const Text('Retry', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildMonthNavigator(),
        const SizedBox(height: 16),
        if (widget.initialTab == PerformanceTab.attendance) _buildAttendanceCard(),
        if (widget.initialTab == PerformanceTab.leaderboard) _buildLeaderboardCard(),
      ],
    );
  }

  Widget _buildMonthNavigator() {
    final now = DateTime.now();
    final isCurrentMonth = _year == now.year && _month == now.month;

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left, color: kPrimary),
            onPressed: () => _changeMonth(-1),
          ),
          Text(
            '${_monthNames[_month]} $_year',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kText),
          ),
          IconButton(
            icon: Icon(Icons.chevron_right, color: isCurrentMonth ? kMuted : kPrimary),
            onPressed: isCurrentMonth ? null : () => _changeMonth(1),
          ),
        ],
      ),
    );
  }

  // ─── Attendance ────────────────────────────────────────────────────────────

  Widget _buildAttendanceCard() {
    final data = _attendanceData;
    if (data == null) return const SizedBox.shrink();

    final daysInMonth = data['days_in_month'] as int? ?? 30;
    final attendanceList = (data['attendance'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final summary = data['summary'] as Map<String, dynamic>? ?? {};
    final present = summary['present'] as int? ?? 0;
    final absent = summary['absent'] as int? ?? 0;
    final partial = summary['partial'] as int? ?? 0;

    return Column(
      children: [
        // Summary row
        Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [kPrimary, kPrimaryMid],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildSummaryItem('Present', '$present', Colors.white),
              _buildSummaryItem('Absent', '$absent', kRedLt),
              _buildSummaryItem('Partial', '$partial', kAccentLt),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Calendar grid
        Container(
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: kBorder),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Text('📅', style: TextStyle(fontSize: 20)),
                  SizedBox(width: 8),
                  Text(
                    'Daily Attendance',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Based on your delivery runs for this month.',
                style: TextStyle(fontSize: 12, color: kTextSub),
              ),
              const SizedBox(height: 16),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: daysInMonth,
                itemBuilder: (context, index) {
                  final day = index + 1;
                  final entry = day <= attendanceList.length ? attendanceList[day - 1] : null;
                  final status = entry?['status'] as String? ?? 'off';

                  Color bg;
                  Color fg;
                  Border? border;

                  switch (status) {
                    case 'present':
                      bg = kPrimaryPl;
                      fg = kPrimary;
                      break;
                    case 'absent':
                      bg = kRedLt;
                      fg = kRed;
                      break;
                    case 'partial':
                      bg = const Color(0xFFFFF8E1);
                      fg = const Color(0xFFFFB300);
                      break;
                    default: // 'off'
                      bg = kBgDeep;
                      fg = kTextSub;
                      border = Border.all(color: kBorderLt);
                  }

                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        final dateStr = '$_year-${_month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
                        final repo = context.read<ProfileBloc>().repository;
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AttendanceDayDetailsScreen(
                              dateStr: dateStr,
                              repository: repo,
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        decoration: BoxDecoration(
                          color: bg,
                          borderRadius: BorderRadius.circular(8),
                          border: border,
                        ),
                        child: Center(
                          child: Text(
                            '$day',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: fg,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildLegendTile('Present', kPrimaryPl, kPrimary),
                  _buildLegendTile('Absent', kRedLt, kRed),
                  _buildLegendTile('Partial', const Color(0xFFFFF8E1), const Color(0xFFFFB300)),
                  _buildLegendTile('Off', kBgDeep, kTextSub),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, Color textColor) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: textColor),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: textColor.withValues(alpha: 0.8), fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  static Widget _buildLegendTile(String label, Color bg, Color border) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: border.withValues(alpha: 0.3)),
          ),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w500)),
      ],
    );
  }

  // ─── Leaderboard ───────────────────────────────────────────────────────────

  Widget _buildLeaderboardCard() {
    final data = _leaderboardData;
    if (data == null) return const SizedBox.shrink();

    final rank = data['rank'] as int?;
    final totalRiders = data['total_riders'] as int? ?? 0;
    final myStats = data['my_stats'] as Map<String, dynamic>?;
    final topRiders = (data['top_riders'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    final activeDays = myStats?['active_days'] ?? 0;
    final totalCompleted = myStats?['total_completed'] ?? 0;
    final deliveryRate = myStats?['delivery_rate'] ?? 0;

    return Column(
      children: [
        // Rank hero card
        Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [kPrimary, kPrimaryMid],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'YOUR RANK',
                    style: TextStyle(color: kAccent, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_monthNames[_month]} $_year',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    rank != null ? '#$rank' : '--',
                    style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    totalRiders > 0 ? 'out of $totalRiders riders' : 'No data yet',
                    style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  const Spacer(),
                  Text(
                    rank != null && rank <= 3 ? '🏆' : '🎯',
                    style: const TextStyle(fontSize: 44),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Colors.white24, height: 1),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStatDetail('Active Days', '$activeDays'),
                  _buildStatDetail('Deliveries', '$totalCompleted'),
                  _buildStatDetail('Delivery Rate', '$deliveryRate%'),
                ],
              ),
            ],
          ),
        ),

        if (topRiders.isNotEmpty) ...[
          const SizedBox(height: 20),

          // Top riders list
          Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text('🏅', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 8),
                    Text(
                      'Top Riders',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kPrimary),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...topRiders.map((rider) => _buildRiderRow(rider)),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildRiderRow(Map<String, dynamic> rider) {
    final riderRank = rider['rank'] as int? ?? 0;
    final name = rider['full_name']?.toString() ?? 'Unknown';
    final completed = rider['total_completed'] as int? ?? 0;
    final rate = rider['delivery_rate'] ?? 0;
    final isMe = rider['is_me'] == true;

    Color? bgColor;
    Widget leadingWidget;

    if (riderRank == 1) {
      bgColor = const Color(0xFFFFF8E1);
      leadingWidget = const Text('🥇', style: TextStyle(fontSize: 20));
    } else if (riderRank == 2) {
      bgColor = const Color(0xFFF5F5F5);
      leadingWidget = const Text('🥈', style: TextStyle(fontSize: 20));
    } else if (riderRank == 3) {
      bgColor = const Color(0xFFFBE9E7);
      leadingWidget = const Text('🥉', style: TextStyle(fontSize: 20));
    } else {
      leadingWidget = Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: kBgDeep,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Center(
          child: Text(
            '#$riderRank',
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: kTextMid),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isMe ? kPrimaryPl : (bgColor ?? kSurface),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isMe ? kPrimaryLt : kBorderLt),
      ),
      child: Row(
        children: [
          leadingWidget,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isMe ? '$name (You)' : name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isMe ? FontWeight.w800 : FontWeight.w600,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$completed deliveries · $rate% rate',
                  style: const TextStyle(fontSize: 11, color: kTextSub),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatDetail(String label, String val) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
        const SizedBox(height: 2),
        Text(val, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  // ─── KYC ───────────────────────────────────────────────────────────────────

  Widget _buildKycStatusCard() {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('📄', style: TextStyle(fontSize: 20)),
              SizedBox(width: 8),
              Text(
                'KYC Documents & Verification',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kPrimary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildKycRow('Aadhaar Card Verification', widget.profile.isVerified),
          _buildKycRow('Driving License Check', widget.profile.isVerified),
          _buildKycRow('Background Checks', widget.profile.isVerified),
          _buildKycRow('Vehicle Smart Card (RC)', widget.profile.vehicleNumber.isNotEmpty),
        ],
      ),
    );
  }

  Widget _buildKycRow(String title, bool isCompleted) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(
            isCompleted ? Icons.check_circle_rounded : Icons.pending_actions_rounded,
            color: isCompleted ? kPrimaryLt : kAccent,
            size: 20,
          ),
          const SizedBox(width: 12),
          Text(
            title,
            style: const TextStyle(fontSize: 13, color: kText, fontWeight: FontWeight.w600),
          ),
          const Spacer(),
          Text(
            isCompleted ? 'Verified' : 'Pending Review',
            style: TextStyle(
              fontSize: 11,
              color: isCompleted ? kPrimary : kAccent,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
