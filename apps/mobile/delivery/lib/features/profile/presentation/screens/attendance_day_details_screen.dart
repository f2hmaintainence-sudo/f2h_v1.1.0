import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class AttendanceDayDetailsScreen extends StatefulWidget {
  final String dateStr;
  final ProfileRepository repository;

  const AttendanceDayDetailsScreen({
    super.key,
    required this.dateStr,
    required this.repository,
  });

  @override
  State<AttendanceDayDetailsScreen> createState() => _AttendanceDayDetailsScreenState();
}

class _AttendanceDayDetailsScreenState extends State<AttendanceDayDetailsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  String _selectedFilter = 'All';

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await widget.repository.fetchAttendanceDayDetails(widget.dateStr);
      if (mounted) {
        setState(() {
          _data = res;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  String _formatFriendlyDate(String dateStr) {
    try {
      final parts = dateStr.split('-');
      if (parts.length != 3) return dateStr;
      final year = int.parse(parts[0]);
      final month = int.parse(parts[1]);
      final day = int.parse(parts[2]);

      final dt = DateTime(year, month, day);
      final weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final monthNames = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      final weekday = weekdayNames[dt.weekday - 1];
      final monthName = monthNames[month];
      return '$weekday, $monthName $day, $year';
    } catch (e) {
      return dateStr;
    }
  }

  List<Map<String, dynamic>> _getFilteredLogs(List<Map<String, dynamic>> logs) {
    if (_selectedFilter == 'All') return logs;
    return logs.where((log) {
      final status = (log['order_status'] ?? '').toString().toLowerCase();
      if (_selectedFilter == 'Assigned') {
        return status != 'delivered' && status != 'failed' && status != 'cancelled';
      } else if (_selectedFilter == 'Delivered') {
        return status == 'delivered';
      } else if (_selectedFilter == 'Failed') {
        return status == 'failed';
      } else if (_selectedFilter == 'Cancelled') {
        return status == 'cancelled';
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final friendlyDate = _formatFriendlyDate(widget.dateStr);

    return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(title: 'Daily Attendance Logs'),
      body: _buildBody(friendlyDate),
    );
  }

  Widget _buildBody(String friendlyDate) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: kRed, size: 56),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(color: kTextSub, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _fetchDetails,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    final logs = (_data?['logs'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final filteredLogs = _getFilteredLogs(logs);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeaderSummary(friendlyDate),
        const SizedBox(height: 8),
        Expanded(
          child: _buildLogsList(filteredLogs),
        ),
      ],
    );
  }

  Widget _buildHeaderSummary(String friendlyDate) {
    final summary = _data?['summary'] as Map<String, dynamic>? ?? {};
    final assigned = summary['assigned'] ?? 0;
    final delivered = summary['delivered'] ?? 0;
    final failed = summary['failed'] ?? 0;
    final cancelled = summary['cancelled'] ?? 0;

    return Container(
      decoration: const BoxDecoration(
        color: kPrimary,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_today_rounded, color: kAccent, size: 18),
              const SizedBox(width: 8),
              Text(
                friendlyDate,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildSummaryStatCard('Assigned', '$assigned', const Color(0xFFFFF3CD), const Color(0xFF856404)),
              _buildSummaryStatCard('Delivered', '$delivered', const Color(0xFFE8F5E9), Colors.green.shade800),
              _buildSummaryStatCard('Failed', '$failed', const Color(0xFFFEE2E2), kRed),
              _buildSummaryStatCard('Cancelled', '$cancelled', kBgDeep, kTextSub),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryStatCard(String label, String value, Color bg, Color fg) {
    final hasActiveFilter = _selectedFilter != 'All';
    final isSelected = _selectedFilter == label;
    final double opacity = (hasActiveFilter && !isSelected) ? 0.4 : 1.0;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            if (_selectedFilter == label) {
              _selectedFilter = 'All';
            } else {
              _selectedFilter = label;
            }
          });
        },
        child: AnimatedOpacity(
          opacity: opacity,
          duration: const Duration(milliseconds: 200),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? fg : Colors.transparent,
                width: 2.5,
              ),
            ),
            child: Column(
              children: [
                Text(
                  value,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    color: fg.withValues(alpha: 0.8),
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogsList(List<Map<String, dynamic>> filteredLogs) {
    if (filteredLogs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.assignment_turned_in_outlined, size: 64, color: kMuted.withValues(alpha: 0.5)),
              const SizedBox(height: 16),
              Text(
                'No $_selectedFilter logs found',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kTextMid),
              ),
              const SizedBox(height: 4),
              const Text(
                'There are no delivery orders matching this filter.',
                style: TextStyle(fontSize: 13, color: kTextSub),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: filteredLogs.length,
      itemBuilder: (context, index) {
        return _buildOrderCard(filteredLogs[index]);
      },
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> log) {
    final String orderId = (log['order_id'] ?? '').toString();
    final String orderStatus = (log['order_status'] ?? '').toString().toLowerCase();
    final String paymentMode = (log['payment_mode'] ?? 'COD').toString();
    final String paymentStatus = (log['payment_status'] ?? 'pending').toString().toLowerCase();
    final double totalAmount = double.tryParse((log['total_amount'] ?? '0').toString()) ?? 0.0;
    final String slot = (log['slot'] ?? 'N/A').toString();

    final String customerName = (log['customer_name'] ?? 'Unknown Customer').toString().trim();
    final String customerPhone = (log['customer_phone'] ?? '').toString();
    final String customerAddress = (log['customer_address'] ?? 'No address listed').toString().trim();

    final int bottlesCollected = log['bottles_collected'] as int? ?? 0;
    final double cashCollected = double.tryParse((log['cash_collected'] ?? '0').toString()) ?? 0.0;
    final String remarks = (log['remarks'] ?? '').toString();
    final String proofPhotoUrl = (log['proof_photo_url'] ?? '').toString();
    final String deliveryTime = (log['delivery_time'] ?? '').toString();

    final List itemsList = log['items'] as List? ?? [];

    Color statusBg;
    Color statusFg;
    String statusLabel;

    if (orderStatus == 'delivered') {
      statusBg = const Color(0xFFE8F5E9);
      statusFg = Colors.green.shade800;
      statusLabel = 'Delivered';
    } else if (orderStatus == 'failed') {
      statusBg = const Color(0xFFFEE2E2);
      statusFg = kRed;
      statusLabel = 'Failed';
    } else if (orderStatus == 'cancelled') {
      statusBg = kBgDeep;
      statusFg = kTextSub;
      statusLabel = 'Cancelled';
    } else {
      statusBg = const Color(0xFFFFF3CD);
      statusFg = const Color(0xFF856404);
      statusLabel = orderStatus.toUpperCase();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Card Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: kBorderLt.withValues(alpha: 0.5),
              child: Row(
                children: [
                  Text(
                    'Order ID: #$orderId',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: kText),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, size: 14, color: kTextSub),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: orderId));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Order ID copied to clipboard'),
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(color: statusFg, fontWeight: FontWeight.bold, fontSize: 10),
                    ),
                  ),
                ],
              ),
            ),

            // Card Body
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Slot Information
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 14, color: kPrimaryMid),
                      const SizedBox(width: 6),
                      Text(
                        'Slot: $slot',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: kTextMid),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: kBorderLt),
                  const SizedBox(height: 8),

                  // Customer Details
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.person_pin_rounded, size: 18, color: kMuted),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              customerName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: kText),
                            ),
                            if (customerPhone.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Text(
                                    customerPhone,
                                    style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w500),
                                  ),
                                  const SizedBox(width: 8),
                                  InkWell(
                                    onTap: () {
                                      Clipboard.setData(ClipboardData(text: customerPhone));
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('Phone number copied'),
                                          duration: Duration(seconds: 1),
                                        ),
                                      );
                                    },
                                    child: const Icon(Icons.call_rounded, size: 16, color: kPrimaryMid),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 6),
                            Text(
                              customerAddress,
                              style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),
                  const Divider(color: kBorderLt),
                  const SizedBox(height: 8),

                  // Payment & Total
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Amount', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(
                            '₹${totalAmount.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kPrimary),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Mode: $paymentMode',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kTextMid),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: paymentStatus == 'paid' ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3CD),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              paymentStatus.toUpperCase(),
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: paymentStatus == 'paid' ? Colors.green.shade800 : const Color(0xFF856404),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Items Expansion Summary
                  if (itemsList.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Divider(color: kBorderLt),
                    Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        childrenPadding: EdgeInsets.zero,
                        title: Row(
                          children: [
                            const Icon(Icons.shopping_bag_outlined, size: 14, color: kPrimaryMid),
                            const SizedBox(width: 6),
                            Text(
                              'Items Ordered (${itemsList.length})',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid),
                            ),
                          ],
                        ),
                        children: itemsList.map((itemObj) {
                          final String pName = (itemObj['product_name'] ?? 'Product').toString();
                          final int quantity = itemObj['quantity'] as int? ?? 1;
                          final double price = double.tryParse((itemObj['final_price'] ?? '0').toString()) ?? 0.0;
                          final String uValue = (itemObj['unit_value'] ?? '').toString();
                          final String uType = (itemObj['unit_type'] ?? '').toString();

                          final String unitDesc = (uValue.isNotEmpty && uType.isNotEmpty) ? ' ($uValue $uType)' : '';

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    '$pName$unitDesc x $quantity',
                                    style: const TextStyle(fontSize: 12, color: kTextMid, fontWeight: FontWeight.w500),
                                  ),
                                ),
                                Text(
                                  '₹${(price * quantity).toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kText),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],

                  // Delivery log details
                  if (orderStatus == 'delivered' || orderStatus == 'failed') ...[
                    const SizedBox(height: 12),
                    const Divider(color: kBorderLt),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: kBgDeep.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'DELIVERY RUN DETAILS',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 8),
                          if (deliveryTime.isNotEmpty)
                            _buildLogDetailRow('Time', deliveryTime.split('T').last.substring(0, 5)),
                          if (orderStatus == 'delivered') ...[
                            _buildLogDetailRow('Cash Collected', '₹${cashCollected.toStringAsFixed(2)}'),
                            _buildLogDetailRow('Empty Bottles Collected', '$bottlesCollected'),
                          ],
                          if (remarks.isNotEmpty)
                            _buildLogDetailRow('Remarks', remarks),
                          if (proofPhotoUrl.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.photo_library_outlined, size: 14, color: kPrimaryMid),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Proof Photo Attached',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.green.shade800,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
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
    );
  }

  Widget _buildLogDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: ', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kTextSub)),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 11, color: kTextMid, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
