import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:f2h_customer/core/widgets/color_paper_blast.dart';
import 'package:f2h_customer/core/payments/payment_flow.dart';
import 'package:f2h_customer/core/payments/payment_models.dart';

class UnpaidBillBannerWidget extends StatefulWidget {
  const UnpaidBillBannerWidget({super.key});

  /// Global notifier to trigger instant refresh on all active UnpaidBillBannerWidgets
  static final ValueNotifier<int> refreshTrigger = ValueNotifier<int>(0);

  static void refresh() {
    refreshTrigger.value++;
  }

  @override
  State<UnpaidBillBannerWidget> createState() => _UnpaidBillBannerWidgetState();
}

class _UnpaidBillBannerWidgetState extends State<UnpaidBillBannerWidget> {
  bool _isLoading = true;
  Map<String, dynamic>? _billData;

  @override
  void initState() {
    super.initState();
    UnpaidBillBannerWidget.refreshTrigger.addListener(_onRefreshTrigger);
    _fetchUnpaidBills();
  }

  @override
  void dispose() {
    UnpaidBillBannerWidget.refreshTrigger.removeListener(_onRefreshTrigger);
    super.dispose();
  }

  void _onRefreshTrigger() {
    if (mounted) {
      _fetchUnpaidBills();
    }
  }

  Future<void> _fetchUnpaidBills() async {
    try {
      final dio = DioClient().dio;
      final response = await dio.get(ApiEndpoints.paymentUnpaidBills);
      final data = response.data;
      if (data is Map &&
          data['status'] == true &&
          data['has_unpaid_bills'] == true &&
          (data['bills'] as List?)?.isNotEmpty == true) {
        if (mounted) {
          setState(() {
            _billData = Map<String, dynamic>.from(data);
            _isLoading = false;
          });
        }
        return;
      }
    } catch (e) {
      debugPrint('UnpaidBillBannerWidget: Error fetching unpaid bills: $e');
    }

    if (mounted) {
      setState(() {
        _billData = null;
        _isLoading = false;
      });
    }
  }

  void _openPaymentSheet(BuildContext context, Map<String, dynamic> bill) {
    UnpaidBillPaymentSheet.show(
      context,
      bill: bill,
      walletBalance: (_billData?['wallet_balance'] as num?)?.toDouble() ?? 0.0,
      onPaymentSuccess: () {
        _fetchUnpaidBills();
        try {
          // ignore: use_build_context_synchronously
          context.read<CustomerSessionCubit>().refreshSilently();
        } catch (_) {}
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _billData == null || _billData!['has_unpaid_bills'] != true) {
      return const SizedBox.shrink();
    }

    final bills = (_billData!['bills'] as List?) ?? [];
    if (bills.isEmpty) return const SizedBox.shrink();

    final totalDueAmount = bills.fold<double>(
      0.0,
      (sum, b) => sum + ((b['due_amount'] as num?)?.toDouble() ?? (b['total_amount'] as num?)?.toDouble() ?? 0.0),
    );
    final isMultiBill = bills.length > 1;
    final primaryBill = Map<String, dynamic>.from(bills.first as Map);
    final dueAmount = (primaryBill['due_amount'] as num?)?.toDouble() ?? (primaryBill['total_amount'] as num?)?.toDouble() ?? 0.0;
    final displayAmount = isMultiBill ? totalDueAmount : dueAmount;
    final monthName = primaryBill['billing_month']?.toString() ?? 'Monthly';
    final productName = primaryBill['product_name']?.toString() ?? 'Postpaid Subscription';

    final amountStr = displayAmount == displayAmount.roundToDouble()
        ? displayAmount.toInt().toString()
        : displayAmount.toStringAsFixed(2);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFECDD3), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFE11D48).withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openPaymentSheet(context, primaryBill),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
            child: Row(
              children: [
                // Glowing Icon Badge
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFE4E6), Color(0xFFFECDD3)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.pending_actions_rounded,
                    color: Color(0xFFE11D48),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),

