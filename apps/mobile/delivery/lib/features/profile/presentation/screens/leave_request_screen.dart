import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class LeaveRequestScreen extends StatefulWidget {
  const LeaveRequestScreen({super.key});

  @override
  State<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

// Simple date formatters (no intl dependency needed)
String _fmtLong(DateTime d) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
}

String _fmtShort(DateTime d) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
}

String _fmtIso(DateTime d) {
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$m-$day';
}

class _LeaveRequestScreenState extends State<LeaveRequestScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DateTime? _selectedDate;
  DateTime? _selectedEndDate;
  String _leaveType = 'full_day';
  String _halfDayShift = 'morning';
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;
  late DateTime _currentMonth;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    final now = DateTime.now();
    _currentMonth = DateTime(now.year, now.month, 1);
    // Fetch existing requests when screen opens
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProfileBloc>().add(FetchLeaveRequestsEvent());
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _prevMonth() {
    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    if (_currentMonth.year == tomorrow.year && _currentMonth.month == tomorrow.month) {
      return; // Cannot go before tomorrow's month
    }
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
    });
  }

  String _monthName(int month) {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return names[month - 1];
  }

  List<DateTime?> _getCalendarCells() {
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final offset = firstDay.weekday - 1;
    final totalDays = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final List<DateTime?> cells = [];
    for (int i = 0; i < offset; i++) {
      cells.add(null);
    }
    for (int i = 1; i <= totalDays; i++) {
      cells.add(DateTime(_currentMonth.year, _currentMonth.month, i));
    }
    return cells;
  }

  void _onDayTapped(DateTime day) {
    setState(() {
      if (_selectedDate == null) {
        _selectedDate = day;
        _selectedEndDate = null;
      } else if (_selectedEndDate == null) {
        if (day.isBefore(_selectedDate!)) {
          _selectedEndDate = _selectedDate;
          _selectedDate = day;
        } else {
          _selectedEndDate = day;
        }
      } else {
        // Reset and select the new date as start
        _selectedDate = day;
        _selectedEndDate = null;
      }
    });
  }

  Widget _buildCalendarCell(DateTime? cellDate) {
    if (cellDate == null) {
      return const SizedBox();
    }

    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final isCellStart = _selectedDate != null && cellDate.year == _selectedDate!.year && cellDate.month == _selectedDate!.month && cellDate.day == _selectedDate!.day;
    final isCellEnd = _selectedEndDate != null && cellDate.year == _selectedEndDate!.year && cellDate.month == _selectedEndDate!.month && cellDate.day == _selectedEndDate!.day;
    final isCellBetween = _selectedDate != null && _selectedEndDate != null && cellDate.isAfter(_selectedDate!) && cellDate.isBefore(_selectedEndDate!);
    final isCellDisabled = cellDate.isBefore(tomorrow);

    return GestureDetector(
      onTap: isCellDisabled ? null : () => _onDayTapped(cellDate),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Range Flow Background
          if (isCellBetween)
            Container(
              margin: const EdgeInsets.symmetric(vertical: 4),
              color: kPrimaryMid.withValues(alpha: 0.12),
            )
          else if (isCellStart && _selectedEndDate != null)
            Row(
              children: [
                const Expanded(child: SizedBox()),
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: kPrimaryMid.withValues(alpha: 0.12),
                  ),
                ),
              ],
            )
          else if (isCellEnd)
            Row(
              children: [
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: kPrimaryMid.withValues(alpha: 0.12),
                  ),
                ),
                const Expanded(child: SizedBox()),
              ],
            ),

          // Circle indicator / Foreground Text
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: (isCellStart || isCellEnd) ? kPrimary : Colors.transparent,
            ),
            child: Center(
              child: Text(
                '${cellDate.day}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: (isCellStart || isCellEnd || isCellBetween) ? FontWeight.bold : FontWeight.normal,
                  color: isCellDisabled
                      ? kMuted
                      : ((isCellStart || isCellEnd) ? Colors.white : kText),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _submitLeave(BuildContext context) {
    if (_selectedDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select leave dates'),
          backgroundColor: kDanger,
        ),
      );
      return;
    }

    final finalEndDate = _selectedEndDate ?? _selectedDate!;

    setState(() => _isSubmitting = true);
    final startStr = _fmtIso(_selectedDate!);
    final endStr = _fmtIso(finalEndDate);
    
    final isRange = _selectedDate != finalEndDate;
    final typeStr = isRange ? 'full_day' : _leaveType;
    final shiftStr = !isRange && _leaveType == 'half_day' ? _halfDayShift : null;

    context.read<ProfileBloc>().add(SubmitLeaveRequestEvent(
          leaveDate: startStr,
          endDate: endStr,
          leaveType: typeStr,
          halfDayShift: shiftStr,
          reason: _reasonController.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded) {
          setState(() => _isSubmitting = false);
          if (state.successMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.successMessage!),
                backgroundColor: kPrimaryMid,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            );
            // Clear form after successful submission
            if (state.successMessage!.contains('submitted') || state.successMessage!.contains('successfully')) {
              setState(() {
                _selectedDate = null;
                _selectedEndDate = null;
                _leaveType = 'full_day';
                _halfDayShift = 'morning';
                _reasonController.clear();
              });
              _tabController.animateTo(1); // switch to History tab
            }
          }
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: kDanger,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            );
          }
        }
        if (state is ProfileError) {
          setState(() => _isSubmitting = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: kDanger,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      },
      builder: (context, state) {
        final leaveRequests = state is ProfileLoaded ? state.leaveRequests : <Map<String, dynamic>>[];
        final isLoading = state is ProfileLoading;

        return Scaffold(
          backgroundColor: kBg,
          appBar: F2hAppBar(
        title: 'Leave Requests',
        bottom: TabBar(
              controller: _tabController,
              indicatorColor: kAccent,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white54,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              tabs: const [
                Tab(text: '📋 Apply Leave'),
                Tab(text: '🕑 History'),
              ],
            ),
      ),
          body: TabBarView(
            controller: _tabController,
            children: [
              _buildApplyTab(context, isLoading),
              _buildHistoryTab(leaveRequests, isLoading),
            ],
          ),
        );
      },
    );
  }

  Widget _buildApplyTab(BuildContext context, bool isLoading) {
    final isRange = _selectedDate != null && _selectedEndDate != null && _selectedDate != _selectedEndDate;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: kPrimaryPl,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kPrimaryLt.withValues(alpha: 0.4)),
            ),
            child: Row(
              children: const [
                Icon(Icons.info_outline_rounded, color: kPrimaryMid, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Submit your leave request at least 1 day in advance. Your manager will be notified immediately.',
                    style: TextStyle(fontSize: 12, color: kPrimaryMid, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Custom Range Calendar Card
          const Text('Select Leave Dates', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kTextMid)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorderLt),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
              ],
            ),
            child: Column(
              children: [
                // Month Header Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left_rounded),
                      color: kPrimaryMid,
                      onPressed: _prevMonth,
                    ),
                    Text(
                      '${_monthName(_currentMonth.month)} ${_currentMonth.year}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kText),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right_rounded),
                      color: kPrimaryMid,
                      onPressed: _nextMonth,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Weekday names
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: const [
                    Expanded(child: Center(child: Text('Mo', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('Tu', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('We', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('Th', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('Fr', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('Sa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                    Expanded(child: Center(child: Text('Su', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kMuted)))),
                  ],
                ),
                const SizedBox(height: 8),
                // Days Grid
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    childAspectRatio: 1.1,
                  ),
                  itemCount: _getCalendarCells().length,
                  itemBuilder: (context, index) {
                    final cellDate = _getCalendarCells()[index];
                    return _buildCalendarCell(cellDate);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Selected Dates Summary
          if (_selectedDate != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: kPrimaryMid.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.date_range_rounded, color: kPrimaryMid, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _selectedEndDate != null && _selectedEndDate != _selectedDate
                          ? 'Selected Period: ${_fmtShort(_selectedDate!)} to ${_fmtShort(_selectedEndDate!)} (${_selectedEndDate!.difference(_selectedDate!).inDays + 1} Days)'
                          : 'Selected Period: ${_fmtLong(_selectedDate!)} (1 Day)',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: kPrimaryMid,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),

          // Leave Type & Shift Picker (only if single day selected, i.e., not a range)
          if (_selectedDate != null && !isRange) ...[
            // Leave Type
            const Text('Leave Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kTextMid)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _typeButton('full_day', '☀️ Full Day')),
                const SizedBox(width: 12),
                Expanded(child: _typeButton('half_day', '🌤️ Half Day')),
              ],
            ),
            const SizedBox(height: 20),

            // Shift Picker if Half Day
            if (_leaveType == 'half_day') ...[
              const Text('Select Shift', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kTextMid)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _shiftButton('morning', '☀️ Morning Shift')),
                  const SizedBox(width: 12),
                  Expanded(child: _shiftButton('evening', '🌙 Evening Shift')),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ],

          // Reason
          const Text('Reason (Optional)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kTextMid)),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
              ],
            ),
            child: TextField(
              controller: _reasonController,
              maxLines: 4,
              maxLength: 200,
              style: const TextStyle(fontSize: 14, color: kText),
              decoration: const InputDecoration(
                hintText: 'e.g. Personal work, medical appointment...',
                hintStyle: TextStyle(color: kMuted, fontSize: 14),
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(16),
                counterStyle: TextStyle(color: kMuted, fontSize: 11),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // Submit Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : () => _submitLeave(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                disabledBackgroundColor: kMuted,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.send_rounded, color: Colors.white, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Submit Leave Request',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _typeButton(String value, String label) {
    final selected = _leaveType == value;
    return GestureDetector(
      onTap: () => setState(() => _leaveType = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? kPrimary : kSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? kPrimary : kBorder, width: selected ? 0 : 1),
          boxShadow: selected
              ? [BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 3))]
              : [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)],
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: selected ? Colors.white : kTextSub,
            ),
          ),
        ),
      ),
    );
  }

  Widget _shiftButton(String value, String label) {
    final selected = _halfDayShift == value;
    return GestureDetector(
      onTap: () => setState(() => _halfDayShift = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? kPrimary : kSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? kPrimary : kBorder, width: selected ? 0 : 1),
          boxShadow: selected
              ? [BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 3))]
              : [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)],
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: selected ? Colors.white : kTextSub,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryTab(List<Map<String, dynamic>> requests, bool isLoading) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }
    if (requests.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.beach_access_rounded, size: 64, color: kMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 16),
            const Text(
              'No leave requests yet',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kTextSub),
            ),
            const SizedBox(height: 6),
            const Text(
              'Your submitted requests will appear here',
              style: TextStyle(fontSize: 13, color: kMuted),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<ProfileBloc>().add(FetchLeaveRequestsEvent());
      },
      color: kPrimary,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: requests.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final req = requests[index];
          return _buildLeaveCard(context, req);
        },
      ),
    );
  }

  Widget _buildLeaveCard(BuildContext context, Map<String, dynamic> req) {
    final status = req['status'] as String? ?? 'pending';
    final leaveDate = req['leave_date']?.toString() ?? '';
    final endDate = req['end_date']?.toString() ?? leaveDate;
    final leaveType = req['leave_type']?.toString() ?? 'full_day';
    final halfDayShift = req['half_day_shift']?.toString();
    final reason = req['reason']?.toString();
    final adminRemarks = req['admin_remarks']?.toString();
    final id = req['id']?.toString() ?? '';

    // Format date
    String formattedDate = leaveDate;
    try {
      final parsedStart = DateTime.parse(leaveDate);
      if (endDate.isNotEmpty && endDate != leaveDate) {
        final parsedEnd = DateTime.parse(endDate);
        formattedDate = '${_fmtShort(parsedStart)} - ${_fmtShort(parsedEnd)}';
      } else {
        formattedDate = _fmtLong(parsedStart);
      }
    } catch (_) {}

    final (statusColor, statusBg, statusIcon, statusLabel) = switch (status) {
      'approved' => (kSuccess, const Color(0xFFE8F5E9), '✅', 'APPROVED'),
      'rejected' => (kDanger, const Color(0xFFFEE2E2), '❌', 'REJECTED'),
      'cancelled' => (kMuted, const Color(0xFFF5F5F5), '🚫', 'CANCELLED'),
      _ => (kAccent, const Color(0xFFFFF8E1), '⏳', 'PENDING'),
    };

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: kBgDeep,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_month_rounded, size: 16, color: kTextSub),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    formattedDate,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: kText,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    '$statusIcon $statusLabel',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: statusColor),
                  ),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      leaveType == 'half_day' ? Icons.wb_twilight_rounded : Icons.wb_sunny_rounded,
                      size: 14,
                      color: kAccent,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      leaveType == 'half_day'
                          ? 'Half Day${halfDayShift != null ? ' (${halfDayShift == 'morning' ? 'Morning Shift' : 'Evening Shift'})' : ''}'
                          : 'Full Day',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kTextSub),
                    ),
                  ],
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.comment_rounded, size: 13, color: kMuted),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          reason,
                          style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ],
                if (adminRemarks != null && adminRemarks.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: kBgDeep,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.admin_panel_settings_rounded, size: 13, color: kPrimaryMid),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Admin: $adminRemarks',
                            style: const TextStyle(fontSize: 11, color: kPrimaryMid, fontWeight: FontWeight.w600, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (status == 'pending') ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 38,
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmCancel(context, id),
                      icon: const Icon(Icons.cancel_outlined, size: 15, color: kRed),
                      label: const Text('Cancel Request', style: TextStyle(fontSize: 12, color: kRed, fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: kRed, width: 1),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _confirmCancel(BuildContext context, String id) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Cancel Request?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text(
          'Are you sure you want to cancel this leave request?',
          style: TextStyle(fontSize: 14, color: kTextSub),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('No', style: TextStyle(color: kTextSub)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<ProfileBloc>().add(CancelLeaveRequestEvent(id));
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: kRed,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
