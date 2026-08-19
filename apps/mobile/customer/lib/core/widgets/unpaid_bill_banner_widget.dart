import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:f2h_customer/core/widgets/color_paper_blast.dart';
import 'package:f2h_customer/core/payments/payment_flow.dart';
import 'package:f2h_customer/core/payments/payment_models.dart';

class UnpaidBillBannerWidget extends StatefulWidget {
  const UnpaidBillBannerWidget({super.key});

  @override
  State<UnpaidBillBannerWidget> createState() => _UnpaidBillBannerWidgetState();
}

class _UnpaidBillBannerWidgetState extends State<UnpaidBillBannerWidget> {
  bool _isLoading = true;
  Map<String, dynamic>? _billData;

  @override
  void initState() {
    super.initState();
    _fetchUnpaidBills();
  }

  Future<void> _fetchUnpaidBills() async {
    try {
      final dio = DioClient().dio;
      final response = await dio.get('${ApiEndpoints.apiBaseUrl}/customer/payment/unpaid-bills');
      final data = response.data;
      if (data is Map && data['status'] == true && data['has_unpaid_bills'] == true) {
        if (mounted) {
          setState(() {
            _billData = Map<String, dynamic>.from(data);
            _isLoading = false;
          });
        }
        return;
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _openPaymentSheet(BuildContext context, Map<String, dynamic> bill) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => UnpaidBillPaymentSheet(
        bill: bill,
        walletBalance: (_billData?['wallet_balance'] as num?)?.toDouble() ?? 0.0,
        onPaymentSuccess: () {
          _fetchUnpaidBills();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _billData == null || _billData!['has_unpaid_bills'] != true) {
      return const SizedBox.shrink();
    }

    final bills = (_billData!['bills'] as List?) ?? [];
    if (bills.isEmpty) return const SizedBox.shrink();

    final primaryBill = Map<String, dynamic>.from(bills.first as Map);
    final dueAmount = (primaryBill['due_amount'] as num?)?.toDouble() ?? 0.0;
    final billId = primaryBill['bill_id']?.toString() ?? 'BILL';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF60A5FA), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _openPaymentSheet(context, primaryBill),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                // Warning Icon Badge
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDBEAFE),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.receipt_long_rounded,
                    color: Color(0xFF1D4ED8),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),

                // Details Text
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Unpaid Subscription Bill',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1E3A8A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Amount Due: ₹${dueAmount.toStringAsFixed(2)} · Bill #$billId',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1D4ED8),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Action Button
                ElevatedButton(
                  onPressed: () => _openPaymentSheet(context, primaryBill),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'CLEAR',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
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
      final billId = widget.bill['bill_id']?.toString() ?? '';

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
        await Future.delayed(const Duration(milliseconds: 2000));
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
    final billId = widget.bill['bill_id']?.toString() ?? '';
    if (billId.isEmpty) return;

    setState(() => _isProcessing = true);

    // The amount is recomputed on the server from the bill itself, so the
    // client never gets to decide what a bill costs.
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
    await Future.delayed(const Duration(milliseconds: 2000));
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final dueAmount = (widget.bill['due_amount'] as num?)?.toDouble() ?? 0.0;
    final billId = widget.bill['bill_id']?.toString() ?? 'BILL';
    final hasSufficientWallet = widget.walletBalance >= dueAmount;
    final shortfall = math.max(0.0, dueAmount - widget.walletBalance);

    return Stack(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top drag indicator
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              Row(
                children: [
                  const Icon(Icons.receipt_long_rounded, color: kPrimary, size: 24),
                  const SizedBox(width: 10),
                  const Text(
                    'Clear Subscription Bill',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: kTextSub),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(),
              const SizedBox(height: 12),

              // Bill Breakdown Box
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Bill Reference ID', style: TextStyle(fontSize: 13, color: kTextSub)),
                        Text('#$billId', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: kText)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Pending Due Amount', style: TextStyle(fontSize: 13, color: kTextSub)),
                        Text('₹${dueAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.redAccent)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Wallet Balance Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: hasSufficientWallet ? const Color(0xFFF0FDF4) : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: hasSufficientWallet ? const Color(0xFF86EFAC) : const Color(0xFFFDBA74),
                    width: 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      hasSufficientWallet ? Icons.account_balance_wallet_rounded : Icons.warning_amber_rounded,
                      color: hasSufficientWallet ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Wallet Balance: ₹${widget.walletBalance.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: hasSufficientWallet ? const Color(0xFF14532D) : const Color(0xFF9A3412),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            hasSufficientWallet
                                ? 'Sufficient balance available to clear bill'
                                : 'Shortfall: ₹${shortfall.toStringAsFixed(2)} (Topup required)',
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

              const SizedBox(height: 24),

              // Payment Action Buttons
              if (hasSufficientWallet) ...[
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _isProcessing ? null : _payViaWallet,
                    icon: const Icon(Icons.account_balance_wallet_rounded, size: 20),
                    label: _isProcessing
                        ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                        : Text('Pay ₹${dueAmount.toStringAsFixed(0)} from Wallet', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ] else ...[
                // Option 1: Topup Wallet
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const WalletScreen()));
                    },
                    icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
                    label: Text('Topup Wallet (Add ₹${shortfall.toStringAsFixed(0)})', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Option 2: Pay Online via Razorpay
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: _isProcessing ? null : _payOnlineRazorpay,
                    icon: const Icon(Icons.payment_rounded, size: 20),
                    label: const Text('Pay Online via Razorpay', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kPrimary,
                      side: const BorderSide(color: kPrimary, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
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
