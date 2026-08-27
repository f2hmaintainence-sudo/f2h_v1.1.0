// ═══════════════════════════════════════════════════════════════════════════
//  CHECKOUT SCREEN
//
//  Final order placement screen for One-Time Orders.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../../../../core/errors/error_handler.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../widgets/checkout_status_widget.dart';
import '../../data/models/product_model.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_state.dart';
import '../bloc/cart/cart_event.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/session/customer_session_cubit.dart';
import '../../../../core/session/customer_session_state.dart';
import '../bloc/checkout/checkout_bloc.dart';
import '../bloc/checkout/checkout_event.dart';
import '../bloc/checkout/checkout_state.dart';
import '../../domain/entities/checkout/checkout_request_entity.dart';
import '../../domain/repositories/checkout/checkout_repository.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/presentation/screens/add_address_screen.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../../address/data/models/profile_address.dart';
import '../../../../core/widgets/scrolling_items_loader.dart';
import '../../../../core/widgets/cow_loading_widget.dart';
import '../helpers/cart_helpers.dart';
import '../widgets/cart_widgets.dart';
// [ADDED BY ANTIGRAVITY FOR WALLET TOPUP]
import '../../../wallet/presentation/widgets/topup_drawer.dart';
// [ADDED BY ANTIGRAVITY FOR ONLINE PAYMENT]
import '../../../../core/payments/payment_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
//  CHECKOUT SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class CheckoutScreen extends StatefulWidget {
  final List<String>? selectedItemIds;

  const CheckoutScreen({super.key, this.selectedItemIds});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  // ===== State Variables =====

  /// Selected payment method: 'wallet', 'online', or 'cod'
  String _selectedPayment = 'wallet';

  /// Whether the user opted into donation
  bool _donating = false;

  /// Whether the order has been successfully placed (or failed checkout completed)
  bool _isOrderPlaced = false;

  /// The order ID returned from the backend
  String? _placedOrderId;

  /// Status of the placement: 'success', 'pending', or 'failed'
  String _placedStatus = 'success';

  /// Address string returned from backend
  String? _placedAddress;

  /// Error message in case of checkout failure
  String? _placedErrorMessage;

  /// Whether the checkout API call is in progress
  bool _isLoading = false;

  /// Whether the address update is in progress
  bool _isAddressLoading = false;

  /// Key to force-rebuild the SwipeToPay button after errors
  int _dragKey = 0;

  // ===== Coupon State =====

  final TextEditingController _couponController = TextEditingController();

  /// Coupon currently applied to this order, null when none is applied.
  String? _appliedCouponCode;

  /// Discount the server granted for [_appliedCouponCode], in rupees.
  double _couponDiscount = 0;

  /// Server-calculated payable amount while a coupon is applied. Falls back to
  /// the client subtotal minus [_couponDiscount] when the preview call fails.
  double? _couponPreviewTotal;

  /// Cart subtotal the applied coupon was priced against — when the customer
  /// edits quantities the coupon is re-priced against the new subtotal.
  double _couponPricedForSubtotal = 0;

  /// Rejection message from the last apply attempt.
  String? _couponError;

  bool _isCouponLoading = false;

  /// Coupons the server says this customer can use, fetched once per screen
  /// and re-priced whenever the cart subtotal moves.
  List<Map<String, dynamic>> _availableCoupons = const [];
  bool _loadingAvailableCoupons = false;
  double _couponsListedForSubtotal = -1;
  bool _couponsExpanded = true;

  // ===== Checkout Item Filtering =====

  /// Filters cart items to only include one-time items selected by the user.
  List<CartItemEntity> _getCheckoutItems(List<CartItemEntity> allItems) {
    final List<CartItemEntity> checkoutItems = [];
    if (widget.selectedItemIds != null && widget.selectedItemIds!.isNotEmpty) {
      for (final key in widget.selectedItemIds!) {
        final variantId = key.endsWith('_once')
            ? key.substring(0, key.length - 5)
            : (key.endsWith('_sub') ? key.substring(0, key.length - 4) : key);
        final matches = allItems
            .where(
              (i) =>
                  i.variantId == variantId ||
                  '${i.variantId}_once' == key ||
                  '${i.variantId}_sub' == key ||
                  i.variantId == key,
            )
            .toList();
        if (matches.isNotEmpty) {
          checkoutItems.add(matches.first);
        }
      }
    }

    if (checkoutItems.isEmpty) {
      checkoutItems.addAll(allItems);
    }
    return checkoutItems;
  }

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<CustomerSessionCubit>().refreshSilently();
      }
    });
  }

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  // ===== Coupon Handling =====

  Future<void> _loadAvailableCoupons(double subtotal) async {
    if (_loadingAvailableCoupons) return;
    setState(() => _loadingAvailableCoupons = true);

    try {
      final coupons = await sl<CheckoutRepository>().getAvailableCoupons(
        subtotal,
      );
      if (!mounted) return;
      final eligibleOnly = coupons.where((c) => c['eligible'] != false).toList();
      setState(() {
        _availableCoupons = eligibleOnly;
        _couponsListedForSubtotal = subtotal;
      });
    } catch (_) {
      if (mounted && _availableCoupons.isNotEmpty) {
        setState(() => _availableCoupons = const []);
      }
    } finally {
      if (mounted) {
        setState(() => _loadingAvailableCoupons = false);
      }
    }
  }

  /// Fetches the coupon list on first build and after the subtotal changes.
  void _refreshAvailableCouponsIfNeeded(double subtotal) {
    if ((subtotal - _couponsListedForSubtotal).abs() < 0.01 && _availableCoupons.isNotEmpty) return;
    if (_loadingAvailableCoupons) return;
    _couponsListedForSubtotal = subtotal;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadAvailableCoupons(subtotal);
    });
  }

  String? _defaultAddressId() {
    final list = context.read<CustomerSessionCubit>().state.addresses;
    if (list.isEmpty) return null;
    return list
        .firstWhere((a) => a.isDefault, orElse: () => list.first)
        .id
        ?.toString();
  }

  /// Validates the typed code and, when the server accepts it, re-prices the
  /// whole order so the summary shows what will actually be charged.
  Future<void> _applyCoupon(
    List<CartItemEntity> checkoutItems,
    double subtotal,
    String userId,
  ) async {
    final code = _couponController.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _couponError = 'Enter a coupon code');
      return;
    }

    setState(() {
      _isCouponLoading = true;
      _couponError = null;
    });

    try {
      final repository = sl<CheckoutRepository>();
      final result = await repository.validateCoupon(
        couponCode: code,
        subtotal: subtotal,
      );

      if (!mounted) return;

      final isValid = result['valid'] == true;
      if (!isValid) {
        setState(() {
          _isCouponLoading = false;
          _appliedCouponCode = null;
          _couponDiscount = 0;
          _couponPreviewTotal = null;
          _couponError =
              result['message']?.toString() ?? 'This coupon cannot be applied';
        });
        return;
      }

      double discount = _toDouble(result['discount_preview']);
      double? previewTotal;

      // Authoritative pricing — also folds in any auto-applied promotions.
      try {
        final preview = await repository.previewDiscounts(
          CheckoutRequestEntity(
            userId: userId,
            items: checkoutItems,
            addressId: _defaultAddressId(),
            paymentMethod: _selectedPayment,
            paymentType: _selectedPayment == 'cod' ? 'postpaid' : 'prepaid',
            couponCode: code,
          ),
        );
        final summary = preview['coupon_summary'];
        if (summary is Map && summary['coupon_discount'] != null) {
          discount = _toDouble(summary['coupon_discount']);
        } else if (preview['discount_amount'] != null) {
          discount = _toDouble(preview['discount_amount']);
        }
        if (preview['total_amount'] != null) {
          previewTotal = _toDouble(preview['total_amount']);
        }
      } catch (_) {
        // Preview is an optimisation; the validated discount still stands and
        // the server recalculates everything at checkout anyway.
      }

      if (!mounted) return;
      setState(() {
        _isCouponLoading = false;
        _appliedCouponCode = code;
        _couponDiscount = discount;
        _couponPreviewTotal = previewTotal;
        _couponPricedForSubtotal = subtotal;
        _couponError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isCouponLoading = false;
        _couponError = extractErrorMessage(
          e,
          fallback: 'Could not apply the coupon. Please try again.',
        );
      });
    }
  }

  Future<void> _applyListedCoupon(
    String code,
    List<CartItemEntity> checkoutItems,
    double subtotal,
    String customerId,
  ) {
    _couponController.text = code;
    return _applyCoupon(checkoutItems, subtotal, customerId);
  }

  void _removeCoupon() {
    setState(() {
      _appliedCouponCode = null;
      _couponDiscount = 0;
      _couponPreviewTotal = null;
      _couponPricedForSubtotal = 0;
      _couponError = null;
      _couponController.clear();
    });
  }

  /// Re-prices the applied coupon after the cart subtotal changes.
  void _repriceCouponIfNeeded(
    List<CartItemEntity> checkoutItems,
    double subtotal,
    String userId,
  ) {
    if (_appliedCouponCode == null || _isCouponLoading) return;
    if ((subtotal - _couponPricedForSubtotal).abs() < 0.01) return;

    _couponPricedForSubtotal = subtotal;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _appliedCouponCode == null) return;
      _couponController.text = _appliedCouponCode!;
      _applyCoupon(checkoutItems, subtotal, userId);
    });
  }

  static double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  // ===== Price Calculation =====

  double _calculateSubtotal(List<CartItemEntity> checkoutItems) {
    return calculateOneTimeTotal(checkoutItems);
  }

  /// Subtotal after the applied coupon. Prefers the server's preview total so
  /// what is shown matches what the checkout API will charge.
  double _payableFor(double subtotal) {
    if (_appliedCouponCode == null) return subtotal;
    final total = _couponPreviewTotal ?? (subtotal - _couponDiscount);
    return total < 0 ? 0 : total;
  }

  // ===== Order Placement =====

  void _placeOrder(
    double grandTotal,
    List<CartItemEntity> checkoutItems,
    String userId,
    String? addressId, {
    String? razorpayOrderId,
    String? razorpayPaymentId,
    String? razorpaySignature,
  }) {
    final paymentMethod = _selectedPayment;
    final paymentType = _selectedPayment == 'cod' ? 'postpaid' : 'prepaid';

    final request = CheckoutRequestEntity(
      userId: userId,
      items: checkoutItems,
      addressId: addressId,
      paymentMethod: paymentMethod,
      paymentType: paymentType,
      couponCode: _appliedCouponCode,
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature,
    );

    context.read<CheckoutBloc>().add(PlaceCheckoutEvent(request));
  }

  /// For online (Razorpay) payments: open the payment sheet, then submit checkout
  /// with the verified payment identifiers. Falls back gracefully on cancel/failure.
  Future<void> _handleOnlinePaymentAndCheckout({
    required double grandTotal,
    required List<CartItemEntity> checkoutItems,
    required String userId,
    required String? addressId,
  }) async {
    setState(() => _isLoading = true);

    final result = await PaymentService.instance.payForOrder(
      amount: grandTotal,
      notes: {'customer_id': userId, 'purpose': 'order_checkout'},
    );

    if (!mounted) return;

    if (result.cancelled) {
      setState(() => _isLoading = false);
      F2HToast.show(context, 'Payment cancelled');
      setState(() => _dragKey++);
      return;
    }

    if (!result.success) {
      setState(() {
        _isLoading = false;
        _dragKey++;
      });
      F2HToast.error(
        context,
        result.message.isNotEmpty ? result.message : 'Payment failed. Please try again.',
      );
      return;
    }

    // Payment succeeded — pass the Razorpay IDs to the checkout API for
    // server-side verification before the order is written.
    _placeOrder(
      grandTotal,
      checkoutItems,
      userId,
      addressId,
      razorpayOrderId: result.razorpayOrderId,
      razorpayPaymentId: result.razorpayPaymentId,
      razorpaySignature: result.razorpaySignature,
    );
  }

  @override
  Widget build(BuildContext context) {
    // ===== Order/Checkout Finished State (Success/Pending/Failed) =====
    if (_isOrderPlaced) {
      String? addressText = _placedAddress;
      if (addressText == null || addressText.isEmpty) {
        final sessionState = context.read<CustomerSessionCubit>().state;
        if (sessionState.addresses.isNotEmpty) {
          final primaryAddress = sessionState.addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => sessionState.addresses.first,
          );
          addressText =
              '${primaryAddress.addressType.toUpperCase()} · ${primaryAddress.name}, ${primaryAddress.detail}';
        }
      }
      return CheckoutStatusWidget(
        onDone: () {
          if (mounted) Navigator.pop(context);
        },
        status: _placedStatus,
        deliveryAddress: addressText,
        orderId: _placedOrderId,
        errorMessage: _placedErrorMessage,
      );
    }

    return BlocListener<CheckoutBloc, CheckoutState>(
      listener: (context, checkoutState) {
        if (checkoutState is CheckoutLoadingState) {
          setState(() {
            _isLoading = true;
          });
        } else if (checkoutState is CheckoutSuccessState) {
          // ===== Order Success Handling =====
          final allItems =
              (context.read<CartBloc>().state as CartLoadedState).items;
          final checkoutItems = _getCheckoutItems(allItems);

          final backendStatus =
              checkoutState.responseData['status']?.toString() ?? 'success';
          final backendId = checkoutState.responseData['id']?.toString();
          final backendAddress = checkoutState.responseData['address']
              ?.toString();

          setState(() {
            _isLoading = false;
            _isOrderPlaced = true;
            _placedStatus = backendStatus;
            _placedOrderId = backendId;
            _placedAddress = backendAddress;
          });

          // Deduct wallet balance client-side for immediate UI feedback
          final double subtotal = _calculateSubtotal(checkoutItems);
          final double grandTotal = _payableFor(subtotal);

          if (_selectedPayment == 'wallet') {
            context.read<CustomerSessionCubit>().deductWallet(grandTotal);
          }

          // Remove checked-out items from the cart
          final bloc = context.read<CartBloc>();
          final cartState = bloc.state;
          if (cartState is CartLoadedState) {
            final List<CartItemEntity> remainingItems = List.from(
              cartState.items,
            );
            if (widget.selectedItemIds != null &&
                widget.selectedItemIds!.isNotEmpty) {
              for (final key in widget.selectedItemIds!) {
                final variantId = key.endsWith('_once')
                    ? key.substring(0, key.length - 5)
                    : (key.endsWith('_sub')
                          ? key.substring(0, key.length - 4)
                          : key);
                remainingItems.removeWhere(
                  (item) =>
                      item.variantId == variantId ||
                      '${item.variantId}_once' == key ||
                      '${item.variantId}_sub' == key ||
                      item.variantId == key,
                );
              }
            } else {
              remainingItems.clear();
            }
            bloc.add(SyncCartEvent(remainingItems));
          }
        } else if (checkoutState is CheckoutErrorState) {
          setState(() {
            _isLoading = false;
            _dragKey++;
            _isOrderPlaced = true;
            _placedStatus = 'failed';
            _placedOrderId = null;
            _placedAddress = null;
            _placedErrorMessage = checkoutState.message;
          });
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          title: const Text(
            'Checkout',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: kText,
            ),
          ),
          centerTitle: true,
          backgroundColor: kSurface,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close, color: kText),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Stack(
          children: [
            BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
              builder: (context, sessionState) {
                final walletBalance =
                    sessionState.profile?.walletBalance ?? 0.0;

                return BlocBuilder<CartBloc, CartState>(
                  builder: (context, state) {
                    if (state is! CartLoadedState) {
                      return const Center(child: ScrollingItemsLoader());
                    }

                    final allItems = state.items;
                    final checkoutItems = _getCheckoutItems(allItems);

                    if (checkoutItems.isEmpty) {
                      return const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.shopping_cart_outlined,
                              size: 54,
                              color: kMuted,
                            ),
                            SizedBox(height: 12),
                            Text(
                              'No items selected for checkout',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: kMuted,
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    // ===== Bill Calculations =====
                    final double deliveryFee = 0.0;
                    final double taxes = 0.0;
                    final double donation = 0.0;

                    final double onetimeTotal = calculateOneTimeTotal(
                      checkoutItems,
                    );
                    final double subtotal = onetimeTotal;
                    final String customerId =
                        sessionState.profile?.customerId ?? '';

                    // Quantities can change on this screen — keep the coupon priced
                    // against what is actually in the order.
                    _repriceCouponIfNeeded(checkoutItems, subtotal, customerId);
                    _refreshAvailableCouponsIfNeeded(subtotal);

                    final double payableItems = _payableFor(subtotal);
                    final double couponSavings = subtotal - payableItems;
                    final double grandTotal =
                        payableItems + deliveryFee + taxes + donation;
                    final double payableNow = grandTotal;

                    return Column(
                      children: [
                        Expanded(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // ===== Delivery Address =====
                                BlocBuilder<
                                  CustomerSessionCubit,
                                  CustomerSessionState
                                >(
                                  builder: (context, sessionState) {
                                    final list = sessionState.addresses;
                                    final isEmpty = list.isEmpty;

                                    if (isEmpty) {
                                      return Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: BoxDecoration(
                                          color: kSurface,
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          border: Border.all(
                                            color: kRed.withOpacity(0.4),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(
                                              Icons.location_off_outlined,
                                              size: 24,
                                              color: kRed,
                                            ),
                                            const SizedBox(width: 14),
                                            const Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    'No Delivery Address',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color: kRed,
                                                    ),
                                                  ),
                                                  SizedBox(height: 2),
                                                  Text(
                                                    'Please add a delivery address to complete your order.',
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: kText,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            TextButton(
                                              onPressed: () {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (_) =>
                                                        const AddAddressScreen(),
                                                  ),
                                                );
                                              },
                                              child: const Text(
                                                'Add',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w800,
                                                  color: kPrimary,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }

                                    final primaryAddress = list.firstWhere(
                                      (a) => a.isDefault,
                                      orElse: () => list.first,
                                    );

                                    if (_isAddressLoading) {
                                      return Container(
                                        padding: const EdgeInsets.all(24),
                                        decoration: BoxDecoration(
                                          color: kSurface,
                                          borderRadius: BorderRadius.circular(
                                            24,
                                          ),
                                          border: Border.all(color: kBorder),
                                        ),
                                        child: const Center(
                                          child: SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    kPrimary,
                                                  ),
                                            ),
                                          ),
                                        ),
                                      );
                                    }

                                    return Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: kSurface,
                                        borderRadius: BorderRadius.circular(24),
                                        border: Border.all(color: kBorder),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(
                                            Icons.location_on_outlined,
                                            size: 24,
                                            color: kPrimary,
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Delivery to ${primaryAddress.addressType.toUpperCase()}',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w600,
                                                    color: kMuted,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  primaryAddress.name,
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w800,
                                                    color: kText,
                                                  ),
                                                ),
                                                Text(
                                                  primaryAddress.detail,
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: kTextSub,
                                                  ),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          TextButton(
                                            onPressed: () async {
                                              final AddressModel? selectedAddress = await AddressSelectorDrawer.show(context);
                                              if (selectedAddress != null && context.mounted) {
                                                setState(() {
                                                  _isAddressLoading = true;
                                                });
                                                try {
                                                  final sessionCubit = context.read<CustomerSessionCubit>();
                                                  final addrId = (selectedAddress.addressId != null && selectedAddress.addressId!.isNotEmpty)
                                                      ? selectedAddress.addressId!
                                                      : ((selectedAddress.id != null && selectedAddress.id!.isNotEmpty) ? selectedAddress.id! : selectedAddress.uniqueId);
                                                  await sessionCubit.updateDefaultAddress(addrId);
                                                  if (context.mounted) {
                                                    F2HToast.success(
                                                      context,
                                                      'Address updated successfully',
                                                    );
                                                  }
                                                } catch (e) {
                                                  if (context.mounted) {
                                                    F2HToast.error(
                                                      context,
                                                      extractErrorMessage(e),
                                                    );
                                                  }
                                                } finally {
                                                  if (context.mounted) {
                                                    setState(() {
                                                      _isAddressLoading = false;
                                                    });
                                                  }
                                                }
                                              }
                                            },
                                            child: const Text(
                                              'Change',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w800,
                                                color: kPrimary,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(height: 16),

                                // ===== Order Items =====
                                Container(
                                  decoration: BoxDecoration(
                                    color: kSurface,
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(color: kBorder),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Padding(
                                        padding: EdgeInsets.fromLTRB(
                                          16,
                                          16,
                                          16,
                                          8,
                                        ),
                                        child: Text(
                                          'Items in Cart',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w800,
                                            color: kText,
                                          ),
                                        ),
                                      ),
                                      const Divider(color: kBorderLt),
                                      ListView.separated(
                                        shrinkWrap: true,
                                        physics:
                                            const NeverScrollableScrollPhysics(),
                                        itemCount: checkoutItems.length,
                                        separatorBuilder: (_, __) =>
                                            const Divider(
                                              color: kBorderLt,
                                              height: 1,
                                            ),
                                        itemBuilder: (context, index) {
                                          final item = checkoutItems[index];
                                          // Use getEffectivePrice for consistent pricing
                                          final effectivePrice =
                                              getEffectivePrice(item);
                                          final p = getProductById(
                                            item.variantId,
                                            name: item.productName,
                                            variantName: item.variantName,
                                            price: effectivePrice,
                                            imageAsset: item.imageAsset,
                                          );
                                          final qty = getItemQuantity(item);
                                          final displayPrice = effectivePrice;
                                          return Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                            child: LayoutBuilder(
                                              builder: (ctx, cst) {
                                                // ponytail: scale for 320-430+ screens
                                                final s = (cst.maxWidth / 340)
                                                    .clamp(0.8, 1.15);
                                                return Row(
                                                  children: [
                                                    Container(
                                                      width: 50 * s,
                                                      height: 50 * s,
                                                      decoration: BoxDecoration(
                                                        color: Colors.white,
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              10,
                                                            ),
                                                        border: Border.all(
                                                          color: kBorderLt,
                                                          width: 1,
                                                        ),
                                                      ),
                                                      child: ClipRRect(
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              9,
                                                            ),
                                                        child: Padding(
                                                          padding:
                                                              const EdgeInsets.all(
                                                                2,
                                                              ),
                                                          child:
                                                              buildProductImage(
                                                                p.name,
                                                                imageAsset: p
                                                                    .imageAsset,
                                                                fit: BoxFit
                                                                    .contain,
                                                              ),
                                                        ),
                                                      ),
                                                    ),
                                                    SizedBox(width: 10 * s),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Text(
                                                            p.name,
                                                            style: TextStyle(
                                                              fontSize: 12 * s,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w700,
                                                              color: kText,
                                                            ),
                                                            maxLines: 1,
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                          ),
                                                          Text(
                                                            '${p.unit} · ₹${displayPrice.toStringAsFixed(0)}',
                                                            style: TextStyle(
                                                              fontSize: 12 * s,
                                                              fontWeight: FontWeight.w700,
                                                              color: kPrimary,
                                                            ),
                                                            maxLines: 1,
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    SizedBox(width: 6 * s),
                                                    SizedBox(
                                                      width: 70 * s,
                                                      child: Align(
                                                        alignment: Alignment
                                                            .centerRight,
                                                        child:
                                                            _buildCheckoutItemCounter(
                                                              item,
                                                            ),
                                                      ),
                                                    ),
                                                    SizedBox(width: 6 * s),
                                                    Text(
                                                      '₹${(displayPrice * qty).toStringAsFixed(0)}',
                                                      style: TextStyle(
                                                        fontSize: 16 * s,
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        color: kText,
                                                      ),
                                                    ),
                                                  ],
                                                );
                                              },
                                            ),
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // ===== Payment Method =====
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: kSurface,
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(color: kBorder),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Payment Method',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: kText,
                                        ),
                                      ),
                                      const SizedBox(height: 14),
                                      _buildPaymentOption(
                                        id: 'online',
                                        icon: Icons.bolt_rounded,
                                        title: 'Instant UPI & Online Payment',
                                        subtitle:
                                            'Google Pay, PhonePe, Paytm, BHIM, Cards & NetBanking',
                                        badgeText: 'FAST & SECURE',
                                        badgeColor: const Color(0xFF16A34A),
                                      ),
                                      const SizedBox(height: 10),
                                      _buildPaymentOption(
                                        id: 'wallet',
                                        icon: Icons.account_balance_wallet_outlined,
                                        title:
                                            'F2H Wallet (₹${walletBalance.toStringAsFixed(2)} available)',
                                        subtitle: grandTotal <= walletBalance
                                            ? 'Sufficient balance'
                                            : 'Insufficient balance (Top-up required)',
                                        disabled: grandTotal > walletBalance,
                                      ),
                                      const SizedBox(height: 10),
                                      _buildPaymentOption(
                                        id: 'cod',
                                        icon: Icons.payments_outlined,
                                        title: 'Cash on Delivery (COD)',
                                        subtitle:
                                            'Pay cash or Scan UPI on delivery',
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // ===== Coupon =====
                                _buildCouponCard(
                                  checkoutItems,
                                  subtotal,
                                  customerId,
                                ),
                                const SizedBox(height: 16),

                                // ===== Bill Summary =====
                                SectionCard(
                                  borderRadius: 24,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Order Summary',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: kText,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      if (checkoutItems.isNotEmpty &&
                                          checkoutItems.first.deliveryDate !=
                                              null) ...[
                                        SummaryRow(
                                          label: 'Delivery Date',
                                          value:
                                              checkoutItems.first.deliveryDate!,
                                        ),
                                        const SizedBox(height: 4),
                                      ],
                                      if (checkoutItems.isNotEmpty &&
                                          checkoutItems.first.deliverySlot !=
                                              null) ...[
                                        SummaryRow(
                                          label: 'Delivery Slot',
                                          value:
                                              checkoutItems.first.deliverySlot!,
                                        ),
                                        const SizedBox(height: 4),
                                      ],
                                      SummaryRow(
                                        label: 'Total Items',
                                        value:
                                            '${checkoutItems.fold<int>(0, (sum, i) => sum + (i.quantity ?? 1))}',
                                      ),
                                      const Divider(
                                        color: kBorderLt,
                                        height: 16,
                                      ),
                                      SummaryRow(
                                        label: 'Item Total',
                                        value:
                                            '₹${onetimeTotal.toStringAsFixed(0)}',
                                      ),
                                      if (_appliedCouponCode != null) ...[
                                        const SizedBox(height: 8),
                                        SummaryRow(
                                          label: 'Coupon ($_appliedCouponCode)',
                                          value:
                                              '-₹${couponSavings.toStringAsFixed(0)}',
                                          valueColor: kPrimaryLt,
                                        ),
                                      ],
                                      const SizedBox(height: 8),
                                      const SummaryRow(
                                        label: 'Delivery Fee',
                                        value: '₹39',
                                      ),
                                      const SizedBox(height: 8),
                                      const SummaryRow(
                                        label: 'Delivery Discount',
                                        value: '-₹39',
                                        valueColor: kPrimaryLt,
                                      ),
                                      const SizedBox(height: 8),
                                      const SummaryRow(
                                        label: 'Taxes & Handling Charges',
                                        value: '₹0',
                                      ),
                                      if (_donating) ...[
                                        const SizedBox(height: 8),
                                        const SummaryRow(
                                          label: 'Feeding India Donation',
                                          value: '₹2',
                                        ),
                                      ],
                                      const Divider(
                                        color: kBorderLt,
                                        height: 24,
                                      ),
                                      SummaryRow(
                                        label: 'To Pay',
                                        value:
                                            '₹${payableNow.toStringAsFixed(0)}',
                                        isBold: true,
                                        fontSize: 16,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 30),
                              ],
                            ),
                          ),
                        ),

                        // ===== Swipe to Pay =====
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                          decoration: BoxDecoration(
                            color: kSurface,
                            border: const Border(
                              top: BorderSide(color: kBorder),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: kPrimary.withOpacity(0.04),
                                blurRadius: 16,
                                offset: const Offset(0, -4),
                              ),
                            ],
                          ),
                          child: SafeArea(
                            child: SlideToPayButton(
                              key: ValueKey(_dragKey),
                              disabled:
                                  _selectedPayment == 'wallet' &&
                                  payableNow > walletBalance,
                              onSwipeCompleted: () {
                                final list = sessionState.addresses;
                                final addressId = list.isEmpty
                                    ? null
                                    : list
                                          .firstWhere(
                                            (a) => a.isDefault,
                                            orElse: () => list.first,
                                          )
                                          .id
                                          ?.toString();
                                final customerId =
                                    sessionState.profile?.customerId ?? '';

                                if (_selectedPayment == 'online' ||
                                    _selectedPayment == 'upi') {
                                  _handleOnlinePaymentAndCheckout(
                                    grandTotal: grandTotal,
                                    checkoutItems: checkoutItems,
                                    userId: customerId,
                                    addressId: addressId,
                                  );
                                } else {
                                  _placeOrder(
                                    grandTotal,
                                    checkoutItems,
                                    customerId,
                                    addressId,
                                  );
                                }
                              },
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
            if (_isLoading)
              const Positioned.fill(
                child: CowLoadingOverlay(message: 'Placing your order...'),
              ),
          ],
        ),
      ),
    );
  }

  // ===== Coupon Widget =====

  Widget _buildCouponCard(
    List<CartItemEntity> checkoutItems,
    double subtotal,
    String customerId,
  ) {
    final applied = _appliedCouponCode != null;
    final eligibleCoupons = _availableCoupons
        .where((c) => c['eligible'] != false)
        .toList();

    return SectionCard(
      borderRadius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_offer_outlined, size: 18, color: kPrimary),
              const SizedBox(width: 8),
              const Text(
                'Coupon',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
              const Spacer(),
              if (applied && _couponDiscount > 0)
                Text(
                  'You saved ₹${_couponDiscount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: kPrimary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (applied)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: kPrimary.withValues(alpha: 0.45)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, size: 18, color: kPrimary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _appliedCouponCode!,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Coupon applied to this order',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: kTextSub,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: _isCouponLoading ? null : _removeCoupon,
                    style: TextButton.styleFrom(
                      minimumSize: const Size(0, 32),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Remove',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: kRed,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _couponController,
                    enabled: !_isCouponLoading,
                    textCapitalization: TextCapitalization.characters,
                    onSubmitted: (_) =>
                        _applyCoupon(checkoutItems, subtotal, customerId),
                    onChanged: (_) {
                      if (_couponError != null) {
                        setState(() => _couponError = null);
                      }
                    },
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: kText,
                      letterSpacing: 0.5,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Enter coupon code',
                      hintStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: kMuted,
                        letterSpacing: 0,
                      ),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 13,
                      ),
                      filled: true,
                      fillColor: kBg,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: kBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: kPrimary,
                          width: 1.4,
                        ),
                      ),
                      disabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: kBorder),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: _isCouponLoading
                        ? null
                        : () =>
                              _applyCoupon(checkoutItems, subtotal, customerId),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      disabledBackgroundColor: kPrimary.withValues(alpha: 0.5),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _isCouponLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Apply',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          if (!applied && _loadingAvailableCoupons && eligibleCoupons.isEmpty) ...[
            const SizedBox(height: 12),
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                ),
              ),
            ),
          ] else if (!applied && eligibleCoupons.isNotEmpty) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () {
                setState(() => _couponsExpanded = !_couponsExpanded);
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                child: Row(
                  children: [
                    const Icon(
                      Icons.local_offer_outlined,
                      size: 13,
                      color: kPrimary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'AVAILABLE FOR YOU (${eligibleCoupons.length})',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: kTextSub,
                        letterSpacing: 0.6,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _couponsExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 18,
                      color: kTextSub,
                    ),
                  ],
                ),
              ),
            ),
            if (_couponsExpanded) ...[
              const SizedBox(height: 8),
              for (final coupon in eligibleCoupons)
                _buildCouponOffer(coupon, checkoutItems, subtotal, customerId),
            ],
          ],
          if (_couponError != null) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline, size: 14, color: kRed),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _couponError!,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: kRed,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// One row in the "available for you" list. Ineligible coupons stay visible
  /// but muted, showing how much more the customer needs to spend.
  Widget _buildCouponOffer(
    Map<String, dynamic> coupon,
    List<CartItemEntity> checkoutItems,
    double subtotal,
    String customerId,
  ) {
    final code = coupon['code']?.toString() ?? '';
    final eligible = coupon['eligible'] != false;
    final discount = _toDouble(coupon['discount_preview']);
    final reason = coupon['reason']?.toString();
    final title = coupon['name']?.toString();
    final description = coupon['description']?.toString();
    final label = coupon['label']?.toString();

    final subtitle = !eligible && reason != null && reason.isNotEmpty
        ? reason
        : (description != null && description.isNotEmpty
              ? description
              : (title ?? ''));

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Opacity(
        opacity: eligible ? 1 : 0.6,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: kBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: eligible ? kPrimary.withValues(alpha: 0.3) : kBorder,
              style: BorderStyle.solid,
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: eligible
                      ? kPrimary.withValues(alpha: 0.1)
                      : kMuted.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: eligible
                        ? kPrimary.withValues(alpha: 0.45)
                        : kBorder,
                  ),
                ),
                child: Text(
                  code,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.6,
                    color: eligible ? kPrimary : kTextSub,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eligible && discount > 0
                          ? 'Save ₹${discount.toStringAsFixed(0)}'
                          : (label != null && label.isNotEmpty
                                ? label
                                : (title ?? '')),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                          color: kTextSub,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: eligible && !_isCouponLoading
                    ? () => _applyListedCoupon(
                        code,
                        checkoutItems,
                        subtotal,
                        customerId,
                      )
                    : null,
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 30),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'APPLY',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.4,
                    color: eligible ? kPrimary : kMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===== Payment Option Widget =====

  Widget _buildPaymentOption({
    required String id,
    required IconData icon,
    required String title,
    required String subtitle,
    bool disabled = false,
    String? badgeText,
    Color? badgeColor,
  }) {
    final isSelected = _selectedPayment == id;
    // [ADDED BY ANTIGRAVITY FOR WALLET TOPUP] Show Top-up button if it is the wallet option and has insufficient balance
    final showTopupBtn = id == 'wallet' && disabled;

    return GestureDetector(
      onTap: disabled
          ? null
          : () {
              setState(() {
                _selectedPayment = id;
              });
            },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? kPrimaryPl.withOpacity(0.4)
              : kBgDeep.withOpacity(0.6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? kPrimary : kBorder,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Opacity(
              opacity: disabled ? 0.5 : 1.0,
              child: Icon(
                icon,
                color: isSelected ? kPrimary : kTextSub,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Opacity(
                opacity: disabled ? 0.5 : 1.0,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: disabled ? kMuted : kText,
                            ),
                          ),
                        ),
                        if (badgeText != null) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: (badgeColor ?? kPrimary).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              badgeText,
                              style: TextStyle(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w800,
                                color: badgeColor ?? kPrimary,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 10,
                        color: isSelected ? kPrimaryMid : kTextSub,
                        fontWeight: isSelected
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (showTopupBtn)
              ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.white,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                    ),
                    builder: (_) => const TopupDrawer(),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Top-up',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              )
            else
              Opacity(
                opacity: disabled ? 0.5 : 1.0,
                child: Icon(
                  isSelected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color: isSelected ? kPrimary : kMuted,
                  size: 18,
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ===== Checkout Item Counter =====

  /// Item counter for one-time order items.
  Widget _buildCheckoutItemCounter(CartItemEntity item) {
    int qty = item.quantity ?? 1;

    return QuantityCounter(
      quantity: qty,
      width: 80,
      onDecrement: () {
        context.read<CartBloc>().add(
          RemoveFromCartEvent(item.copyWith(quantity: 1)),
        );
      },
      onIncrement: () {
        context.read<CartBloc>().add(
          AddToCartEvent(item.copyWith(quantity: 1)),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SLIDE TO PAY BUTTON
//
//  A swipe-to-confirm button that triggers order placement.
//  Shows a draggable circle that must be swiped to 85% to confirm.
//  Disabled state shows a locked button with "Insufficient Balance" text.
// ═══════════════════════════════════════════════════════════════════════════

class SlideToPayButton extends StatefulWidget {
  final VoidCallback onSwipeCompleted;
  final bool disabled;
  const SlideToPayButton({
    required this.onSwipeCompleted,
    this.disabled = false,
    super.key,
  });

  @override
  State<SlideToPayButton> createState() => _SlideToPayButtonState();
}

class _SlideToPayButtonState extends State<SlideToPayButton> {
  double _dragValue = 0.0;
  bool _isFinished = false;

  @override
  Widget build(BuildContext context) {
    // ===== Disabled State =====
    if (widget.disabled) {
      return Container(
        height: 56,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            const Center(
              child: Text(
                'INSUFFICIENT WALLET BALANCE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: kTextSub,
                  letterSpacing: 0.8,
                ),
              ),
            ),
            Positioned(
              left: 0,
              child: Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: kTextSub,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.lock_outline_rounded,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      );
    }

    // ===== Active Swipe Button =====
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        const buttonWidth = 56.0;
        final maxDrag = maxWidth - buttonWidth;

        return Container(
          height: 56,
          decoration: BoxDecoration(
            color: kPrimaryPl,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: kPrimary.withOpacity(0.12)),
          ),
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              Center(
                child: Text(
                  _isFinished ? 'PLACING ORDER...' : 'SWIPE TO PAY ➔',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: kPrimary,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              Positioned(
                left: _dragValue,
                child: GestureDetector(
                  onHorizontalDragUpdate: (details) {
                    if (_isFinished) return;
                    setState(() {
                      _dragValue += details.delta.dx;
                      if (_dragValue < 0) _dragValue = 0;
                      if (_dragValue > maxDrag) _dragValue = maxDrag;
                    });
                  },
                  onHorizontalDragEnd: (details) {
                    if (_isFinished) return;
                    // Threshold: must swipe at least 85% to confirm
                    if (_dragValue >= maxDrag * 0.85) {
                      setState(() {
                        _dragValue = maxDrag;
                        _isFinished = true;
                      });
                      widget.onSwipeCompleted();
                    } else {
                      // Snap back to start
                      setState(() {
                        _dragValue = 0.0;
                      });
                    }
                  },
                  child: Container(
                    width: buttonWidth,
                    height: 56,
                    decoration: const BoxDecoration(
                      color: kPrimary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_forward, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
