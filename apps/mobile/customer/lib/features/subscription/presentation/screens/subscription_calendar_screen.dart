import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
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
  final Set<String> _skippedDates = {};
  Map<String, Map<String, dynamic>> _apiCalendar = {};
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _focusedMonth = DateTime.now();
    _selectedDate = DateTime.now();
    _fetchCalendarData();
  }

  Future<void> _fetchCalendarData() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final data = await sl<SubscriptionRepository>().getSubscriptionCalendar(widget.subscription.id);
      debugPrint('Calendar Screen: Received data length: ${data.length}');
      debugPrint('Calendar Screen: First item: ${data.isNotEmpty ? data.first : "none"}');
      
      setState(() {
        _apiCalendar = {
          for (var item in data)
            if (item is Map && item['date'] != null)
              item['date'].toString(): Map<String, dynamic>.from(item)
        };
        debugPrint('Calendar Screen: Mapped keys: ${_apiCalendar.keys.toList()}');
        
        if (_apiCalendar.isNotEmpty) {
          final sortedDates = _apiCalendar.keys.toList()..sort();
          final firstDateStr = sortedDates.first;
          try {
            final firstDate = DateTime.parse(firstDateStr);
            _selectedDate = firstDate;
            _focusedMonth = DateTime(firstDate.year, firstDate.month);
            debugPrint('Calendar Screen: Focused month set to: $_focusedMonth');
          } catch (e) {
            debugPrint('Calendar Screen: Error setting focused date: $e');
          }
        }
        
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Calendar Screen: Error fetching calendar data: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  String _dateKey(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  bool _isPast(DateTime date) {
    final today = DateTime.now();
    final normalizedDate = DateTime(date.year, date.month, date.day);
    final normalizedToday = DateTime(today.year, today.month, today.day);
    return normalizedDate.isBefore(normalizedToday);
  }

  bool _isScheduledDelivery(DateTime date) {
    final key = _dateKey(date);
    if (_apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final mq = double.tryParse(item['m_quantity']?.toString() ?? '0.0') ?? 0.0;
      final eq = double.tryParse(item['e_quantity']?.toString() ?? '0.0') ?? 0.0;
      return mq > 0 || eq > 0;
    }
    return false;
  }

  bool _hasDelivery(DateTime date) {
    final key = _dateKey(date);
    if (_skippedDates.contains(key)) return false;
    return _isScheduledDelivery(date);
  }

  bool _isSkipped(DateTime date) {
    return _skippedDates.contains(_dateKey(date));
  }

  String _getDeliveryQuantitiesText(DateTime date) {
    final key = _dateKey(date);
    if (_apiCalendar.containsKey(key)) {
      final item = _apiCalendar[key]!;
      final double mq = double.tryParse(item['m_quantity']?.toString() ?? '0.0') ?? 0.0;
      final double eq = double.tryParse(item['e_quantity']?.toString() ?? '0.0') ?? 0.0;
      
      if (mq > 0 && eq > 0) {
        return '${mq.toInt()} Morn + ${eq.toInt()} Eve';
      } else if (mq > 0) {
        return '${mq.toInt()} Morning';
      } else if (eq > 0) {
        return '${eq.toInt()} Evening';
      }
    }
    return '${widget.subscription.qty} ${widget.subscription.slot}';
  }

  List<DateTime> _generateCalendarDates(DateTime month) {
    final firstDayOfMonth = DateTime(month.year, month.month, 1);
    int startWeekday = firstDayOfMonth.weekday;
    if (startWeekday == 7) {
      startWeekday = 0;
    }
    
    return List.generate(42, (index) {
      return DateTime(month.year, month.month, 1 - startWeekday + index);
    });
  }

  void _previousMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
    });
  }

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  String _getWeekDayName(int weekday) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[weekday];
  }

  Future<void> _saveCalendarChanges() async {
    setState(() => _isSaving = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    if (mounted) {
      setState(() => _isSaving = false);
      F2HToast.success(context, 'Calendar modifications saved successfully!');
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dates = _generateCalendarDates(_focusedMonth);
    final selectedKey = _dateKey(_selectedDate);
    
    final isFromBackend = _apiCalendar.containsKey(selectedKey);
    final isScheduled = _isScheduledDelivery(_selectedDate);
    final hasDel = _hasDelivery(_selectedDate);
    final isSkp = _isSkipped(_selectedDate);
    final isPastDate = _isPast(_selectedDate);

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
          )
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
                ),
              )
            : Column(
                children: [
                  // 1. Subscription Product Info Header
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
                            color: kText.withOpacity(0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
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
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: kText,
                                    letterSpacing: -0.1,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  widget.subscription.frequency,
                                  style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w600),
                                ),
                                if (widget.subscription.items.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  ...widget.subscription.items.map((item) {
                                    final List<String> parts = [];
                                    if (item.defaultMQty > 0) parts.add('${item.defaultMQty} AM');
                                    if (item.defaultEQty > 0) parts.add('${item.defaultEQty} PM');
                                    final qtyLabel = parts.join(' + ');

                                    return Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.subdirectory_arrow_right_rounded, size: 10, color: kTextSub),
                                          const SizedBox(width: 2),
                                          Expanded(
                                            child: Text(
                                              '${item.displayName}: $qtyLabel',
                                              style: const TextStyle(fontSize: 9.5, color: kTextSub, fontWeight: FontWeight.w500),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: kPrimary.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Qty: ${widget.subscription.qty}',
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: kPrimary),
                            ),
                          )
                        ],
                      ),
                    ),
                  ),

                  // 2. Month Selector & Calendar Sheet
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: kBorder),
                            ),
                            child: Column(
                              children: [
                                // Month navigation row
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
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        color: kText,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.chevron_right, color: kTextMid),
                                      onPressed: _nextMonth,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                
                                // Calendar Weekday Header
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: List.generate(7, (i) {
                                    return SizedBox(
                                      width: 38,
                                      child: Center(
                                        child: Text(
                                          _getWeekDayName(i),
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: kTextSub,
                                          ),
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                                const SizedBox(height: 8),

                                // Calendar Grid
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
                                    
                                    final isDel = _hasDelivery(date);
                                    final isSk = _isSkipped(date);
                                    final isPastDateTile = _isPast(date);
                                    
                                    final isToday = date.day == DateTime.now().day &&
                                        date.month == DateTime.now().month &&
                                        date.year == DateTime.now().year;

                                    Color textCol = kText;
                                    Color bgCol = Colors.transparent;
                                    Border? border;

                                    double mQty = 0.0;
                                    double eQty = 0.0;
                                    if (dateFromBackend) {
                                      final item = _apiCalendar[key]!;
                                      mQty = double.tryParse(item['m_quantity']?.toString() ?? '0.0') ?? 0.0;
                                      eQty = double.tryParse(item['e_quantity']?.toString() ?? '0.0') ?? 0.0;
                                    }

                                    if (!isCurrentMonth || !dateFromBackend) {
                                      textCol = kMuted.withOpacity(0.5);
                                      bgCol = kBgDeep.withOpacity(0.3);
                                    } else {
                                      if (isSelected) {
                                        border = Border.all(color: kPrimary, width: 2);
                                      } else if (isToday) {
                                        border = Border.all(color: kPrimary.withOpacity(0.3), width: 1.5);
                                      } else {
                                        border = Border.all(color: kBorder);
                                      }

                                      if (isDel) {
                                        bgCol = isPastDateTile ? kPrimaryPl.withOpacity(0.4) : kPrimaryPl;
                                        textCol = isPastDateTile ? kPrimary.withOpacity(0.5) : kPrimary;
                                      } else if (isSk) {
                                        bgCol = isPastDateTile ? kRedLt.withOpacity(0.4) : kRedLt;
                                        textCol = isPastDateTile ? kRed.withOpacity(0.5) : kRed;
                                      } else {
                                        bgCol = kSurface;
                                      }
                                    }

                                    return GestureDetector(
                                      onTap: dateFromBackend
                                          ? () {
                                              setState(() {
                                                _selectedDate = date;
                                                if (date.month != _focusedMonth.month) {
                                                  _focusedMonth = DateTime(date.year, date.month);
                                                }
                                              });
                                            }
                                          : null,
                                      onDoubleTap: (dateFromBackend && !isPastDateTile && (isDel || isSk))
                                          ? () {
                                              setState(() {
                                                if (_skippedDates.contains(key)) {
                                                  _skippedDates.remove(key);
                                                } else {
                                                  _skippedDates.add(key);
                                                }
                                              });
                                            }
                                          : null,
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
                                                        fontWeight: isSelected || isDel || isSk ? FontWeight.w900 : FontWeight.w600,
                                                        color: textCol,
                                                        decoration: isSk ? TextDecoration.lineThrough : null,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                if (dateFromBackend && isCurrentMonth && isPastDateTile) ...[
                                                  Icon(
                                                    Icons.lock,
                                                    size: 9,
                                                    color: kTextSub.withOpacity(0.4),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            if (dateFromBackend && isCurrentMonth && (mQty > 0 || eQty > 0)) ...[
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
                                                            width: 4,
                                                            height: 4,
                                                            decoration: BoxDecoration(
                                                              color: isSk ? kRed : kPrimary,
                                                              shape: BoxShape.circle,
                                                            ),
                                                          ),
                                                          const SizedBox(width: 2),
                                                          Text(
                                                            '${mQty.toInt()}M',
                                                            style: TextStyle(
                                                              fontSize: 8,
                                                              fontWeight: FontWeight.w900,
                                                              color: isSk ? kRed : kPrimary,
                                                              decoration: isSk ? TextDecoration.lineThrough : null,
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
                                                            width: 4,
                                                            height: 4,
                                                            decoration: BoxDecoration(
                                                              color: isSk ? kRed.withOpacity(0.7) : kAccent,
                                                              shape: BoxShape.circle,
                                                            ),
                                                          ),
                                                          const SizedBox(width: 2),
                                                          Text(
                                                            '${eQty.toInt()}E',
                                                            style: TextStyle(
                                                              fontSize: 8,
                                                              fontWeight: FontWeight.w900,
                                                              color: isSk ? kRed.withOpacity(0.7) : kAccent,
                                                              decoration: isSk ? TextDecoration.lineThrough : null,
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
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          
                          // 3. Selected Date Status Card
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
                                    Icon(
                                      !isFromBackend
                                          ? Icons.event_busy
                                          : (hasDel ? Icons.local_shipping_outlined : (isSkp ? Icons.block : Icons.event_busy)),
                                      color: !isFromBackend
                                          ? kTextSub
                                          : (hasDel ? kPrimary : (isSkp ? kRed : kTextSub)),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${_selectedDate.day} ${_getMonthName(_selectedDate.month)} ${_selectedDate.year}',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w900,
                                        color: kText,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  !isFromBackend
                                      ? 'No delivery scheduled for this date.'
                                      : (hasDel
                                          ? 'Regular scheduled delivery (${_getDeliveryQuantitiesText(_selectedDate)}).'
                                          : (isSkp
                                              ? 'Delivery paused/skipped for this date.'
                                              : 'No delivery scheduled.')),
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    color: kTextMid,
                                    height: 1.3,
                                  ),
                                ),
                                if (isFromBackend && isPastDate) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: kBgDeep.withOpacity(0.5),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Row(
                                      children: const [
                                        Icon(Icons.lock_outline, size: 14, color: kTextSub),
                                        SizedBox(width: 8),
                                        Text(
                                          'Past deliveries cannot be paused or resumed.',
                                          style: TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w600),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 16),
                                
                                // Toggle Action Button
                                if (isFromBackend && !isPastDate) ...[
                                  if (isScheduled) ...[
                                    SizedBox(
                                      width: double.infinity,
                                      child: OutlinedButton(
                                        onPressed: () {
                                          setState(() {
                                            final key = selectedKey;
                                            if (_skippedDates.contains(key)) {
                                              _skippedDates.remove(key);
                                            } else {
                                              _skippedDates.add(key);
                                            }
                                          });
                                        },
                                        style: OutlinedButton.styleFrom(
                                          side: BorderSide(color: isSkp ? kPrimary : kRed),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          foregroundColor: isSkp ? kPrimary : kRed,
                                        ),
                                        child: Text(
                                          isSkp ? 'Resume Delivery' : 'Pause Delivery',
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // 4. Save Changes Bottom Bar
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    decoration: BoxDecoration(
                      color: kSurface,
                      border: Border.all(color: kBorder),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '${_skippedDates.length} paused',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: kTextMid,
                                ),
                              ),
                              const Text(
                                'Unsaved changes',
                                style: TextStyle(fontSize: 10, color: kTextSub),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        ElevatedButton(
                          onPressed: (_skippedDates.isEmpty && !_isSaving)
                              ? null
                              : _saveCalendarChanges,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kPrimary,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: kBgDeep,
                            disabledForegroundColor: kTextSub,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                            elevation: 0,
                          ),
                          child: _isSaving
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : const Text(
                                  'Save Changes',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
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
