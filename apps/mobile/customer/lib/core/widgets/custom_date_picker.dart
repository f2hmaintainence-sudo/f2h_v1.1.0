import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';

class CustomDatePickerDialog extends StatefulWidget {
  final DateTime initialDate;
  final DateTime firstDate;
  final DateTime lastDate;
  final String title;
  final bool highlightMonthEnd;
  final bool showSlots;
  final String? initialSlot;
  final Map<String, dynamic>? slotTimings;
  final List<DateTime>? existingDates;
  final bool allowMultiple;

  const CustomDatePickerDialog({
    super.key,
    required this.initialDate,
    required this.firstDate,
    required this.lastDate,
    required this.title,
    this.highlightMonthEnd = false,
    this.showSlots = false,
    this.initialSlot,
    this.slotTimings,
    this.existingDates,
    this.allowMultiple = false,
  });

  @override
  State<CustomDatePickerDialog> createState() => _CustomDatePickerDialogState();
}

class _CustomDatePickerDialogState extends State<CustomDatePickerDialog> {
  late DateTime _selectedDate;
  late DateTime _currentMonth;
  late String _selectedSlot;
  final Set<String> _existingDateKeys = {};
  final Set<DateTime> _selectedDates = {};
  String? _statusMessage;

  final List<String> _weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  final List<String> _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  @override
  void initState() {
    super.initState();

    // Populate existing scheduled date keys
    if (widget.existingDates != null) {
      for (final d in widget.existingDates!) {
        _existingDateKeys.add('${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
      }
    }

    // Normalize date to remove time component
    var candidate = DateTime(widget.initialDate.year, widget.initialDate.month, widget.initialDate.day);
    final firstNormalized = DateTime(widget.firstDate.year, widget.firstDate.month, widget.firstDate.day);
    final lastNormalized = DateTime(widget.lastDate.year, widget.lastDate.month, widget.lastDate.day);

    if (candidate.isBefore(firstNormalized)) {
      candidate = firstNormalized;
    } else if (candidate.isAfter(lastNormalized)) {
      candidate = firstNormalized;
    }

    // If initialDate is already in existingDates, find the first available future date that is not added
    final initKey = '${candidate.year}-${candidate.month.toString().padLeft(2, '0')}-${candidate.day.toString().padLeft(2, '0')}';
    if (_existingDateKeys.contains(initKey)) {
      var testDate = DateTime(candidate.year, candidate.month, candidate.day);
      bool found = false;
      while (!testDate.isAfter(lastNormalized)) {
        final key = '${testDate.year}-${testDate.month.toString().padLeft(2, '0')}-${testDate.day.toString().padLeft(2, '0')}';
        if (!_existingDateKeys.contains(key)) {
          candidate = testDate;
          found = true;
          break;
        }
        testDate = testDate.add(const Duration(days: 1));
      }
      if (!found) {
        testDate = DateTime(firstNormalized.year, firstNormalized.month, firstNormalized.day);
        while (testDate.isBefore(candidate)) {
          final key = '${testDate.year}-${testDate.month.toString().padLeft(2, '0')}-${testDate.day.toString().padLeft(2, '0')}';
          if (!_existingDateKeys.contains(key)) {
            candidate = testDate;
            found = true;
            break;
          }
          testDate = testDate.add(const Duration(days: 1));
        }
      }
    }

    _selectedDate = candidate;
    _currentMonth = DateTime(_selectedDate.year, _selectedDate.month);
    _selectedSlot = widget.initialSlot ?? 'Morning';

    final selKey = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
    if (!_existingDateKeys.contains(selKey)) {
      _selectedDates.add(_selectedDate);
    }

    if (widget.showSlots) {
      final now = DateTime.now();
      var available = getAvailableSlots(_selectedDate, now, widget.slotTimings);
      if (available.isEmpty) {
        // If selected date has no available slots (e.g. today after evening cutoff), move to first allowed date
        _selectedDate = DateTime(widget.firstDate.year, widget.firstDate.month, widget.firstDate.day);
        _currentMonth = DateTime(_selectedDate.year, _selectedDate.month);
        available = getAvailableSlots(_selectedDate, now, widget.slotTimings);
      }
      if (!available.contains(_selectedSlot)) {
        _selectedSlot = getDefaultSlot(_selectedDate, now, widget.slotTimings);
      }
    }
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
  }

  bool get _canGoNext {
    final nextMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    final limitMonth = DateTime(widget.lastDate.year, widget.lastDate.month);
    return nextMonth.isBefore(limitMonth) || nextMonth.isAtSameMomentAs(limitMonth);
  }

  bool get _canGoPrev {
    final prevMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    final startMonth = DateTime(widget.firstDate.year, widget.firstDate.month);
    return prevMonth.isAfter(startMonth) || prevMonth.isAtSameMomentAs(startMonth);
  }

  int _daysInMonth(DateTime date) {
    return DateTime(date.year, date.month + 1, 0).day;
  }

  Widget _buildSlotButton({
    required String title,
    required IconData icon,
    required Color iconColorInactive,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFC107) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFFFFB300) : kBorderLt,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : iconColorInactive,
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isSelected ? Colors.white : kText,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.check_circle,
                size: 14,
                color: Colors.white,
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 1st of current month
    final firstOfMonth = DateTime(_currentMonth.year, _currentMonth.month, 1);
    // Weekday of 1st day (Monday = 1, Sunday = 7)
    final weekdayOfFirst = firstOfMonth.weekday;
    // Prefix count: Sun = index 0 in our S M T W T F S header.
    // If weekday is Sunday (7), prefix offset is 0. If Monday (1), prefix is 1, etc.
    final prefixOffset = weekdayOfFirst == 7 ? 0 : weekdayOfFirst;

    final daysInCurrent = _daysInMonth(_currentMonth);

    // Get previous month days
    final prevMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    final daysInPrev = _daysInMonth(prevMonth);

    final List<Map<String, dynamic>> gridItems = [];

    // 1. Padding days from previous month
    for (int i = prefixOffset - 1; i >= 0; i--) {
      final date = DateTime(prevMonth.year, prevMonth.month, daysInPrev - i);
      gridItems.add({
        'date': date,
        'isCurrentMonth': false,
        'isEnabled': false,
      });
    }

    // 2. Days of current month
    final firstAvailableNormalized = DateTime(widget.firstDate.year, widget.firstDate.month, widget.firstDate.day);
    final lastAvailableNormalized = DateTime(widget.lastDate.year, widget.lastDate.month, widget.lastDate.day);

    for (int i = 1; i <= daysInCurrent; i++) {
      final date = DateTime(_currentMonth.year, _currentMonth.month, i);
      final dateOnly = DateTime(date.year, date.month, date.day);
      final isWithinRange = (dateOnly.isAfter(firstAvailableNormalized) || dateOnly.isAtSameMomentAs(firstAvailableNormalized)) &&
          (dateOnly.isBefore(lastAvailableNormalized) || dateOnly.isAtSameMomentAs(lastAvailableNormalized));
      final hasSlots = !widget.showSlots || getAvailableSlots(dateOnly, DateTime.now(), widget.slotTimings).isNotEmpty;
      final isEnabled = isWithinRange && hasSlots;

      gridItems.add({
        'date': date,
        'isCurrentMonth': true,
        'isEnabled': isEnabled,
      });
    }

    // 3. Suffix days from next month to fill grid row multiplier
    final nextMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    final totalSlots = (prefixOffset + daysInCurrent) <= 35 ? 35 : 42;
    final suffixCount = totalSlots - gridItems.length;

    for (int i = 1; i <= suffixCount; i++) {
      final date = DateTime(nextMonth.year, nextMonth.month, i);
      gridItems.add({
        'date': date,
        'isCurrentMonth': false,
        'isEnabled': false,
      });
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Title on top, Month selector below it
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                  ),
                  if (widget.allowMultiple && _selectedDates.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: kPrimary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${_selectedDates.length} selected',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: kPrimary,
                        ),
                      ),
                    ),
                ],
              ),
              if (_statusMessage != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFD97706)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_months[_currentMonth.month - 1]} ${_currentMonth.year}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: kPrimary,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_canGoPrev)
                        GestureDetector(
                          onTap: _prevMonth,
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Icon(Icons.chevron_left_rounded, size: 24, color: kPrimary),
                          ),
                        ),
                      if (_canGoNext)
                        GestureDetector(
                          onTap: _nextMonth,
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Icon(Icons.chevron_right_rounded, size: 24, color: kPrimary),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Weekday Labels Row (S M T W T F S)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: _weekdays.map((day) {
              return Expanded(
                child: Center(
                  child: Text(
                    day,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),

          // Days Grid View
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: gridItems.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 1.0,
            ),
            itemBuilder: (context, index) {
              final item = gridItems[index];
              final DateTime date = item['date'];
              final bool isCurrentMonth = item['isCurrentMonth'];
              final bool isEnabled = item['isEnabled'];
              final String dateKey = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
              final bool isAlreadyAdded = _existingDateKeys.contains(dateKey);
              final bool isSelected = widget.allowMultiple
                  ? _selectedDates.any((d) => d.year == date.year && d.month == date.month && d.day == date.day)
                  : (_selectedDate.year == date.year && _selectedDate.month == date.month && _selectedDate.day == date.day);
              
              final bool isInRange = widget.highlightMonthEnd &&
                  date.year == _selectedDate.year &&
                  date.month == _selectedDate.month &&
                  date.day >= _selectedDate.day &&
                  isCurrentMonth &&
                  isEnabled;

              if (!isCurrentMonth || !isEnabled) {
                // Inactive day / Disabled / Padding day
                return Center(
                  child: Text(
                    date.day.toString().padLeft(2, '0'),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFFD1D5DB), // Light grey text
                    ),
                  ),
                );
              }

              // ── Already in Schedule (e.g. 26 and 27) ──
              if (isAlreadyAdded) {
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _statusMessage = '${date.day} ${_months[date.month - 1]} is already in your schedule';
                    });
                    ScaffoldMessenger.of(context).hideCurrentSnackBar();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${date.day} ${_months[date.month - 1]} is already in your schedule'),
                        duration: const Duration(seconds: 2),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.6),
                        width: 1.2,
                      ),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              date.day.toString().padLeft(2, '0'),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF15803D),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Container(
                              width: 4,
                              height: 4,
                              decoration: const BoxDecoration(
                                color: Color(0xFF16A34A),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                        const Positioned(
                          top: 4,
                          right: 4,
                          child: Icon(
                            Icons.check_rounded,
                            size: 11,
                            color: Color(0xFF15803D),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              // Active, enabled day (not already added)
              return GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    _statusMessage = null;
                    if (widget.allowMultiple) {
                      final match = _selectedDates.firstWhere(
                        (d) => d.year == date.year && d.month == date.month && d.day == date.day,
                        orElse: () => DateTime(0),
                      );
                      if (match.year != 0) {
                        if (_selectedDates.length > 1) {
                          _selectedDates.remove(match);
                        }
                      } else {
                        _selectedDates.add(date);
                        _selectedDate = date;
                      }
                    } else {
                      _selectedDate = date;
                    }

                    if (widget.showSlots) {
                      final available = getAvailableSlots(date, DateTime.now(), widget.slotTimings);
                      if (!available.contains(_selectedSlot)) {
                        _selectedSlot = getDefaultSlot(date, DateTime.now(), widget.slotTimings);
                      }
                    }
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    color: isSelected 
                        ? kPrimary 
                        : (isInRange ? kPrimaryPl : Colors.white),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: isSelected || isInRange
                        ? []
                        : [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                    border: Border.all(
                      color: isSelected 
                          ? Colors.transparent 
                          : (isInRange ? kPrimary.withValues(alpha: 0.2) : const Color(0xFFF1F5F9)),
                      width: 1,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      date.day.toString().padLeft(2, '0'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected || isInRange ? FontWeight.w900 : FontWeight.w700,
                        color: isSelected 
                            ? Colors.white 
                            : (isInRange ? kPrimary : const Color(0xFF1D252C)),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          if (_existingDateKeys.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFF16A34A), width: 1.2),
                  ),
                  child: const Icon(Icons.check_rounded, size: 9, color: Color(0xFF15803D)),
                ),
                const SizedBox(width: 5),
                const Text(
                  'In Schedule',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF15803D),
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: kPrimary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  widget.allowMultiple && _selectedDates.length > 1
                      ? 'Selected (${_selectedDates.length})'
                      : 'Selected Date',
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: kText,
                  ),
                ),
              ],
            ),
          ],
          if (widget.showSlots) ...[
            const SizedBox(height: 16),
            const Text(
              'DELIVERY SLOT',
              style: TextStyle(
                 fontSize: 10,
                fontWeight: FontWeight.w900,
                color: kTextSub,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final now = DateTime.now();
                final availableSlots = getAvailableSlots(_selectedDate, now, widget.slotTimings);
                return Row(
                  children: [
                    if (availableSlots.contains('Morning')) ...[
                      Expanded(
                        child: _buildSlotButton(
                          title: 'Morning',
                          icon: Icons.wb_sunny_rounded,
                          iconColorInactive: Colors.orange.shade300,
                          isSelected: _selectedSlot == 'Morning',
                          onTap: () => setState(() => _selectedSlot = 'Morning'),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    if (availableSlots.contains('Evening'))
                      Expanded(
                        child: _buildSlotButton(
                          title: 'Evening',
                          icon: Icons.nightlight_round,
                          iconColorInactive: Colors.blueGrey.shade100,
                          isSelected: _selectedSlot == 'Evening',
                          onTap: () => setState(() => _selectedSlot = 'Evening'),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
          const SizedBox(height: 20),

          // Done Button
          Center(
            child: SizedBox(
              width: widget.allowMultiple ? 180 : 130,
              height: 44,
              child: ElevatedButton(
                onPressed: (widget.allowMultiple && _selectedDates.isEmpty)
                    ? null
                    : () {
                        if (widget.allowMultiple) {
                          final sorted = _selectedDates.toList()..sort();
                          Navigator.pop(
                            context,
                            sorted.isNotEmpty ? sorted : [_selectedDate],
                          );
                        } else if (widget.showSlots) {
                          Navigator.pop(
                            context,
                            DateSlotResult(date: _selectedDate, slot: _selectedSlot),
                          );
                        } else {
                          Navigator.pop(context, _selectedDate);
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  disabledForegroundColor: Colors.grey.shade600,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  widget.allowMultiple
                      ? (_selectedDates.length > 1
                          ? 'Add ${_selectedDates.length} Dates'
                          : (_selectedDates.length == 1 ? 'Add 1 Date' : 'Select Date'))
                      : 'Done',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.1,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<dynamic> showCustomDatePicker({
  required BuildContext context,
  required DateTime initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
  String title = 'Start Date',
  bool highlightMonthEnd = false,
  List<DateTime>? existingDates,
  bool allowMultiple = false,
}) {
  return showDialog<dynamic>(
    context: context,
    barrierDismissible: true,
    builder: (context) {
      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        elevation: 12,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        child: CustomDatePickerDialog(
          initialDate: initialDate,
          firstDate: firstDate,
          lastDate: lastDate,
          title: title,
          highlightMonthEnd: highlightMonthEnd,
          existingDates: existingDates,
          allowMultiple: allowMultiple,
        ),
      );
    },
  );
}

class DateSlotResult {
  final DateTime date;
  final String slot;

  DateSlotResult({required this.date, required this.slot});
}

Future<DateSlotResult?> showCustomDateAndSlotPicker({
  required BuildContext context,
  required DateTime initialDate,
  required String initialSlot,
  required DateTime firstDate,
  required DateTime lastDate,
  String title = 'Select Delivery Date',
  Map<String, dynamic>? slotTimings,
}) {
  return showDialog<DateSlotResult>(
    context: context,
    barrierDismissible: true,
    builder: (context) {
      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        elevation: 12,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        child: CustomDatePickerDialog(
          initialDate: initialDate,
          firstDate: firstDate,
          lastDate: lastDate,
          title: title,
          showSlots: true,
          initialSlot: initialSlot,
          slotTimings: slotTimings,
        ),
      );
    },
  );
}


class CustomDateRangePickerDialog extends StatefulWidget {
  final DateTime firstDate;
  final DateTime lastDate;
  final String title;

  const CustomDateRangePickerDialog({
    super.key,
    required this.firstDate,
    required this.lastDate,
    required this.title,
  });

  @override
  State<CustomDateRangePickerDialog> createState() => _CustomDateRangePickerDialogState();
}

class _CustomDateRangePickerDialogState extends State<CustomDateRangePickerDialog> {
  DateTime? _startDate;
  DateTime? _endDate;
  late DateTime _currentMonth;

  final List<String> _weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  final List<String> _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime(widget.firstDate.year, widget.firstDate.month);
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
  }

  bool get _canGoNext {
    final nextMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    final limitMonth = DateTime(widget.lastDate.year, widget.lastDate.month);
    return nextMonth.isBefore(limitMonth) || nextMonth.isAtSameMomentAs(limitMonth);
  }

  bool get _canGoPrev {
    final prevMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    final startMonth = DateTime(widget.firstDate.year, widget.firstDate.month);
    return prevMonth.isAfter(startMonth) || prevMonth.isAtSameMomentAs(startMonth);
  }

  int _daysInMonth(DateTime date) {
    return DateTime(date.year, date.month + 1, 0).day;
  }

  @override
  Widget build(BuildContext context) {
    final firstOfMonth = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final weekdayOfFirst = firstOfMonth.weekday;
    final prefixOffset = weekdayOfFirst == 7 ? 0 : weekdayOfFirst;
    final daysInCurrent = _daysInMonth(_currentMonth);

    final prevMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    final daysInPrev = _daysInMonth(prevMonth);

    final List<Map<String, dynamic>> gridItems = [];

    for (int i = prefixOffset - 1; i >= 0; i--) {
      final date = DateTime(prevMonth.year, prevMonth.month, daysInPrev - i);
      gridItems.add({
        'date': date,
        'isCurrentMonth': false,
        'isEnabled': false,
      });
    }

    final firstAvailableNormalized = DateTime(widget.firstDate.year, widget.firstDate.month, widget.firstDate.day);
    final lastAvailableNormalized = DateTime(widget.lastDate.year, widget.lastDate.month, widget.lastDate.day);

    for (int i = 1; i <= daysInCurrent; i++) {
      final date = DateTime(_currentMonth.year, _currentMonth.month, i);
      final isEnabled = (date.isAfter(firstAvailableNormalized) || date.isAtSameMomentAs(firstAvailableNormalized)) &&
          (date.isBefore(lastAvailableNormalized) || date.isAtSameMomentAs(lastAvailableNormalized));

      gridItems.add({
        'date': date,
        'isCurrentMonth': true,
        'isEnabled': isEnabled,
      });
    }

    final nextMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    final totalSlots = (prefixOffset + daysInCurrent) <= 35 ? 35 : 42;
    final suffixCount = totalSlots - gridItems.length;

    for (int i = 1; i <= suffixCount; i++) {
      final date = DateTime(nextMonth.year, nextMonth.month, i);
      gridItems.add({
        'date': date,
        'isCurrentMonth': false,
        'isEnabled': false,
      });
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  widget.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_canGoPrev)
                    GestureDetector(
                      onTap: _prevMonth,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        child: Icon(Icons.chevron_left_rounded, size: 24, color: kPrimary),
                      ),
                    ),
                  Text(
                    '${_months[_currentMonth.month - 1]} ${_currentMonth.year}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: kText,
                    ),
                  ),
                  if (_canGoNext)
                    GestureDetector(
                      onTap: _nextMonth,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        child: Icon(Icons.chevron_right_rounded, size: 24, color: kPrimary),
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Subtitle showing selected range
          Center(
            child: Text(
              _startDate == null
                  ? 'Tap a date to select start date'
                  : _endDate == null
                      ? 'Selected: ${_startDate!.day}/${_startDate!.month} (Tap Done or tap end date)'
                      : 'Range: ${_startDate!.day}/${_startDate!.month} to ${_endDate!.day}/${_endDate!.month}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: _startDate == null ? kTextSub : kPrimary,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: _weekdays.map((day) {
              return Expanded(
                child: Center(
                  child: Text(
                    day,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: gridItems.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 1.0,
            ),
            itemBuilder: (context, index) {
              final item = gridItems[index];
              final DateTime date = item['date'];
              final bool isCurrentMonth = item['isCurrentMonth'];
              final bool isEnabled = item['isEnabled'];

              if (!isCurrentMonth || !isEnabled) {
                return Center(
                  child: Text(
                    date.day.toString().padLeft(2, '0'),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFFD1D5DB),
                    ),
                  ),
                );
              }

              // Range selection logic checks:
              bool isStart = _startDate != null &&
                  _startDate!.year == date.year &&
                  _startDate!.month == date.month &&
                  _startDate!.day == date.day;

              bool isEnd = _endDate != null &&
                  _endDate!.year == date.year &&
                  _endDate!.month == date.month &&
                  _endDate!.day == date.day;

              bool inRange = false;
              if (_startDate != null && _endDate != null) {
                inRange = date.isAfter(_startDate!) && date.isBefore(_endDate!);
              }

              final isSelected = isStart || isEnd;

              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (_startDate == null) {
                      _startDate = date;
                    } else if (_endDate == null) {
                      if (date.isBefore(_startDate!)) {
                        _startDate = date;
                      } else {
                        _endDate = date;
                      }
                    } else {
                      _startDate = date;
                      _endDate = null;
                    }
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? kPrimary
                        : (inRange ? kPrimary.withValues(alpha: 0.08) : Colors.white),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isSelected || inRange
                        ? []
                        : [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                    border: Border.all(
                      color: isSelected
                          ? Colors.transparent
                          : (inRange ? kPrimary.withValues(alpha: 0.15) : const Color(0xFFF1F5F9)),
                      width: 1,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      date.day.toString().padLeft(2, '0'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected || inRange ? FontWeight.w900 : FontWeight.w700,
                        color: isSelected
                            ? Colors.white
                            : (inRange ? kPrimary : const Color(0xFF1D252C)),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              SizedBox(
                width: 120,
                height: 44,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: kBorder),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: kTextMid,
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: 120,
                height: 44,
                child: ElevatedButton(
                  onPressed: _startDate != null
                      ? () {
                          final start = _startDate!;
                          final end = _endDate ?? _startDate!;
                          Navigator.pop(context, DateTimeRange(start: start, end: end));
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.grey.shade300,
                    disabledForegroundColor: Colors.grey.shade600,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
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
}

Future<DateTimeRange?> showCustomDateRangePicker({
  required BuildContext context,
  required DateTime firstDate,
  required DateTime lastDate,
  String title = 'Select Dates',
}) {
  return showDialog<DateTimeRange>(
    context: context,
    barrierDismissible: true,
    builder: (context) {
      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        elevation: 12,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        child: CustomDateRangePickerDialog(
          firstDate: firstDate,
          lastDate: lastDate,
          title: title,
        ),
      );
    },
  );
}
