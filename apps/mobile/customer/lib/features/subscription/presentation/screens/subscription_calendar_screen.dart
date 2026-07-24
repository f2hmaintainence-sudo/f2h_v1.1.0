import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

class SubscriptionCalendarScreen extends StatefulWidget {
  final Subscription subscription;

  const SubscriptionCalendarScreen({super.key, required this.subscription});

  @override
  State<SubscriptionCalendarScreen> createState() => _SubscriptionCalendarScreenState();
}

class _SubscriptionCalendarScreenState extends State<SubscriptionCalendarScreen> {
  late DateTime _focusedMonth;
  late DateTime _selectedDate;
  // Map<dateStr, calendarEntry>
  Map<String, Map<String, dynamic>> _apiCalendar = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _focusedMonth = DateTime.now();
    _selectedDate = DateTime.now();
    _fetchCalendarData();
  }

  Future<void> _fetchCalendarData() async {
    setState(() => _isLoading = true);
    try {
      final data = await sl<SubscriptionRepository>().getSubscriptionCalendar(widget.subscription.id);
      setState(() {
        _apiCalendar = {
          for (var item in data)
            if (item is Map && item['date'] != null)
              item['date'].toString(): Map<String, dynamic>.from(item)
        };

        if (_apiCalendar.isNotEmpty) {
          final sortedDates = _apiCalendar.keys.toList()..sort();
          try {
            final firstDate = DateTime.parse(sortedDates.first);
            _selectedDate = firstDate;
            _focusedMonth = DateTime(firstDate.year, firstDate.month);
          } catch (_) {}
        }
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _dateKey(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  DateTime? _parseDateStr(String? dateStr) {
    if (dateStr == null || dateStr.trim().isEmpty) return null;
    final text = dateStr.trim();
    try {
      final parsed = DateTime.parse(text);
      return DateTime(parsed.year, parsed.month, parsed.day);
    } catch (_) {
      try {
        final parts = text.split(' ');
        if (parts.length == 3) {
          final day = int.tryParse(parts[0]);
          final year = int.tryParse(parts[2]);
          const months = [
            'jan', 'feb', 'mar', 'apr', 'may', 'jun',
            'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
          ];
          final mIndex = months.indexOf(parts[1].toLowerCase().substring(0, 3));
          if (day != null && year != null && mIndex != -1) {
            return DateTime(year, mIndex + 1, day);
          }
        }
      } catch (_) {}
    }
    return null;
  }

  bool _isScheduledDay(DateTime date) {
    if (widget.subscription.status == 'cancelled' ||
        widget.subscription.status == 'expaired' ||
        widget.subscription.status == 'expired') {
      return false;
    }

    final d = DateTime(date.year, date.month, date.day);

    // 1. Start date check (cannot schedule before subscription start date)
    final startDate = _parseDateStr(widget.subscription.startDate);
    if (startDate != null && d.isBefore(startDate)) {
      return false;
    }

    // 2. End date check (cannot schedule after subscription end date)
    final endDate = _parseDateStr(widget.subscription.endDate);
    if (endDate != null && d.isAfter(endDate)) {
      return false;
    }

    // 3. If API has returned data for this date, trust the API
    final key = _dateKey(date);
    if (_apiCalendar.isNotEmpty && _apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final mq = double.tryParse(item['m_quantity']?.toString() ?? '0') ?? 0;
      final eq = double.tryParse(item['e_quantity']?.toString() ?? '0') ?? 0;
      final apiStatus = item['status']?.toString() ?? '';
      if (mq > 0 || eq > 0) return true;
      if (apiStatus == 'skipped' || apiStatus == 'cancelled') return true;
      return false;
    }

    // 4. Fallback: Day-of-week schedule check using client-side data
    final dayQtys = widget.subscription.getSelectedDayQuantities();
    if (dayQtys.isEmpty) return true; // Default everyday

    // Flutter DateTime.weekday: 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun
    const weekdayMap = {
      1: ['Mon', 'Monday', 'Everyday', 'Daily'],
      2: ['Tue', 'Tuesday', 'Everyday', 'Daily'],
      3: ['Wed', 'Wednesday', 'Everyday', 'Daily'],
      4: ['Thu', 'Thursday', 'Everyday', 'Daily'],
      5: ['Fri', 'Friday', 'Everyday', 'Daily'],
      6: ['Sat', 'Saturday', 'Everyday', 'Daily'],
      7: ['Sun', 'Sunday', 'Everyday', 'Daily'],
    };

    final validNames = weekdayMap[date.weekday] ?? [];
    return dayQtys.any((dq) =>
        validNames.any((vn) => dq.dayName.toLowerCase().contains(vn.toLowerCase())));
  }

  /// Returns the delivery status for a date: 'completed', 'today', 'upcoming', 'skipped', 'cancelled', or 'no_delivery'
  String _deliveryStatus(DateTime date) {
    final key = _dateKey(date);
    final d = DateTime(date.year, date.month, date.day);
    final today = DateTime.now();
    final t = DateTime(today.year, today.month, today.day);

    // Priority 1: Check start/end date bounds
    final startDate = _parseDateStr(widget.subscription.startDate);
    if (startDate != null && d.isBefore(startDate)) return 'no_delivery';
    final endDate = _parseDateStr(widget.subscription.endDate);
    if (endDate != null && d.isAfter(endDate)) return 'no_delivery';

    if (widget.subscription.status == 'cancelled' ||
        widget.subscription.status == 'expaired' ||
        widget.subscription.status == 'expired') {
      return 'no_delivery';
    }

    // Priority 2: API data
    if (_apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final apiStatus = item['status']?.toString() ?? '';
      if (apiStatus.isNotEmpty && apiStatus != 'no_delivery') return apiStatus;

      final mq = double.tryParse(item['m_quantity']?.toString() ?? '0') ?? 0;
      final eq = double.tryParse(item['e_quantity']?.toString() ?? '0') ?? 0;
      if (mq > 0 || eq > 0) {
        if (d.isBefore(t)) return 'completed';
        if (d == t) return 'today';
        return 'upcoming';
      }
      // API explicitly says no delivery
      return 'no_delivery';
    }

    // Priority 3: Client-side fallback using schedule
    if (!_isScheduledDay(date)) return 'no_delivery';

    if (d.isBefore(t)) return 'completed';
    if (d == t) return 'today';
    return 'upcoming';
  }

  bool _hasDelivery(DateTime date) {
    final key = _dateKey(date);
    if (_apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final mq = double.tryParse(item['m_quantity']?.toString() ?? '0') ?? 0;
      final eq = double.tryParse(item['e_quantity']?.toString() ?? '0') ?? 0;
      if (mq > 0 || eq > 0) return true;
    }
    return _isScheduledDay(date);
  }

  String _getDeliveryQtyText(DateTime date) {
    if (!_isScheduledDay(date)) return '';
    final key = _dateKey(date);
    if (_apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final double mq = double.tryParse(item['m_quantity']?.toString() ?? '0') ?? 0;
      final double eq = double.tryParse(item['e_quantity']?.toString() ?? '0') ?? 0;
      if (mq > 0 && eq > 0) return '${mq.toInt()} Morn + ${eq.toInt()} Eve';
      if (mq > 0) return '${mq.toInt()} Morning';
      if (eq > 0) return '${eq.toInt()} Evening';
    }
    if (_isScheduledDay(date)) {
      final qty = widget.subscription.qty > 0 ? widget.subscription.qty : 1;
      return '$qty Morning';
    }
    return '';
  }

  List<DateTime> _generateCalendarDates(DateTime month) {
    final firstDayOfMonth = DateTime(month.year, month.month, 1);
    int startWeekday = firstDayOfMonth.weekday;
    if (startWeekday == 7) startWeekday = 0;
    return List.generate(42, (index) => DateTime(month.year, month.month, 1 - startWeekday + index));
  }

  void _previousMonth() => setState(() {
        _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
      });

  void _nextMonth() => setState(() {
        _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
      });

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[month - 1];
  }

  String _getWeekDayName(int weekday) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[weekday];
  }

  // ─── Status helpers ─────────────────────────────────────────────────────────

  Color _statusBg(String status, bool isSelected) {
    switch (status) {
      case 'completed': return const Color(0xFFDCFCE7);
      case 'today':     return const Color(0xFFDBEAFE);
      case 'upcoming':  return kPrimaryPl;
      case 'skipped':   return const Color(0xFFFFF7ED);
      case 'cancelled': return const Color(0xFFFEE2E2);
      default:          return kSurface;
    }
  }

  Color _statusTextColor(String status) {
    switch (status) {
      case 'completed': return const Color(0xFF16A34A);
      case 'today':     return const Color(0xFF2563EB);
      case 'upcoming':  return kPrimary;
      case 'skipped':   return const Color(0xFFD97706);
      case 'cancelled': return kRed;
      default:          return kText;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'completed': return Icons.check_circle_rounded;
      case 'today':     return Icons.local_shipping_rounded;
      case 'upcoming':  return Icons.schedule_rounded;
      case 'skipped':   return Icons.block_rounded;
      case 'cancelled': return Icons.cancel_rounded;
      default:          return Icons.event_busy_rounded;
    }
  }

  String _statusLabel(String status, DateTime date) {
    switch (status) {
      case 'completed': return 'Delivered successfully';
      case 'today':     return 'Delivery scheduled for today';
      case 'upcoming':  return 'Upcoming delivery';
      case 'skipped':   return 'Delivery was skipped';
      case 'cancelled': return 'Delivery cancelled';
      default:          return 'No delivery scheduled';
    }
  }

  @override
  Widget build(BuildContext context) {
    final dates = _generateCalendarDates(_focusedMonth);
    final selectedKey = _dateKey(_selectedDate);
    final selectedStatus = _deliveryStatus(_selectedDate);
    final hasDel = _hasDelivery(_selectedDate);

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Container(
            decoration: BoxDecoration(
              color: kSurface,
              shape: BoxShape.circle,
              border: Border.all(color: kBorder),
            ),
            child: IconButton(
              icon: const Icon(Icons.arrow_back, color: kText, size: 18),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
        title: const Text(
          'Delivery Calendar',
          style: TextStyle(color: kText, fontWeight: FontWeight.w900, fontSize: 18),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: kTextMid),
            onPressed: _fetchCalendarData,
          ),
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(kPrimary)))
            : Column(
                children: [
                  // 1. Product info header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    child: Container(
                      padding: const EdgeInsets.all(14.0),
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: kBorder),
                        boxShadow: [
                          BoxShadow(
                            color: kText.withValues(alpha: 0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: kPrimaryPl,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(11),
                              child: buildProductImage(
                                widget.subscription.productName,
                                imageAsset: widget.subscription.imageUrl,
                                fit: BoxFit.cover,
                                fallbackColor: kPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _prettifyName(widget.subscription.productName),
                                  style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w800,
                                    color: kText, letterSpacing: -0.1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Builder(builder: (_) {
                            final dayQtys = widget.subscription.getSelectedDayQuantities();
                            final scheduleLabel = dayQtys.isEmpty
                                ? 'Daily'
                                : dayQtys.length == 7
                                    ? 'Everyday'
                                    : '${dayQtys.length} days/week';
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: kPrimary.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                scheduleLabel,
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kPrimary),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),

                  // 2. Calendar
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      child: Column(
                        children: [
                          // Calendar card
                          Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: kBorder),
                            ),
                            child: Column(
                              children: [
                                // Month nav
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.chevron_left, color: kTextMid),
                                      onPressed: _previousMonth,
                                    ),
                                    Text(
                                      '${_getMonthName(_focusedMonth.month)} ${_focusedMonth.year}',
                                      style: const TextStyle(
                                        fontSize: 15, fontWeight: FontWeight.w900, color: kText,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.chevron_right, color: kTextMid),
                                      onPressed: _nextMonth,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                // Weekday header
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: List.generate(7, (i) {
                                    return SizedBox(
                                      width: 38,
                                      child: Center(
                                        child: Text(
                                          _getWeekDayName(i),
                                          style: const TextStyle(
                                            fontSize: 11, fontWeight: FontWeight.w800, color: kTextSub,
                                          ),
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                                const SizedBox(height: 8),
                                // Calendar grid
                                GridView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 7,
                                    mainAxisSpacing: 5,
                                    crossAxisSpacing: 5,
                                    childAspectRatio: 0.68,
                                  ),
                                  itemCount: 42,
                                  itemBuilder: (context, index) {
                                    final date = dates[index];
                                    final isCurrentMonth = date.month == _focusedMonth.month;
                                    final isSelected = date.year == _selectedDate.year &&
                                        date.month == _selectedDate.month &&
                                        date.day == _selectedDate.day;
                                    final key = _dateKey(date);
                                    final dateFromBackend = _apiCalendar.containsKey(key);
                                    final status = _deliveryStatus(date);
                                    final isToday = date.day == DateTime.now().day &&
                                        date.month == DateTime.now().month &&
                                        date.year == DateTime.now().year;

                                    double mQty = 0, eQty = 0;
                                    if (_isScheduledDay(date)) {
                                      if (dateFromBackend) {
                                        final item = _apiCalendar[key]!;
                                        mQty = double.tryParse(item['m_quantity']?.toString() ?? '0') ?? 0;
                                        eQty = double.tryParse(item['e_quantity']?.toString() ?? '0') ?? 0;
                                      } else {
                                        mQty = (widget.subscription.qty > 0 ? widget.subscription.qty : 1).toDouble();
                                      }
                                    }

                                    Color textCol = kText;
                                    Color bgCol = Colors.transparent;
                                    Border? border;

                                    if (!isCurrentMonth) {
                                      textCol = kMuted.withValues(alpha: 0.3);
                                      bgCol = kBgDeep.withValues(alpha: 0.2);
                                    } else {
                                      bgCol = _statusBg(status, isSelected);
                                      textCol = _statusTextColor(status);

                                      if (status == 'no_delivery') {
                                        textCol = kTextSub;
                                        bgCol = kSurface;
                                      }

                                      if (isSelected) {
                                        border = Border.all(color: _statusTextColor(status), width: 2);
                                      } else if (isToday) {
                                        border = Border.all(color: kPrimary.withValues(alpha: 0.4), width: 1.5);
                                      } else {
                                        border = Border.all(color: kBorder.withValues(alpha: 0.5));
                                      }
                                    }

                                    return GestureDetector(
                                      onTap: () {
                                        setState(() {
                                          _selectedDate = date;
                                          if (date.month != _focusedMonth.month) {
                                            _focusedMonth = DateTime(date.year, date.month);
                                          }
                                        });
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.all(4.0),
                                        decoration: BoxDecoration(
                                          color: bgCol,
                                          borderRadius: BorderRadius.circular(8),
                                          border: border,
                                        ),
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          crossAxisAlignment: CrossAxisAlignment.stretch,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: FittedBox(
                                                    alignment: Alignment.centerLeft,
                                                    fit: BoxFit.scaleDown,
                                                    child: Text(
                                                      date.day.toString(),
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight: isSelected || status != 'no_delivery'
                                                            ? FontWeight.w900
                                                            : FontWeight.w600,
                                                        color: textCol,
                                                        decoration: status == 'cancelled'
                                                            ? TextDecoration.lineThrough
                                                            : null,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                if (isCurrentMonth && status == 'completed')
                                                  const Icon(Icons.check_rounded, size: 8, color: Color(0xFF16A34A)),
                                              ],
                                            ),
                                            if (isCurrentMonth && (mQty > 0 || eQty > 0)) ...[
                                              Column(
                                                mainAxisSize: MainAxisSize.min,
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  if (mQty > 0)
                                                    FittedBox(
                                                      fit: BoxFit.scaleDown,
                                                      alignment: Alignment.centerLeft,
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Container(
                                                            width: 4, height: 4,
                                                            decoration: BoxDecoration(
                                                              color: _statusTextColor(status),
                                                              shape: BoxShape.circle,
                                                            ),
                                                          ),
                                                          const SizedBox(width: 2),
                                                          Text(
                                                            '${mQty.toInt()}M',
                                                            style: TextStyle(
                                                              fontSize: 8, fontWeight: FontWeight.w900,
                                                              color: _statusTextColor(status),
                                                              decoration: status == 'cancelled' || status == 'skipped'
                                                                  ? TextDecoration.lineThrough
                                                                  : null,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  if (mQty > 0 && eQty > 0) const SizedBox(height: 1),
                                                  if (eQty > 0)
                                                    FittedBox(
                                                      fit: BoxFit.scaleDown,
                                                      alignment: Alignment.centerLeft,
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Container(
                                                            width: 4, height: 4,
                                                            decoration: BoxDecoration(
                                                              color: _statusTextColor(status).withValues(alpha: 0.7),
                                                              shape: BoxShape.circle,
                                                            ),
                                                          ),
                                                          const SizedBox(width: 2),
                                                          Text(
                                                            '${eQty.toInt()}E',
                                                            style: TextStyle(
                                                              fontSize: 8, fontWeight: FontWeight.w900,
                                                              color: _statusTextColor(status).withValues(alpha: 0.7),
                                                              decoration: status == 'cancelled' || status == 'skipped'
                                                                  ? TextDecoration.lineThrough
                                                                  : null,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ] else ...[
                                              const SizedBox(height: 8),
                                            ],
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(height: 12),
                                // Color legend
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 6,
                                  children: [
                                    _LegendDot(color: const Color(0xFF16A34A), label: 'Delivered'),
                                    _LegendDot(color: const Color(0xFF2563EB), label: 'Today'),
                                    _LegendDot(color: kPrimary, label: 'Upcoming'),
                                    _LegendDot(color: const Color(0xFFD97706), label: 'Skipped'),
                                    _LegendDot(color: kRed, label: 'Cancelled'),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 3. Selected date status card
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(18.0),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(color: kBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: _statusTextColor(selectedStatus).withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                        _statusIcon(selectedStatus),
                                        color: _statusTextColor(selectedStatus),
                                        size: 18,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${_selectedDate.day} ${_getMonthName(_selectedDate.month)} ${_selectedDate.year}',
                                            style: const TextStyle(
                                              fontSize: 14, fontWeight: FontWeight.w900, color: kText,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _statusLabel(selectedStatus, _selectedDate),
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: _statusTextColor(selectedStatus),
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    // Status badge
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: _statusTextColor(selectedStatus).withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        selectedStatus == 'no_delivery' ? 'No Delivery' : selectedStatus.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 9, fontWeight: FontWeight.w900,
                                          color: _statusTextColor(selectedStatus),
                                          letterSpacing: 0.3,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (hasDel) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: kBgDeep.withValues(alpha: 0.5),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(Icons.local_shipping_outlined, size: 14,
                                            color: _statusTextColor(selectedStatus)),
                                        const SizedBox(width: 8),
                                        Text(
                                          'Qty: ${_getDeliveryQtyText(_selectedDate)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: _statusTextColor(selectedStatus),
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                if (!hasDel && _apiCalendar.containsKey(selectedKey)) ...[
                                  const SizedBox(height: 10),
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: kBgDeep.withValues(alpha: 0.5),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Row(
                                      children: [
                                        Icon(Icons.info_outline_rounded, size: 14, color: kTextSub),
                                        SizedBox(width: 8),
                                        Text(
                                          'No delivery quantity set for this day.',
                                          style: TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w600),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8, height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: kTextSub)),
      ],
    );
  }
}

String _prettifyName(String name) {
  return name
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) {
        if (word.isEmpty) return '';
        return word[0].toUpperCase() + word.substring(1);
      })
      .join(' ');
}
