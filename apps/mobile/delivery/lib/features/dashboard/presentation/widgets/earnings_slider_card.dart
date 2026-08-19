import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/documents_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/referral_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/warehouse_pickup_modal.dart';

class EarningsSliderCard extends StatefulWidget {
  final bool isVerified;
  final bool isItemsPickedUp;
  final List<DeliveryOrderModel> orders;
  final String todayEarnings;
  final int completedOrdersCount;
  final double rating;
  final VoidCallback onNavigateToProfile;

  const EarningsSliderCard({
    super.key,
    required this.isVerified,
    this.isItemsPickedUp = true,
    this.orders = const [],
    this.todayEarnings = '₹1,420.00',
    this.completedOrdersCount = 12,
    this.rating = 4.8,
    required this.onNavigateToProfile,
  });

  @override
  State<EarningsSliderCard> createState() => _EarningsSliderCardState();
}

class _EarningsSliderCardState extends State<EarningsSliderCard> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  Timer? _autoSlideTimer;

  double _referralPoints = 0.0;
  int _totalReferrals = 0;
  String _redeemStatus = 'none';
  bool _submittingRedeem = false;

  @override
  void initState() {
    super.initState();
    _fetchReferralData();
    if (!widget.isVerified) {
      _startAutoSlideTimer();
    }
  }

  Future<void> _fetchReferralData() async {
    try {
      final dioClient = DioClient();
      final res = await dioClient.dio.get(ApiEndpoints.profileReferrals);
      if (res.data != null && res.data['data'] != null) {
        final data = res.data['data'];
        if (mounted) {
          setState(() {
            _referralPoints = double.tryParse((data['referral_wallet_balance'] ?? data['total_earnings'] ?? 0).toString()) ?? 0.0;
            _totalReferrals = int.tryParse((data['total_referrals'] ?? 0).toString()) ?? 0;
            _redeemStatus = (data['redeem_status'] ?? 'none').toString();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _handleRedeem() async {
    if (_referralPoints < 500.0) {
      AppSnackBar.error(context, 'Minimum ₹500 referral points required to unlock redeem option.');
      return;
    }

    final TextEditingController amountController = TextEditingController(
      text: _referralPoints.toStringAsFixed(0),
    );
    String? inputError;

    final double? selectedAmount = await showDialog<double>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            final double currentBalance = _referralPoints;
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.stars_rounded, color: Color(0xFF16A34A), size: 24),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Redeem Referral Points', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('Enter amount to redeem', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Available Balance Chip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Available Balance:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFB45309))),
                          Text('₹${currentBalance.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text('Redeem Amount (₹)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      autofocus: true,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F5132)),
                      decoration: InputDecoration(
                        prefixText: '₹ ',
                        prefixStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                        hintText: 'Enter amount',
                        errorText: inputError,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2)),
                      ),
                      onChanged: (val) {
                        final double? valNum = double.tryParse(val.trim());
                        setDialogState(() {
                          if (valNum == null || valNum <= 0) {
                            inputError = 'Enter a valid amount greater than ₹0';
                          } else if (valNum > currentBalance) {
                            inputError = 'Amount cannot exceed ₹${currentBalance.toStringAsFixed(0)}';
                          } else {
                            inputError = null;
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    // Quick Action Buttons
                    Row(
                      children: [
                        if (currentBalance >= 500)
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                amountController.text = '500';
                                setDialogState(() => inputError = null);
                              },
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0xFF86EFAC)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              child: const Text('₹500', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                            ),
                          ),
                        if (currentBalance >= 500) const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              amountController.text = currentBalance.toStringAsFixed(0);
                              setDialogState(() => inputError = null);
                            },
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Color(0xFF16A34A)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: Text('All (₹${currentBalance.toStringAsFixed(0)})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx, null),
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () {
                    final double? parsed = double.tryParse(amountController.text.trim());
                    if (parsed == null || parsed <= 0) {
                      setDialogState(() => inputError = 'Enter a valid amount greater than ₹0');
                      return;
                    }
                    if (parsed > currentBalance) {
                      setDialogState(() => inputError = 'Amount cannot exceed available balance ₹${currentBalance.toStringAsFixed(0)}');
                      return;
                    }
                    Navigator.pop(dialogCtx, parsed);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  child: const Text('Confirm Redeem', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );

    if (selectedAmount == null || selectedAmount <= 0) return;

    setState(() => _submittingRedeem = true);
    try {
      final dioClient = DioClient();
      final res = await dioClient.dio.post(
        '/delivery-partner/profile/referrals/redeem',
        data: {'amount': selectedAmount},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final resData = res.data is Map ? res.data['data'] : null;
        final double remainingWallet = resData != null && resData['remaining_wallet_balance'] != null
            ? double.tryParse(resData['remaining_wallet_balance'].toString()) ?? (_referralPoints - selectedAmount)
            : (_referralPoints - selectedAmount);

        if (mounted) {
          AppSnackBar.success(
            context,
            'Redeem request for ₹${selectedAmount.toStringAsFixed(0)} submitted! Remaining balance: ₹${remainingWallet.toStringAsFixed(0)}.',
          );
        }
        setState(() {
          _referralPoints = max(0.0, remainingWallet);
          _redeemStatus = 'pending';
          _submittingRedeem = false;
        });
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, 'Failed to submit redeem request. Please try again.');
      }
      setState(() => _submittingRedeem = false);
    }
  }

  @override
  void didUpdateWidget(covariant EarningsSliderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isVerified) {
      _autoSlideTimer?.cancel();
    } else if (oldWidget.isVerified && !widget.isVerified) {
      _startAutoSlideTimer();
    }
  }

  void _startAutoSlideTimer() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_pageController.hasClients && !widget.isVerified) {
        final nextPage = (_currentPage + 1) % 3;
        _pageController.animateToPage(
          nextPage,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _handleVerifyTap() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => sl<ProfileBloc>()..add(FetchProfileEvent()),
          child: const DocumentsScreen(),
        ),
      ),
    ).then((_) {
      if (mounted) {
        try {
          context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
        } catch (_) {}
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bool showPickupCard = !widget.isItemsPickedUp && widget.orders.isNotEmpty;

    final List<Widget> pages = [];

    // 1. Warehouse Collection Card (Shown FIRST in slider if pickup is pending)
    if (showPickupCard) {
      pages.add(_buildWarehouseCollectCard());
    }

    // 2. Document Status Card (Shown if not verified)
    if (!widget.isVerified) {
      pages.add(_buildDocumentStatusCard());
    }

    // 3. Referral Points & Redeem Card (Always included)
    pages.add(_buildEarningsCard());

    // If only 1 page, render single card without page dots
    if (pages.length == 1) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: pages.first,
      );
    }

    return Column(
      children: [
        SizedBox(
          height: 164,
          child: PageView(
            controller: _pageController,
            clipBehavior: Clip.none,
            onPageChanged: (index) {
              setState(() => _currentPage = index);
            },
            children: pages,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(pages.length, (index) {
            final bool isActive = index == _currentPage;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: isActive ? 18 : 6,
              height: 5,
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFF16A34A) : const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildWarehouseCollectCard() {
    final totalItems = widget.orders.fold(
      0,
      (sum, o) => sum + o.products.fold(0, (s, p) => s + p.quantity),
    );

    return Container(
      height: 160,
      margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFFFBEB), // Soft cream amber
            Color(0xFFFEF3C7),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.amber.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.antiAlias,
        children: [
          // Background Watermark Icon
          Positioned(
            right: -10,
            bottom: -10,
            child: Opacity(
              opacity: 0.08,
              child: Icon(
                Icons.warehouse_rounded,
                size: 110,
                color: Colors.amber.shade900,
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Top Row: Header & Status Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            Icons.warehouse_rounded,
                            size: 16,
                            color: Colors.amber.shade900,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Warehouse Pickup Required",
                              style: TextStyle(
                                color: Colors.amber.shade900,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              "Collect dispatch items before delivery",
                              style: TextStyle(
                                color: Colors.amber.shade800,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        "PENDING",
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                          color: Colors.amber.shade900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),

                // Middle Info Row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.inventory_2_outlined, size: 14, color: Colors.amber.shade900),
                      const SizedBox(width: 6),
                      Text(
                        '${widget.orders.length} Order${widget.orders.length == 1 ? '' : 's'} · $totalItems Total Units',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ],
                  ),
                ),

                // Bottom Action Button (Light, sleek, no heavy borders)
                SizedBox(
                  width: double.infinity,
                  height: 38,
                  child: ElevatedButton.icon(
                    onPressed: () => WarehousePickupModal.show(context, widget.orders),
                    icon: const Icon(Icons.check_circle_outline_rounded, size: 16, color: Colors.white),
                    label: const Text(
                      "Collect & Load Items to Basket",
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEarningsCard() {
    final double points = _referralPoints;
    final bool canRedeem = points >= 500.0 && _redeemStatus != 'pending';
    final bool isPending = _redeemStatus == 'pending';
    final double progress = (points / 500.0).clamp(0.0, 1.0);
    final int pointsRemaining = (500.0 - points).clamp(0.0, 500.0).toInt();

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ReferralScreen()),
        ).then((_) => _fetchReferralData());
      },
      child: Container(
        height: 160,
        margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFE2E8F0),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.antiAlias,
          children: [
            // Watermark Icon
            Positioned(
              right: 4,
              bottom: 2,
              child: Opacity(
                opacity: 0.10,
                child: Icon(
                  canRedeem ? Icons.card_giftcard_rounded : Icons.currency_rupee_rounded,
                  size: 110,
                  color: const Color(0xFF16A34A),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top Header Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFFDE68A)),
                            ),
                            child: const Icon(
                              Icons.card_giftcard_rounded,
                              size: 16,
                              color: Color(0xFFD97706),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Referral Points Gained",
                                style: TextStyle(
                                  color: Color(0xFF166534),
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              Text(
                                "₹75 / Delivered Order",
                                style: TextStyle(
                                  color: Color(0xFF15803D),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      // Invite & Earn Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              "Invite & Earn",
                              style: TextStyle(
                                color: Color(0xFF166534),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(width: 2),
                            Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF16A34A)),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Middle Value Display
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        "₹${points.toStringAsFixed(0)}",
                        style: const TextStyle(
                          color: Color(0xFF0F5132),
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.6,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        "Points",
                        style: TextStyle(
                          color: const Color(0xFF15803D).withValues(alpha: 0.9),
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      if (_totalReferrals > 0)
                        Text(
                          "$_totalReferrals Referred",
                          style: const TextStyle(
                            color: Color(0xFF166534),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),

                  // Bottom Action Area: Redeem Button OR Progress Bar
                  if (canRedeem)
                    SizedBox(
                      width: double.infinity,
                      height: 38,
                      child: ElevatedButton(
                        onPressed: _submittingRedeem ? null : _handleRedeem,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          elevation: 3,
                          shadowColor: const Color(0xFF16A34A).withValues(alpha: 0.4),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_submittingRedeem)
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            else ...[
                              const Icon(Icons.stars_rounded, size: 18, color: Color(0xFFFDE68A)),
                              const SizedBox(width: 6),
                              Text(
                                "REDEEM ₹${points.toStringAsFixed(0)} (CASH HANDOVER)",
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    )
                  else if (isPending)
                    Container(
                      width: double.infinity,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.access_time_filled_rounded, size: 16, color: Color(0xFFB45309)),
                          SizedBox(width: 6),
                          Text(
                            "REDEEM REQUESTED (PENDING HAND CASH)",
                            style: TextStyle(
                              color: Color(0xFFB45309),
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.1,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 7,
                            backgroundColor: const Color(0xFFCBD5E1),
                            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "${points.toInt()} / 500 Points",
                              style: const TextStyle(
                                color: Color(0xFF166534),
                                fontSize: 10.5,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              "Earn ₹$pointsRemaining more to Redeem",
                              style: const TextStyle(
                                color: Color(0xFF15803D),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUnverifiedCard() {
    ProfileBloc profileBloc;
    try {
      profileBloc = context.read<ProfileBloc>();
    } catch (_) {
      profileBloc = sl<ProfileBloc>()..add(FetchProfileEvent());
    }

    return BlocProvider<ProfileBloc>.value(
      value: profileBloc,
      child: BlocBuilder<ProfileBloc, ProfileState>(
        builder: (context, profileState) {
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                )
              ],
            ),
            child: Stack(
              clipBehavior: Clip.antiAlias,
              children: [
                Positioned(
                  right: -6,
                  bottom: -6,
                  child: Opacity(
                    opacity: 0.07,
                    child: const Icon(
                      Icons.verified_user_outlined,
                      size: 115,
                      color: Color(0xFFD97706),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: const BoxDecoration(
                              color: Color(0xFFFEF3C7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.shield_outlined,
                              color: Color(0xFFD97706),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Expanded(
                                      child: Text(
                                        'KYC Verification Pending',
                                        style: TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF0F172A),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: const Color(0xFFFCD34D)),
                                      ),
                                      child: const Text(
                                        'ACTION REQUIRED',
                                        style: TextStyle(
                                          fontSize: 8,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFFB45309),
                                          letterSpacing: 0.4,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Upload your ID proofs (Aadhaar / DL / PAN) to activate your rider account.',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    color: Color(0xFF475569),
                                    fontWeight: FontWeight.w500,
                                    height: 1.25,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 38,
                              child: ElevatedButton.icon(
                                onPressed: _handleVerifyTap,
                                icon: const Icon(Icons.upload_file_rounded, size: 16),
                                label: const Text(
                                  'Upload Documents Now',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.5),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF16A34A),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            height: 38,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => SupportScreen()),
                                );
                              },
                              icon: const Icon(Icons.support_agent_rounded, size: 16, color: Color(0xFF475569)),
                              label: const Text(
                                'Support',
                                style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.bold, fontSize: 11.5),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0xFFCBD5E1)),
                                padding: const EdgeInsets.symmetric(horizontal: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDocumentStatusCard() {
    ProfileBloc profileBloc;
    try {
      profileBloc = context.read<ProfileBloc>();
    } catch (_) {
      profileBloc = sl<ProfileBloc>()..add(FetchProfileEvent());
    }

    return BlocProvider<ProfileBloc>.value(
      value: profileBloc,
      child: BlocBuilder<ProfileBloc, ProfileState>(
        builder: (context, profileState) {
          int uploadedCount = 0;
          int verifiedCount = 0;
          if (profileState is ProfileLoaded) {
            uploadedCount = profileState.documents.length;
            verifiedCount = profileState.documents.where((d) => d.verificationStatus.toLowerCase() == 'verified').length;
          }

          final int totalRequired = 5;
          final int percent = ((uploadedCount / totalRequired) * 100).clamp(0, 100).toInt();

          String statusText = "$uploadedCount of $totalRequired Proofs Uploaded ($percent%)";
          if (percent == 100) {
            statusText = verifiedCount == totalRequired
                ? "100% Fully Verified"
                : "All 5 Proofs Submitted (Pending Admin Review)";
          }

          return GestureDetector(
            onTap: _handleVerifyTap,
            behavior: HitTestBehavior.opaque,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  )
                ],
              ),
              child: Stack(
                clipBehavior: Clip.antiAlias,
                children: [
                  Positioned(
                    right: -6,
                    bottom: -6,
                    child: Opacity(
                      opacity: 0.07,
                      child: const Icon(
                        Icons.description_outlined,
                        size: 115,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: const BoxDecoration(
                                color: Color(0xFFDCFCE7),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.assignment_turned_in_rounded,
                                color: Color(0xFF16A34A),
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Expanded(
                                        child: Text(
                                          'Profile Document Status',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFDCFCE7),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFF86EFAC)),
                                        ),
                                        child: Text(
                                          '$percent% DONE',
                                          style: const TextStyle(
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF15803D),
                                            letterSpacing: 0.4,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    statusText,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF475569),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: percent / 100,
                            minHeight: 6,
                            backgroundColor: const Color(0xFFF1F5F9),
                            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Row(
                          children: [
                            Text(
                              'Tap to manage Aadhaar, DL, PAN & Bank proofs',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF15803D),
                              ),
                            ),
                            Spacer(),
                            Icon(
                              Icons.arrow_forward_rounded,
                              color: Color(0xFF15803D),
                              size: 15,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

