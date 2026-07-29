import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class CustomerBillsScreen extends StatefulWidget {
  const CustomerBillsScreen({super.key});

  @override
  State<CustomerBillsScreen> createState() => _CustomerBillsScreenState();
}

class _CustomerBillsScreenState extends State<CustomerBillsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _bills = [];
  String? _error;

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
      return DateFormat('dd MMM yyyy').format(d);
    } catch (_) {
      return dateStr.toString();
    }
  }

  String _formatAmount(dynamic amount) {
    final val = double.tryParse(amount?.toString() ?? '0') ?? 0;
    return '₹${val.toStringAsFixed(2)}';
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
                  : RefreshIndicator(
                      color: kPrimary,
                      onRefresh: _fetchBills,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        itemCount: _bills.length,
                        itemBuilder: (context, index) {
                          final bill = _bills[index];
                          final status =
                              bill['status']?.toString().toLowerCase() ?? '';
                          final billType =
                              bill['bill_type']?.toString() ?? 'order';
                          final totalAmount = _formatAmount(bill['total_amount']);
                          final paidAmount =
                              double.tryParse(
                                      bill['paid_amount']?.toString() ?? '0') ??
                                  0;
                          final dueAmount =
                              double.tryParse(
                                      bill['due_amount']?.toString() ?? '0') ??
                                  0;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                  color: const Color(0xFFE5E7EB), width: 1),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
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
                                          borderRadius:
                                              BorderRadius.circular(12),
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
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
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
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: _statusBg(status),
                                          borderRadius:
                                              BorderRadius.circular(20),
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
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAF8),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Row(
                                      children: [
                                        _amountCol('Total', totalAmount,
                                            const Color(0xFF10291F)),
                                        const SizedBox(width: 20),
                                        _amountCol(
                                            'Paid',
                                            _formatAmount(paidAmount),
                                            const Color(0xFF16A34A)),
                                        const SizedBox(width: 20),
                                        if (dueAmount > 0)
                                          _amountCol(
                                              'Due',
                                              _formatAmount(dueAmount),
                                              const Color(0xFFDC2626)),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  // Date row
                                  Row(
                                    children: [
                                      Icon(Icons.calendar_today_outlined,
                                          size: 13,
                                          color: Colors.grey.shade400),
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
                                ],
                              ),
                            ),
                          );
                        },
                      ),
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