                // Details Text
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              isMultiBill ? 'Pending Bills (${bills.length})' : 'Pending Bill',
                              style: GoogleFonts.roboto(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF1E293B),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE11D48),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'DUE',
                              style: GoogleFonts.roboto(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Text(
                            '₹$amountStr Due',
                            style: GoogleFonts.roboto(
                              fontSize: 12.5,
                              color: const Color(0xFFE11D48),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '•',
                            style: GoogleFonts.roboto(
                              fontSize: 11,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              '$monthName • $productName',
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),

                // Pay Now Button
                Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFE11D48), Color(0xFFBE123C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE11D48).withValues(alpha: 0.28),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: () => _openPaymentSheet(context, primaryBill),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      shadowColor: Colors.transparent,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Pay Now',
                          style: GoogleFonts.roboto(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          size: 13,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class UnpaidBillPaymentSheet extends StatefulWidget {
  final Map<String, dynamic> bill;
  final double walletBalance;
  final VoidCallback onPaymentSuccess;

  const UnpaidBillPaymentSheet({
    super.key,
    required this.bill,
    required this.walletBalance,
    required this.onPaymentSuccess,
  });

  static void show(
    BuildContext context, {
    required Map<String, dynamic> bill,
    required double walletBalance,
    required VoidCallback onPaymentSuccess,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => UnpaidBillPaymentSheet(
        bill: bill,
        walletBalance: walletBalance,
        onPaymentSuccess: onPaymentSuccess,
      ),
    );
  }

  @override
  State<UnpaidBillPaymentSheet> createState() => _UnpaidBillPaymentSheetState();
}

class _UnpaidBillPaymentSheetState extends State<UnpaidBillPaymentSheet> {
  bool _isProcessing = false;
  bool _showConfetti = false;

  Future<void> _payViaWallet() async {
    setState(() => _isProcessing = true);
    try {
      final dio = DioClient().dio;
      final billId = widget.bill['bill_id']?.toString() ?? widget.bill['id']?.toString() ?? '';

      final response = await dio.post(
        '${ApiEndpoints.apiBaseUrl}/customer/payment/pay-wallet',
        data: {'bill_id': billId},
      );

      final data = response.data;
      if (data is Map && data['status'] == true) {
        if (!mounted) return;
        setState(() {
          _isProcessing = false;
          _showConfetti = true;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message']?.toString() ?? 'Bill paid successfully from wallet!'),
            backgroundColor: kPrimary,
          ),
        );

        widget.onPaymentSuccess();
        UnpaidBillBannerWidget.refresh();
        try {
          // ignore: use_build_context_synchronously
          context.read<CustomerSessionCubit>().refreshSilently();
        } catch (_) {}
        await Future.delayed(const Duration(milliseconds: 1800));
        if (mounted) Navigator.pop(context);
        return;
      } else {
        final msg = data is Map ? data['message']?.toString() : 'Failed to pay bill via wallet';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg ?? 'Failed to pay bill'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment error. Please try again.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _payOnlineRazorpay() async {
    final billId = widget.bill['bill_id']?.toString() ?? widget.bill['id']?.toString() ?? '';
    if (billId.isEmpty) return;

    setState(() => _isProcessing = true);

    final result = await F2HPaymentFlow.pay(
      context,
      purpose: PaymentPurpose.bill,
      billId: billId,
      showResultSheet: false,
    );

    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (result.cancelled) return;

    if (!result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _showConfetti = true);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message), backgroundColor: kPrimary),
    );

    widget.onPaymentSuccess();
    UnpaidBillBannerWidget.refresh();
    try {
      // ignore: use_build_context_synchronously
      context.read<CustomerSessionCubit>().refreshSilently();
    } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 1800));
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final dueAmount = (double.tryParse(widget.bill['due_amount']?.toString() ?? '0') ??
        double.tryParse(widget.bill['total_amount']?.toString() ?? '0') ??
        0.0);
    final billId = widget.bill['bill_id']?.toString() ?? widget.bill['id']?.toString() ?? 'BILL';
    final monthName = widget.bill['billing_month']?.toString() ?? widget.bill['billing_period_label']?.toString() ?? 'Monthly';
    final subId = widget.bill['subscription_id']?.toString();
    final productName = widget.bill['product_name']?.toString() ?? widget.bill['item_name']?.toString() ?? 'Daily Subscription';

    final hasSufficientWallet = widget.walletBalance >= dueAmount;
    final shortfall = math.max(0.0, dueAmount - widget.walletBalance);

    return Stack(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top drag indicator
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 14),

              // Title
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF16A34A), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$monthName Bill',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: kText,
                          ),
                        ),
                        const Text(
                          'Choose your preferred payment method',
                          style: TextStyle(
                            fontSize: 11,
                            color: kTextSub,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: kTextSub),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 24),

              // Bill Breakdown Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Bill Reference ID', style: TextStyle(fontSize: 12.5, color: kTextSub)),
                        Text('#$billId', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: kText)),
                      ],
                    ),
                    if (subId != null && subId.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subscription ID', style: TextStyle(fontSize: 12.5, color: kTextSub)),
                          Text('#$subId', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF059669))),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subscribed Item', style: TextStyle(fontSize: 12.5, color: kTextSub)),
                        Expanded(
                          child: Text(
                            productName,
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kText),
                            textAlign: TextAlign.right,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Amount Due', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kText)),
                        Text('₹${dueAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFFDC2626))),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Wallet Balance Info Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: hasSufficientWallet ? const Color(0xFFF0FDF4) : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: hasSufficientWallet ? const Color(0xFF86EFAC) : const Color(0xFFFDBA74),
                    width: 1.2,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      hasSufficientWallet ? Icons.account_balance_wallet_rounded : Icons.info_outline_rounded,
                      color: hasSufficientWallet ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Wallet Balance: ₹${widget.walletBalance.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: hasSufficientWallet ? const Color(0xFF14532D) : const Color(0xFF9A3412),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            hasSufficientWallet
                                ? 'Instant settlement using your wallet balance'
                                : 'Shortfall: ₹${shortfall.toStringAsFixed(0)} (Topup or pay online)',
                            style: TextStyle(
                              fontSize: 11,
                              color: hasSufficientWallet ? const Color(0xFF15803D) : const Color(0xFFC2410C),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Payment Action Buttons
              if (_isProcessing)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: CircularProgressIndicator(color: kPrimary),
                  ),
                )
              else ...[
                // Option 1: Pay from Wallet (if sufficient) OR Pay Online (if insufficient)
                if (hasSufficientWallet) ...[
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _payViaWallet,
                      icon: const Icon(Icons.account_balance_wallet_rounded, size: 18),
                      label: Text(
                        'Pay ₹${dueAmount.toStringAsFixed(0)} from Wallet',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: OutlinedButton.icon(
                      onPressed: _payOnlineRazorpay,
                      icon: const Icon(Icons.credit_card_rounded, size: 18),
                      label: const Text(
                        'Pay Online (UPI / Cards / Netbanking)',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF1E293B),
                        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ] else ...[
                  // Primary: Online Payment
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _payOnlineRazorpay,
                      icon: const Icon(Icons.payment_rounded, size: 18),
                      label: Text(
                        'Pay ₹${dueAmount.toStringAsFixed(0)} Online (UPI / Cards)',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const WalletScreen()));
                      },
                      icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
                      label: Text(
                        'Topup Wallet (Add ₹${shortfall.toStringAsFixed(0)})',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEA580C),
                        side: const BorderSide(color: Color(0xFFFDBA74), width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),

        // Confetti celebration on successful bill clearance
        if (_showConfetti)
          const Positioned.fill(
            child: IgnorePointer(
              child: ColorPaperBlast(
                trigger: true,
                duration: Duration(seconds: 3),
                child: SizedBox.expand(),
              ),
            ),
          ),
      ],
    );
  }
}
