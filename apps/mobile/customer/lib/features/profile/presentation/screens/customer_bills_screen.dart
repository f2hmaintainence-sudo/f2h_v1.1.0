import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';

class CustomerBillsScreen extends StatefulWidget {
  const CustomerBillsScreen({super.key});

  @override
  State<CustomerBillsScreen> createState() => _CustomerBillsScreenState();
}

class _CustomerBillsScreenState extends State<CustomerBillsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _bills = [];
  String? _error;
  String _selectedMonthFilter = 'All';

  String _getBillMonthYear(Map<String, dynamic> bill) {
    final rawDate = bill['created_at'] ?? bill['billing_from'] ?? bill['billing_to'] ?? bill['due_date'];
    if (rawDate == null) return 'Recent';
    try {
      final str = rawDate.toString().trim().replaceAll(' ', '-');
      final d = DateTime.tryParse(str);
      if (d == null) return 'Recent';
      const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[d.month]} ${d.year}';
    } catch (_) {
      return 'Recent';
    }
  }

  List<String> get _availableMonths {
    final set = <String>{};
    for (final bill in _bills) {
      final mYear = _getBillMonthYear(bill);
      if (mYear != 'Other') {
        set.add(mYear);
      }
    }
    final list = set.toList();
    list.sort((a, b) {
      try {
        final partsA = a.split(' ');
        final partsB = b.split(' ');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        final mA = months.indexOf(partsA[0]);
        final mB = months.indexOf(partsB[0]);
        final yA = int.parse(partsA[1]);
        final yB = int.parse(partsB[1]);
        if (yA != yB) return yB.compareTo(yA);
        return mB.compareTo(mA);
      } catch (_) {
        return 0;
      }
    });
    return ['All', ...list];
  }

  List<Map<String, dynamic>> get _filteredBills {
    if (_selectedMonthFilter == 'All') {
      return _bills;
    }
    return _bills.where((bill) => _getBillMonthYear(bill) == _selectedMonthFilter).toList();
  }

  Map<String, List<Map<String, dynamic>>> get _groupedBills {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final bill in _filteredBills) {
      final mYear = _getBillMonthYear(bill);
      map.putIfAbsent(mYear, () => []).add(bill);
    }
    return map;
  }

  double _getMonthlyTotal(List<Map<String, dynamic>> monthBills) {
    return monthBills.fold(0.0, (sum, bill) {
      final amt = double.tryParse(bill['total_amount']?.toString() ?? '0') ?? 0.0;
      return sum + amt;
    });
  }

  List<dynamic> get _displayItems {
    final items = <dynamic>[];
    final grouped = _groupedBills;
    for (final entry in grouped.entries) {
      final monthName = entry.key;
      final billsInMonth = entry.value;
      final totalSpent = _getMonthlyTotal(billsInMonth);
      items.add({
        'type': 'header',
        'month': monthName,
        'count': billsInMonth.length,
        'total': totalSpent,
      });
      for (final bill in billsInMonth) {
        items.add({
          'type': 'bill',
          'data': bill,
        });
      }
    }
    return items;
  }

  @override
  void initState() {
    super.initState();
    _fetchBills();
  }

  Future<void> _fetchBills() async {
    try {
      final dio = DioClient().dio;
      final url = '${ApiEndpoints.apiBaseUrl}/customer/orders/bills';
      debugPrint('Fetching customer bills from: $url');
      final response = await dio.get(url);
      final data = response.data;
      List raw = [];
      if (data is Map) {
        if (data['bills'] is List) {
          raw = data['bills'];
        } else if (data['data'] is List) {
          raw = data['data'];
        } else if (data['data'] is Map && data['data']['bills'] is List) {
          raw = data['data']['bills'];
        }
      } else if (data is List) {
        raw = data;
      }
      if (mounted) {
        setState(() {
          _bills = List<Map<String, dynamic>>.from(
            raw.map((item) => Map<String, dynamic>.from(item as Map)),
          );
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e, stack) {
      debugPrint('Error fetching customer bills: $e\n$stack');
      if (mounted) {
        setState(() {
          _bills = [];
          _isLoading = false;
          _error = null;
        });
      }
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return const Color(0xFF16A34A);
      case 'pending':
      case 'due':
        return const Color(0xFFEA580C);
      case 'overdue':
        return const Color(0xFFDC2626);
      case 'cancelled':
        return const Color(0xFF6B7280);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  Color _statusBg(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return const Color(0xFFDCFCE7);
      case 'pending':
      case 'due':
        return const Color(0xFFFFF7ED);
      case 'overdue':
        return const Color(0xFFFEE2E2);
      case 'cancelled':
        return const Color(0xFFF3F4F6);
      default:
        return const Color(0xFFEFF6FF);
    }
  }

  IconData _billTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'subscription':
        return Icons.autorenew_rounded;
      case 'order':
        return Icons.shopping_bag_outlined;
      default:
        return Icons.receipt_long_outlined;
    }
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '-';
    try {
      final d = DateTime.parse(dateStr.toString());
      const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final day = d.day.toString().padLeft(2, '0');
      final month = months[d.month >= 1 && d.month <= 12 ? d.month : 0];
      return '$day $month ${d.year}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  String _formatAmount(dynamic amount) {
    final val = double.tryParse(amount?.toString() ?? '0') ?? 0;
    return '₹${val.toStringAsFixed(2)}';
  }

  Widget _buildMonthFilterBar() {
    final months = _availableMonths;
    if (months.length <= 1) return const SizedBox.shrink();

    return Container(
      height: 44,
      margin: const EdgeInsets.only(top: 8, bottom: 4),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: months.length,
        itemBuilder: (context, index) {
          final month = months[index];
          final isSelected = _selectedMonthFilter == month;
          final count = month == 'All'
              ? _bills.length
              : _bills.where((b) => _getBillMonthYear(b) == month).length;

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(
                month == 'All' ? 'All Bills ($count)' : '$month ($count)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                  color: isSelected ? Colors.white : const Color(0xFF10291F),
                ),
              ),
              selected: isSelected,
              selectedColor: kPrimary,
              backgroundColor: Colors.white,
              showCheckmark: false,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? kPrimary : const Color(0xFFE5E7EB),
                  width: 1,
                ),
              ),
              onSelected: (_) {
                setState(() {
                  _selectedMonthFilter = month;
                });
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildMonthHeader(String month, int count, double total) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: kPrimary,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                month.toUpperCase(),
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF10291F),
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '•  $count bill${count > 1 ? 's' : ''}',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
          Text(
            'Total: ₹${total.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: kPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBillCard(Map<String, dynamic> bill) {
    final status = bill['status']?.toString().toLowerCase() ?? '';
    final billType = bill['bill_type']?.toString() ?? 'order';
    final totalAmount = _formatAmount(bill['total_amount']);
    final paidAmount = double.tryParse(bill['paid_amount']?.toString() ?? '0') ?? 0;
    final dueAmount = double.tryParse(bill['due_amount']?.toString() ?? '0') ?? 0;

    return GestureDetector(
      onTap: () => showBillDetailSheet(context, bill),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: icon + bill id + status badge
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      _billTypeIcon(billType),
                      color: const Color(0xFF16653A),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bill['bill_id']?.toString() ?? '',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF10291F),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${billType[0].toUpperCase()}${billType.substring(1)}  •  ${bill['payment_method']?.toString() ?? ''}',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _statusBg(status),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status.isNotEmpty
                          ? '${status[0].toUpperCase()}${status.substring(1)}'
                          : '',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: _statusColor(status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // Amount row
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAF8),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    _amountCol('Total', totalAmount, const Color(0xFF10291F)),
                    const SizedBox(width: 20),
                    _amountCol('Paid', _formatAmount(paidAmount), const Color(0xFF16A34A)),
                    const SizedBox(width: 20),
                    if (dueAmount > 0)
                      _amountCol('Due', _formatAmount(dueAmount), const Color(0xFFDC2626)),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              // Date row
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 13, color: Colors.grey.shade400),
                  const SizedBox(width: 6),
                  Text(
                    '${_formatDate(bill['billing_from'])} – ${_formatDate(bill['billing_to'])}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _formatDate(bill['created_at']),
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.grey.shade400,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // Action buttons row
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => showModalBottomSheet<void>(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => TaxInvoicePreviewSheet(bill: bill),
                      ),
                      icon: const Icon(Icons.receipt_long_outlined, size: 16, color: Color(0xFF16653A)),
                      label: const Text(
                        'View Invoice',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF16653A),
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFDCFCE7), width: 1.5),
                        backgroundColor: const Color(0xFFF0FDF4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  if (dueAmount > 0) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const WalletScreen()),
                        ),
                        icon: const Icon(Icons.payment_rounded, size: 16, color: Colors.white),
                        label: Text(
                          'Pay ₹${dueAmount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF8),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'My Bills',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: Color(0xFF10291F),
          ),
        ),
        centerTitle: false,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline_rounded,
                          size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 14)),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () {
                          setState(() {
                            _isLoading = true;
                            _error = null;
                          });
                          _fetchBills();
                        },
                        child:
                            const Text('Retry', style: TextStyle(color: kPrimary)),
                      ),
                    ],
                  ),
                )
              : _bills.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: const Color(0xFFDCFCE7), width: 2),
                            ),
                            child: const Icon(Icons.receipt_long_outlined,
                                size: 36, color: Color(0xFF16A34A)),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'No bills for you yet',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF10291F),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'You have no bills available at the moment.',
                            style: TextStyle(
                                fontSize: 13, color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        _buildMonthFilterBar(),
                        Expanded(
                          child: RefreshIndicator(
                            color: kPrimary,
                            onRefresh: _fetchBills,
                            child: _displayItems.isEmpty
                                ? Center(
                                    child: Padding(
                                      padding: const EdgeInsets.all(32),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.calendar_month_outlined, size: 40, color: Colors.grey.shade300),
                                          const SizedBox(height: 12),
                                          Text(
                                            'No bills found for $_selectedMonthFilter',
                                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                : ListView.builder(
                                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                                    itemCount: _displayItems.length,
                                    itemBuilder: (context, index) {
                                      final item = _displayItems[index];
                                      if (item['type'] == 'header') {
                                        return _buildMonthHeader(
                                          item['month'],
                                          item['count'],
                                          item['total'],
                                        );
                                      }
                                      final bill = item['data'] as Map<String, dynamic>;
                                      return _buildBillCard(bill);
                                    },
                                  ),
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _amountCol(String label, String amount, Color color) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade400,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            amount,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

void showBillDetailSheet(BuildContext context, Map<String, dynamic> bill) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => BillDetailSheet(bill: bill),
  );
}

class BillDetailSheet extends StatelessWidget {
  final Map<String, dynamic> bill;
  const BillDetailSheet({required this.bill, super.key});

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '—';
    try {
      final d = DateTime.parse(dateStr.toString());
      const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final day = d.day.toString().padLeft(2, '0');
      final month = months[d.month >= 1 && d.month <= 12 ? d.month : 0];
      return '$day $month ${d.year}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  Widget _amountCol(String label, String amount, Color color) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: kMuted,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              amount,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Expanded(
                flex: 5,
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: valueColor ?? kText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: kBorderLt),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = (bill['status']?.toString() ?? 'paid').toLowerCase();
    final billId = bill['bill_id']?.toString() ?? 'BILL';
    final billType = bill['bill_type']?.toString() ?? 'subscription';
    final refId = bill['reference_id']?.toString() ?? '';
    final paymentMethod = bill['payment_method']?.toString() ?? 'wallet';
    final paymentType = bill['payment_type']?.toString() ?? 'prepaid';
    final billingFrom = bill['billing_from'];
    final billingTo = bill['billing_to'];
    final dueDate = bill['due_date'];
    final createdAt = bill['created_at'];

    final subtotal = double.tryParse(bill['subtotal']?.toString() ?? '0') ?? 0.0;
    final discount = double.tryParse(bill['discount_amount']?.toString() ?? '0') ?? 0.0;
    final tax = double.tryParse(bill['tax_amount']?.toString() ?? '0') ?? 0.0;
    final total = double.tryParse(bill['total_amount']?.toString() ?? '0') ?? 0.0;
    final paid = double.tryParse(bill['paid_amount']?.toString() ?? '0') ?? 0.0;
    final due = double.tryParse(bill['due_amount']?.toString() ?? '0') ?? 0.0;
    final remarks = bill['remarks']?.toString() ?? '';
    final rawItems = bill['items'] as List<dynamic>? ?? [];

    final isPaid = status == 'paid';
    final statusColor = isPaid
        ? const Color(0xFF16A34A)
        : (due > 0 ? const Color(0xFFDC2626) : const Color(0xFFEA580C));
    final statusBg = isPaid
        ? const Color(0xFFDCFCE7)
        : (due > 0 ? const Color(0xFFFEE2E2) : const Color(0xFFFFF7ED));

    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorderLt,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header row: icon + bill id + status badge + close button
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  billType.toLowerCase() == 'subscription'
                      ? Icons.autorenew_rounded
                      : Icons.shopping_bag_outlined,
                  color: const Color(0xFF16653A),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      billId,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${billType[0].toUpperCase()}${billType.substring(1)} Bill  •  ${paymentMethod.toUpperCase()}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status.isNotEmpty
                      ? '${status[0].toUpperCase()}${status.substring(1)}'
                      : '',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                icon: const Icon(Icons.close, size: 20, color: kTextSub),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: kBorderLt),
          const SizedBox(height: 14),

          // Amount summary box
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAF8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorderLt),
            ),
            child: Row(
              children: [
                _amountCol('TOTAL', '₹${total.toStringAsFixed(2)}', kText),
                const SizedBox(width: 12),
                _amountCol('PAID', '₹${paid.toStringAsFixed(2)}', const Color(0xFF16A34A)),
                if (due > 0) ...[
                  const SizedBox(width: 12),
                  _amountCol('DUE', '₹${due.toStringAsFixed(2)}', const Color(0xFFDC2626)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Details breakdown list
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (refId.isNotEmpty)
                    _detailRow('Reference ID', refId),
                  _detailRow(
                    'Billing Period',
                    '${_formatDate(billingFrom)} – ${_formatDate(billingTo)}',
                  ),
                  if (dueDate != null && dueDate.toString().isNotEmpty)
                    _detailRow('Due Date', _formatDate(dueDate)),
                  _detailRow(
                    'Payment Mode',
                    '${paymentMethod.toUpperCase()} (${paymentType.toUpperCase()})',
                  ),
                  _detailRow('Subtotal', '₹${subtotal.toStringAsFixed(2)}'),
                  if (discount > 0)
                    _detailRow(
                      'Discount',
                      '-₹${discount.toStringAsFixed(2)}',
                      valueColor: const Color(0xFF16A34A),
                    ),
                  if (tax > 0)
                    _detailRow('Tax', '₹${tax.toStringAsFixed(2)}'),
                  if (createdAt != null)
                    _detailRow('Bill Date', _formatDate(createdAt)),
                  if (remarks.isNotEmpty)
                    _detailRow('Remarks', remarks),

                  if (rawItems.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Bill Items',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...rawItems.map((item) {
                      final itemMap = item is Map ? Map<String, dynamic>.from(item) : {};
                      final name = itemMap['product_name'] ?? itemMap['name'] ?? 'Item';
                      final variant = itemMap['variant_name'] ?? '';
                      final price = double.tryParse(itemMap['final_price']?.toString() ?? itemMap['unit_price']?.toString() ?? '0') ?? 0.0;
                      final qty = itemMap['quantity'] ?? itemMap['default_m_quantity'] ?? 1;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name.toString(),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: kText,
                                    ),
                                  ),
                                  if (variant.toString().isNotEmpty)
                                    Text(
                                      variant.toString(),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: kTextSub,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Text(
                              '× $qty',
                              style: const TextStyle(
                                fontSize: 12,
                                color: kTextSub,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Text(
                              '₹${(price * (qty is int ? qty : 1)).toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: kText,
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
          ),

          // Bottom action buttons: PDF Download + Pay Due
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      final token = await TokenStorage.getAccessToken();
                      final basePdfUrl = ApiEndpoints.receiptPdf(billId);
                      final pdfUrl = token != null && token.isNotEmpty
                          ? '$basePdfUrl?token=$token'
                          : basePdfUrl;
                      final uri = Uri.parse(pdfUrl);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      } else {
                        await launchUrl(uri, mode: LaunchMode.platformDefault);
                      }
                    } catch (e) {
                      debugPrint('Error downloading invoice PDF: $e');
                    }
                  },
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 18, color: Color(0xFF16653A)),
                  label: const Text(
                    'DOWNLOAD PDF',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF16653A),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF16A34A), width: 1.5),
                    backgroundColor: const Color(0xFFF0FDF4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              if (due > 0) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const WalletScreen(),
                        ),
                      );
                    },
                    icon: const Icon(
                      Icons.account_balance_wallet_rounded,
                      size: 18,
                      color: Colors.white,
                    ),
                    label: Text(
                      'PAY DUE (₹${due.toStringAsFixed(0)})',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

typedef TaxInvoicePreviewSheet = BillDetailSheet;
