// ═══════════════════════════════════════════════════════════════════════════
//  CHECKOUT SCREEN
//
//  Final order placement screen. Displays:
//    • Delivery address with change option
//    • Order items summary with quantities
//    • Subscription billing configuration (if subscription items exist)
//    • Payment method selection
//    • Bill summary with separate one-time and subscription totals
//    • Swipe-to-pay confirmation
//
//  BUSINESS RULES:
//    • Subscription items ALWAYS use variant.subscription_price
//    • One-time items ALWAYS use variant.price (normal selling price)
//    • Subscription Payment Type (Prepaid/Postpaid) is managed HERE, not in Cart
//    • Order success shows Order ID for one-time, Subscription ID for subscriptions
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/checkout_status_widget.dart';
import 'package:f2h_customer/core/widgets/custom_date_picker.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_state.dart';
import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';
import 'package:f2h_customer/features/address/presentation/widgets/address_selector_drawer.dart';
import 'package:f2h_customer/features/address/presentation/screens/add_address_screen.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/cart_widgets.dart';
// [ADDED BY ANTIGRAVITY FOR WALLET TOPUP]
import 'package:f2h_customer/features/wallet/presentation/widgets/topup_drawer.dart';

// ═══════════════════════════════════════════════════════════════════════════
//  CHECKOUT SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class CheckoutScreen extends StatefulWidget {
  final List<String>? selectedItemIds;
  final String? subscriptionFrequency;

  /// Kept for backward compatibility but Checkout now manages its own payment type.
  final String? subscriptionPaymentType;

  const CheckoutScreen({
    super.key,
    this.selectedItemIds,
    this.subscriptionFrequency,
    this.subscriptionPaymentType,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  // ===== State Variables =====

  /// Selected payment method: 'wallet', 'upi', or 'cod'
  String _selectedPayment = 'wallet';

  /// Subscription payment type: 'prepaid' or 'postpaid'
  /// Managed internally by Checkout (not passed from Cart).
  String _selectedPaymentType = 'prepaid';

  /// Whether the user opted into donation
  bool _donating = false;

  /// Whether the order has been successfully placed (or failed checkout completed)
  bool _isOrderPlaced = false;

  /// Whether the placed order was a subscription
  bool _placedIsSubscription = false;

  /// The order/subscription ID returned from the backend
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

  /// Subscription start date (defaults to today)
  DateTime? _subscriptionStartDate;

  /// Subscription end date (defaults to end of current month)
  DateTime? _subscriptionEndDate;

  /// Whether the subscription auto-renews monthly
  bool _autoRenew = true;

  // ===== Checkout Item Filtering =====

  /// Filters cart items to only include items selected by the user.
  /// Handles both one-time and subscription item keys.
  List<CartItemEntity> _getCheckoutItems(List<CartItemEntity> allItems) {
    final List<CartItemEntity> checkoutItems = [];
    if (widget.selectedItemIds != null) {
      for (final key in widget.selectedItemIds!) {
        final parts = key.split('_');
        if (parts.length < 2) continue;
        final variantId = parts[0];
        final type = parts[1]; // 'once' or 'sub'

        // Find the best matching item from allItems
        final sameVariantItems = allItems.where((i) => i.variantId == variantId).toList();
        if (sameVariantItems.isEmpty) continue;

        CartItemEntity bestMatch;
        if (type == 'once') {
          bestMatch = sameVariantItems.firstWhere(
            (i) => i.purchaseType == 'onetime',
            orElse: () => sameVariantItems.first,
          );
          // Convert/ensure it is in one-time format
          checkoutItems.add(bestMatch.copyWith(
            purchaseType: 'onetime',
            quantity: bestMatch.purchaseType == 'onetime' ? (bestMatch.quantity ?? 1) : 1,
            schedules: null,
          ));
        } else if (type == 'sub') {
          bestMatch = sameVariantItems.firstWhere(
            (i) => i.purchaseType == 'subscription',
            orElse: () => sameVariantItems.first,
          );
          // Convert/ensure it is in subscription format
          if (bestMatch.purchaseType == 'subscription') {
            checkoutItems.add(bestMatch);
          } else {
            checkoutItems.add(bestMatch.copyWith(
              purchaseType: 'subscription',
              schedules: bestMatch.schedules ?? List.generate(
                7,
                (i) => SubscriptionSchedule(
                  day: i,
                  mQuantity: 1,
                  eQuantity: 0,
                ),
              ),
              quantity: null,
            ));
          }
        }
      }
    } else {
      checkoutItems.addAll(allItems);
    }
    return checkoutItems;
  }

  @override
  void initState() {
    super.initState();

    // Initialize subscription dates to start from tomorrow
    _subscriptionStartDate = DateTime.now().add(const Duration(days: 1));
    _subscriptionEndDate = DateTime(_subscriptionStartDate!.year, _subscriptionStartDate!.month + 1, 0);

    // Initialize payment type from Cart's suggestion (if provided),
    // but Checkout owns this state going forward.
    if (widget.subscriptionPaymentType != null) {
      _selectedPaymentType = widget.subscriptionPaymentType!;
      _selectedPayment = _selectedPaymentType == 'postpaid' ? 'cod' : 'wallet';
    }
    
    _placedIsSubscription = widget.subscriptionFrequency != null;

    // Refresh session and detect subscription items
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<CustomerSessionCubit>().refreshSilently();
        
        final cartState = context.read<CartBloc>().state;
        if (cartState is CartLoadedState) {
          final allItems = cartState.items;
          final checkoutItems = _getCheckoutItems(allItems);
          if (checkoutItems.any((item) => item.purchaseType == 'subscription')) {
            setState(() {
              _placedIsSubscription = true;
            });
          }
        }
      }
    });
  }

  // ===== Price Calculation =====

  /// Calculates the subtotal for all checkout items.
  /// Uses getEffectivePrice() from shared helpers to ensure correct pricing.
  double _calculateSubtotal(List<CartItemEntity> checkoutItems) {
    final onetimeItems = checkoutItems.where((i) => i.purchaseType == 'onetime').toList();
    final subItems = checkoutItems.where((i) => i.purchaseType == 'subscription').toList();

    final onetimeTotal = calculateOneTimeTotal(onetimeItems);

    double subscriptionPayable = 0;
    if (subItems.isNotEmpty) {
      final subEstimate = calculateSubscriptionEstimate(
        subItems,
        _subscriptionStartDate ?? DateTime.now(),
      );
      subscriptionPayable = subEstimate.estimatedAmount;
    }

    return onetimeTotal + subscriptionPayable;
  }

  // ===== Subscription Date Selection =====

  Future<void> _selectSubscriptionStartDate(BuildContext context) async {
    final firstSelectable = DateTime.now().add(const Duration(days: 1));
    final lastSelectable = DateTime(firstSelectable.year, firstSelectable.month + 1, 0);

    final DateTime? picked = await showCustomDatePicker(
      context: context,
      initialDate: _subscriptionStartDate ?? firstSelectable,
      firstDate: firstSelectable,
      lastDate: lastSelectable,
      title: 'Select Start Date',
      highlightMonthEnd: true,
    );

    if (picked != null) {
      setState(() {
        _subscriptionStartDate = picked;
        // End date is always end of the month containing the start date
        _subscriptionEndDate = DateTime(picked.year, picked.month + 1, 0);
      });
    }
  }

  // ===== Order Placement =====

  /// Places the order via CheckoutBloc.
  /// Determines payment method and type based on local state (not Cart).
  void _placeOrder(double grandTotal, List<CartItemEntity> checkoutItems, String userId, String? addressId) {
    String? paymentMethod;
    String? paymentType;

    final hasSubscription = checkoutItems.any((item) => item.purchaseType == 'subscription');

    if (hasSubscription) {
      // For subscriptions, use the locally managed payment type
      paymentType = _selectedPaymentType;
      paymentMethod = paymentType == 'postpaid' ? 'cod' : _selectedPayment;
    } else {
      // For one-time orders, derive payment type from selected method
      paymentMethod = _selectedPayment;
      paymentType = _selectedPayment == 'cod' ? 'postpaid' : 'prepaid';
    }

    final request = CheckoutRequestEntity(
      userId: userId,
      items: checkoutItems,
      addressId: addressId,
      paymentMethod: paymentMethod,
      paymentType: paymentType,
      subscriptionStartDate: _subscriptionStartDate != null
          ? _subscriptionStartDate!.toString().split(' ')[0]
          : null,
      subscriptionEndDate: _subscriptionEndDate != null
          ? _subscriptionEndDate!.toString().split(' ')[0]
          : null,
      subscriptionAutoRenew: _autoRenew,
    );

    context.read<CheckoutBloc>().add(PlaceCheckoutEvent(request));
  }

  @override
  Widget build(BuildContext context) {
    // ===== Order/Checkout Finished State (Success/Pending/Failed) =====
    if (_isOrderPlaced) {
      String? addressText = _placedAddress;
      if (addressText == null || addressText.isEmpty) {
        final sessionState = context.read<CustomerSessionCubit>().state;
        if (sessionState.addresses.isNotEmpty) {
          final primaryAddress = sessionState.addresses.firstWhere((a) => a.isDefault, orElse: () => sessionState.addresses.first);
          addressText = '${primaryAddress.addressType.toUpperCase()} · ${primaryAddress.name}, ${primaryAddress.detail}';
        }
      }
      return CheckoutStatusWidget(
        onDone: () {
          if (mounted) Navigator.pop(context);
        },
        isSubscription: _placedIsSubscription,
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
          final allItems = (context.read<CartBloc>().state as CartLoadedState).items;
          final checkoutItems = _getCheckoutItems(allItems);

          // Determine if this was a subscription order and extract the correct ID
          final hasSubscription = checkoutItems.any((item) => item.purchaseType == 'subscription');


          final backendStatus = checkoutState.responseData['status']?.toString() ?? 'success';
          final backendId = checkoutState.responseData['id']?.toString();
          final backendAddress = checkoutState.responseData['address']?.toString();

          setState(() {
            _isLoading = false;
            _isOrderPlaced = true;
            _placedIsSubscription = hasSubscription;
            _placedStatus = backendStatus;
            _placedOrderId = backendId;
            _placedAddress = backendAddress;
          });

          // Deduct wallet balance client-side for immediate UI feedback
          final double subtotal = _calculateSubtotal(checkoutItems);
          final double grandTotal = subtotal;

          if (_selectedPayment == 'wallet') {
            context.read<CustomerSessionCubit>().deductWallet(grandTotal);
          }

          // Remove checked-out items from the cart
          final bloc = context.read<CartBloc>();
          final cartState = bloc.state;
          if (cartState is CartLoadedState) {
            final List<CartItemEntity> remainingItems = List.from(cartState.items);
            if (widget.selectedItemIds != null) {
              for (final key in widget.selectedItemIds!) {
                final parts = key.split('_');
                if (parts.length >= 2) {
                  final variantId = parts[0];
                  final type = parts[1]; // 'once' or 'sub'
                  final purchaseType = type == 'once' ? 'onetime' : 'subscription';
                  remainingItems.removeWhere((item) => item.variantId == variantId && item.purchaseType == purchaseType);
                } else if (parts.isNotEmpty) {
                  final variantId = parts[0];
                  remainingItems.removeWhere((item) => item.variantId == variantId);
                }
              }
            } else {
              remainingItems.clear();
            }
            bloc.add(SyncCartEvent(remainingItems));
          }
        } else if (checkoutState is CheckoutErrorState) {
          final allItems = (context.read<CartBloc>().state as CartLoadedState).items;
          final checkoutItems = _getCheckoutItems(allItems);
          final hasSubscription = checkoutItems.any((item) => item.purchaseType == 'subscription');

          setState(() {
            _isLoading = false;
            _dragKey++; // Reset swipe button
            _isOrderPlaced = true;
            _placedIsSubscription = hasSubscription;
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
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kText),
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
          final walletBalance = sessionState.profile?.walletBalance ?? 0.0;

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
                      Icon(Icons.shopping_cart_outlined, size: 54, color: kMuted),
                      SizedBox(height: 12),
                      Text('No items selected for checkout', style: TextStyle(fontWeight: FontWeight.w600, color: kMuted)),
                    ],
                  ),
                );
              }

              // ===== Bill Calculations =====
              // Uses shared helpers for consistent pricing
              final double deliveryFee = 0.0;
              final double taxes = 0.0;
              final double donation = 0.0;

              // Separate totals for one-time and subscription items
              final onetimeItems = checkoutItems.where((i) => i.purchaseType == 'onetime').toList();
              final subItems = checkoutItems.where((i) => i.purchaseType == 'subscription').toList();
              final double onetimeTotal = calculateOneTimeTotal(onetimeItems);

              final hasSubscription = subItems.isNotEmpty;
              final hasOnetime = onetimeItems.isNotEmpty;

              // Subscription estimation using delivery-count formula
              // Total = Deliveries × (Morning Qty + Evening Qty) × Subscription Price
              final subEstimate = hasSubscription
                  ? calculateSubscriptionEstimate(subItems, _subscriptionStartDate ?? DateTime.now())
                  : null;
              final subSavings = hasSubscription
                  ? calculateMonthlySavings(subItems, _subscriptionStartDate ?? DateTime.now())
                  : null;
              final subEndOfMonth = DateTime(
                (_subscriptionStartDate ?? DateTime.now()).year,
                (_subscriptionStartDate ?? DateTime.now()).month + 1,
                0,
              );

              // ===== Grand Total Calculation =====
              // For subscription items: use estimated monthly amount (delivery-count formula)
              // For one-time items: use unitPrice × quantity
              // These NEVER mix — subscription items never use simple price × qty
              final double subscriptionPayable = subEstimate?.estimatedAmount ?? 0.0;
              final double subtotal = onetimeTotal + subscriptionPayable;
              final double grandTotal = subtotal + deliveryFee + taxes + donation;

              // For postpaid subscriptions, user pays ₹0 now (billed later)
              // For prepaid or one-time, user pays the full grandTotal
              final bool isPostpaidSubscription = hasSubscription && _selectedPaymentType == 'postpaid';
              final double payableNow = isPostpaidSubscription
                  ? onetimeTotal // Only pay for one-time items now (if any)
                  : grandTotal;

              return Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ===== Delivery Address =====
                          BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
                            builder: (context, sessionState) {
                              final list = sessionState.addresses;
                              final isEmpty = list.isEmpty;

                          if (isEmpty) {
                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: kRed.withOpacity(0.4)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.location_off_outlined, size: 24, color: kRed),
                                  const SizedBox(width: 14),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'No Delivery Address',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kRed),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          'Please add a delivery address to complete your order.',
                                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                                        ),
                                      ],
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => const AddAddressScreen(),
                                        ),
                                      );
                                    },
                                    child: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kPrimary)),
                                  ),
                                ],
                              ),
                            );
                          }

                              final primaryAddress = list.firstWhere((a) => a.isDefault, orElse: () => list.first);

                              if (_isAddressLoading) {
                                return Container(
                                  padding: const EdgeInsets.all(24),
                                    decoration: BoxDecoration(
                                      color: kSurface,
                                      borderRadius: BorderRadius.circular(24),
                                      border: Border.all(color: kBorder),
                                    ),
                                  child: const Center(
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
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
                                    const Icon(Icons.location_on_outlined, size: 24, color: kPrimary),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Delivery to ${primaryAddress.addressType.toUpperCase()}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kMuted),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            primaryAddress.name,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                                          ),
                                          Text(
                                            primaryAddress.detail,
                                            style: const TextStyle(fontSize: 11, color: kTextSub),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    TextButton(
                                      onPressed: () async {
                                        final AddressModel? selectedAddress = await AddressSelectorDrawer.show(context);
                                        if (selectedAddress != null && selectedAddress.addressId != null && context.mounted) {
                                          setState(() {
                                            _isAddressLoading = true;
                                          });
                                          try {
                                            final sessionCubit = context.read<CustomerSessionCubit>();
                                            await sessionCubit.updateDefaultAddress(selectedAddress.addressId!);
                                            if (context.mounted) {
                                              F2HToast.success(context, 'Address updated successfully');
                                            }
                                          } catch (e) {
                                            if (context.mounted) {
                                              F2HToast.error(context, extractErrorMessage(e));
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
                                      child: const Text('Change', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kPrimary)),
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
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                                  child: Text(
                                    'Items in Cart',
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kText),
                                  ),
                                ),
                                const Divider(color: kBorderLt),
                                ListView.separated(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: checkoutItems.length,
                                  separatorBuilder: (_, __) => const Divider(color: kBorderLt, height: 1),
                                  itemBuilder: (context, index) {
                                    final item = checkoutItems[index];
                                    // Use getEffectivePrice for consistent pricing
                                    final effectivePrice = getEffectivePrice(item);
                                    final p = getProductById(
                                      item.variantId,
                                      name: item.productName,
                                      variantName: item.variantName,
                                      price: effectivePrice,
                                      imageAsset: item.imageAsset,
                                    );
                                    final isSub = item.purchaseType == 'subscription';
                                    final qty = getItemQuantity(item);
                                    final displayPrice = effectivePrice;
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 60,
                                            height: 60,
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(color: kBorderLt, width: 1),
                                            ),
                                            child: ClipRRect(
                                              borderRadius: BorderRadius.circular(9),
                                              child: Padding(
                                                padding: const EdgeInsets.all(2),
                                                child: buildProductImage(
                                                  p.name,
                                                  imageAsset: p.imageAsset,
                                                  fit: BoxFit.contain,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  p.name,
                                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kText),
                                                ),
                                                Text(
                                                  '${p.unit} · ₹${displayPrice.toStringAsFixed(0)}',
                                                  style: const TextStyle(fontSize: 11, color: kTextSub),
                                                ),
                                                if (isSub)
                                                  const Text(
                                                    'Subscribed',
                                                    style: TextStyle(fontSize: 10, color: kPrimary, fontWeight: FontWeight.w700),
                                                  ),
                                              ],
                                            ),
                                          ),
                                          SizedBox(
                                            width: 80,
                                            child: Align(
                                              alignment: Alignment.centerRight,
                                              child: _buildCheckoutItemCounter(item),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          SizedBox(
                                            width: 55,
                                            child: Align(
                                              alignment: Alignment.centerRight,
                                              child: Text(
                                                '₹${(displayPrice * qty).toStringAsFixed(0)}',
                                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // ===== Subscription Payment Type =====
                          // Only shown when subscription items exist.
                          // Checkout manages this state internally.
                          Builder(
                            builder: (context) {
                              final profile = sessionState.profile;
                              final isPostpaidEnabled = profile?.isPostpaidEnabled ?? false;
                              final creditLimit = profile?.postpaidCreditLimit ?? 0.0;

                              return Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: kSurface,
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(color: kBorder),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Payment Method',
                                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kText),
                                    ),

                                    // ===== Subscription Billing Toggle =====
                                    if (hasSubscription) ...[
                                      const SizedBox(height: 14),
                                      Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: kPrimary.withOpacity(0.04),
                                          borderRadius: BorderRadius.circular(24),
                                          border: Border.all(color: kPrimary.withOpacity(0.15)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Icon(Icons.repeat_rounded, size: 15, color: kPrimary),
                                                const SizedBox(width: 6),
                                                const Text(
                                                  'SUBSCRIPTION BILLING',
                                                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kTextSub, letterSpacing: 0.5),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),

                                            // Prepaid / Postpaid toggle
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: GestureDetector(
                                                    onTap: () => setState(() => _selectedPaymentType = 'prepaid'),
                                                    child: AnimatedContainer(
                                                      duration: const Duration(milliseconds: 200),
                                                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                                                      decoration: BoxDecoration(
                                                        color: _selectedPaymentType == 'prepaid' ? kPrimary : kSurface,
                                                        borderRadius: BorderRadius.circular(16),
                                                        border: Border.all(
                                                          color: _selectedPaymentType == 'prepaid' ? kPrimary : kBorder,
                                                          width: 1.5,
                                                        ),
                                                      ),
                                                      child: Column(
                                                        children: [
                                                          Icon(
                                                            Icons.account_balance_wallet_outlined,
                                                            size: 16,
                                                            color: _selectedPaymentType == 'prepaid' ? Colors.white : kTextSub,
                                                          ),
                                                          const SizedBox(height: 2),
                                                          Text(
                                                            'Prepaid',
                                                            style: TextStyle(
                                                              fontSize: 12,
                                                              fontWeight: FontWeight.w700,
                                                              color: _selectedPaymentType == 'prepaid' ? Colors.white : kText,
                                                            ),
                                                          ),
                                                          const SizedBox(height: 2),
                                                          Text(
                                                            'Pay from wallet',
                                                            style: TextStyle(
                                                              fontSize: 9,
                                                              color: _selectedPaymentType == 'prepaid' ? Colors.white70 : kMuted,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: GestureDetector(
                                                    onTap: isPostpaidEnabled
                                                        ? () => setState(() => _selectedPaymentType = 'postpaid')
                                                        : null,
                                                    child: AnimatedContainer(
                                                      duration: const Duration(milliseconds: 200),
                                                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                                                      decoration: BoxDecoration(
                                                        color: _selectedPaymentType == 'postpaid' ? kAccent : (isPostpaidEnabled ? kSurface : kBg),
                                                        borderRadius: BorderRadius.circular(16),
                                                        border: Border.all(
                                                          color: _selectedPaymentType == 'postpaid' ? kAccent : kBorder,
                                                          width: 1.5,
                                                        ),
                                                      ),
                                                      child: Column(
                                                        children: [
                                                          Icon(
                                                            Icons.schedule_outlined,
                                                            size: 16,
                                                            color: _selectedPaymentType == 'postpaid' ? Colors.white : (isPostpaidEnabled ? kTextSub : kMuted),
                                                          ),
                                                          const SizedBox(height: 2),
                                                          Text(
                                                            'Postpaid',
                                                            style: TextStyle(
                                                              fontSize: 12,
                                                              fontWeight: FontWeight.w700,
                                                              color: _selectedPaymentType == 'postpaid' ? Colors.white : (isPostpaidEnabled ? kText : kMuted),
                                                            ),
                                                          ),
                                                          const SizedBox(height: 2),
                                                          Text(
                                                            isPostpaidEnabled ? 'Limit: ₹${creditLimit.toStringAsFixed(0)}' : 'Not enabled',
                                                            style: TextStyle(
                                                              fontSize: 9,
                                                              color: _selectedPaymentType == 'postpaid' ? Colors.white70 : kMuted,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const Divider(color: kBorderLt, height: 24),
                                            
                                            // ===== Start Date Selector =====
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      const Text(
                                                        'START DATE',
                                                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.5),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        'Starts today onwards',
                                                        style: TextStyle(fontSize: 9, color: kTextSub.withOpacity(0.6)),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                GestureDetector(
                                                  onTap: () => _selectSubscriptionStartDate(context),
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                                    decoration: BoxDecoration(
                                                      color: Colors.white,
                                                      borderRadius: BorderRadius.circular(12),
                                                      border: Border.all(color: kBorder),
                                                    ),
                                                    child: Row(
                                                      children: [
                                                        const Icon(Icons.calendar_today_rounded, size: 14, color: kPrimary),
                                                        const SizedBox(width: 8),
                                                        Text(
                                                          _subscriptionStartDate != null
                                                              ? '${_subscriptionStartDate!.day}/${_subscriptionStartDate!.month}/${_subscriptionStartDate!.year}'
                                                              : 'Select Date',
                                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kPrimary),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 14),

                                            // ===== Auto Renew Toggle =====
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      const Text(
                                                        'AUTO RENEW PLAN',
                                                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.5),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        'Renew automatically every month',
                                                        style: TextStyle(fontSize: 9, color: kTextSub.withOpacity(0.6)),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                GestureDetector(
                                                   onTap: () {
                                                     setState(() {
                                                       _autoRenew = !_autoRenew;
                                                     });
                                                   },
                                                   child: AnimatedContainer(
                                                     duration: const Duration(milliseconds: 150),
                                                     width: 44,
                                                     height: 24,
                                                     decoration: BoxDecoration(
                                                       color: _autoRenew ? kPrimary : kBorder,
                                                       borderRadius: BorderRadius.circular(4),
                                                     ),
                                                     padding: const EdgeInsets.all(2),
                                                     alignment: _autoRenew ? Alignment.centerRight : Alignment.centerLeft,
                                                     child: Container(
                                                       width: 20,
                                                       height: 20,
                                                       decoration: BoxDecoration(
                                                         color: Colors.white,
                                                         borderRadius: BorderRadius.circular(2),
                                                         boxShadow: [
                                                           BoxShadow(
                                                             color: Colors.black.withOpacity(0.1),
                                                             blurRadius: 2,
                                                           ),
                                                         ],
                                                       ),
                                                     ),
                                                   ),
                                                 ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),

                                      const SizedBox(height: 12),

                                      // Info tooltips explaining prepaid vs postpaid
                                      _selectedPaymentType == 'prepaid'
                                          ? InfoTooltipCard.prepaid()
                                          : InfoTooltipCard.postpaid(),
                                    ],

                                    const SizedBox(height: 16),

                                    // ===== Payment Method =====
                                    // Prepaid section (shown for one-time or prepaid subscription)
                                    if (!hasSubscription || _selectedPaymentType == 'prepaid') ...[
                                      Row(
                                        children: [
                                          const Icon(Icons.payment_rounded, size: 14, color: kPrimary),
                                          const SizedBox(width: 6),
                                          Text(
                                            hasSubscription ? 'PREPAID (Instant Pay)' : 'SELECT PAYMENT METHOD',
                                            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kTextSub, letterSpacing: 0.5),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      _buildPaymentOption(
                                        id: 'wallet',
                                        icon: Icons.credit_card_outlined,
                                        title: 'F2H Wallet (₹${walletBalance.toStringAsFixed(2)} available)',
                                        subtitle: grandTotal <= walletBalance ? 'Sufficient balance' : 'Insufficient balance (Top-up required)',
                                        disabled: grandTotal > walletBalance,
                                      ),
                                      const SizedBox(height: 10),
                                      _buildPaymentOption(
                                        id: 'upi',
                                        icon: Icons.bolt_outlined,
                                        title: 'Instant UPI',
                                        subtitle: 'Pay via Google Pay, PhonePe, or Paytm',
                                      ),
                                      if (!hasSubscription) ...[
                                        const SizedBox(height: 10),
                                        _buildPaymentOption(
                                          id: 'cod',
                                          icon: Icons.payments_outlined,
                                          title: 'Cash on Delivery (COD)',
                                          subtitle: 'Pay cash or Scan UPI on delivery',
                                        ),
                                      ],
                                    ],

                                    // Postpaid section (only for subscriptions with postpaid enabled)
                                    if (hasSubscription && _selectedPaymentType == 'postpaid') ...[
                                      const Row(
                                        children: [
                                          Icon(Icons.local_shipping_rounded, size: 14, color: kAccent),
                                          SizedBox(width: 6),
                                          Text(
                                            'POSTPAID (Pay on Delivery)',
                                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kTextSub, letterSpacing: 0.5),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      _buildPaymentOption(
                                        id: 'cod',
                                        icon: Icons.payments_outlined,
                                        title: 'F2H Postpaid',
                                        subtitle: 'Billed to your postpaid limit',
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 16),

                          // ===== Bill Summary =====
                          SectionCard(
                            borderRadius: 24,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Order Summary',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kText),
                                ),
                                const SizedBox(height: 12),

                                // ===== One-Time Section =====
                                if (hasOnetime) ...[
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: kPrimaryPl.withValues(alpha: 0.5),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(Icons.shopping_basket_rounded, size: 12, color: kPrimary),
                                            SizedBox(width: 6),
                                            Text('ONE-TIME ORDER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kPrimary, letterSpacing: 0.5)),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        // Delivery date from the first one-time item
                                        if (onetimeItems.isNotEmpty && onetimeItems.first.deliveryDate != null)
                                          SummaryRow(
                                            label: 'Delivery Date',
                                            value: onetimeItems.first.deliveryDate!,
                                          ),
                                        if (onetimeItems.isNotEmpty && onetimeItems.first.deliverySlot != null) ...[
                                          const SizedBox(height: 4),
                                          SummaryRow(
                                            label: 'Delivery Slot',
                                            value: onetimeItems.first.deliverySlot!,
                                          ),
                                        ],
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'Items',
                                          value: '${onetimeItems.fold<int>(0, (sum, i) => sum + (i.quantity ?? 1))}',
                                        ),
                                        const Divider(color: kBorderLt, height: 16),
                                        SummaryRow(
                                          label: 'One-Time Total',
                                          value: '₹${onetimeTotal.toStringAsFixed(0)}',
                                          isBold: true,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                ],

                                // ===== Subscription Section =====
                                if (hasSubscription && subEstimate != null) ...[
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: kAccentLt.withValues(alpha: 0.5),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(Icons.repeat_rounded, size: 12, color: kAccent),
                                            SizedBox(width: 6),
                                            Text('SUBSCRIPTION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kAccent, letterSpacing: 0.5)),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        SummaryRow(
                                          label: 'Start Date',
                                          value: '${(_subscriptionStartDate ?? DateTime.now()).day}/${(_subscriptionStartDate ?? DateTime.now()).month}/${(_subscriptionStartDate ?? DateTime.now()).year}',
                                        ),
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'End Date',
                                          value: '${subEndOfMonth.day}/${subEndOfMonth.month}/${subEndOfMonth.year}',
                                        ),
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'Delivery Days',
                                          value: '${subEstimate.totalDays} days',
                                        ),
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'Morning Qty',
                                          value: '${subEstimate.totalMorningQty}',
                                        ),
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'Evening Qty',
                                          value: '${subEstimate.totalEveningQty}',
                                        ),
                                        const SizedBox(height: 4),
                                        SummaryRow(
                                          label: 'Total Est. Qty',
                                          value: '${subEstimate.totalQuantity} items',
                                        ),
                                        const Divider(color: kBorderLt, height: 16),
                                        SummaryRow(
                                          label: 'Est. Monthly Total',
                                          value: '₹${subEstimate.estimatedAmount.toStringAsFixed(0)}',
                                          isBold: true,
                                          valueColor: kAccent,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),

                                  // ===== Monthly Savings =====
                                  if (subSavings != null && subSavings.savings > 0)
                                    MonthlySavingsCard(
                                      normalPriceTotal: subSavings.normalPriceTotal,
                                      subscriptionTotal: subSavings.subscriptionTotal,
                                      savings: subSavings.savings,
                                      savingsPercent: subSavings.savingsPercent,
                                      totalDeliveryDays: subSavings.totalDeliveryDays,
                                      totalEstimatedQuantity: subSavings.totalEstimatedQuantity,
                                    ),
                                  const SizedBox(height: 10),
                                ],

                                // ===== Bill Totals =====
                                const Divider(color: kBorderLt, height: 16),

                                // Show the correct item total based on what's in checkout
                                if (hasOnetime && !hasSubscription) ...[
                                  // One-time only: simple item total
                                  SummaryRow(label: 'Item Total', value: '₹${onetimeTotal.toStringAsFixed(0)}'),
                                ] else if (hasSubscription && !hasOnetime) ...[
                                  // Subscription only: show estimated monthly total
                                  SummaryRow(
                                    label: 'Est. Monthly Total',
                                    value: '₹${subscriptionPayable.toStringAsFixed(0)}',
                                    valueColor: kAccent,
                                  ),
                                ] else if (hasOnetime && hasSubscription) ...[
                                  // Both: show separate totals
                                  SummaryRow(label: 'One-Time Total', value: '₹${onetimeTotal.toStringAsFixed(0)}'),
                                  const SizedBox(height: 6),
                                  SummaryRow(
                                    label: 'Subscription Est. Total',
                                    value: '₹${subscriptionPayable.toStringAsFixed(0)}',
                                    valueColor: kAccent,
                                  ),
                                ],

                                const SizedBox(height: 8),
                                const SummaryRow(label: 'Delivery Fee', value: '₹39'),
                                const SizedBox(height: 8),
                                const SummaryRow(label: 'Delivery Discount', value: '-₹39', valueColor: kPrimaryLt),
                                const SizedBox(height: 8),
                                const SummaryRow(label: 'Taxes & Handling Charges', value: '₹0'),
                                if (_donating) ...[
                                  const SizedBox(height: 8),
                                  const SummaryRow(label: 'Feeding India Donation', value: '₹2'),
                                ],
                                const Divider(color: kBorderLt, height: 24),

                                // To Pay: shows what user pays NOW
                                // Postpaid subscription = ₹0 now (billed monthly)
                                // Prepaid subscription = estimated monthly total
                                // One-time = item total
                                if (isPostpaidSubscription && !hasOnetime) ...[
                                  const SummaryRow(
                                    label: 'To Pay Now',
                                    value: '₹0',
                                    isBold: true,
                                    fontSize: 16,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Postpaid · Billed monthly to your limit',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: kAccent,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ] else ...[
                                  SummaryRow(
                                    label: 'To Pay',
                                    value: '₹${payableNow.toStringAsFixed(0)}',
                                    isBold: true,
                                    fontSize: 16,
                                  ),
                                ],
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
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: kSurface,
                      border: const Border(top: BorderSide(color: kBorder)),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withOpacity(0.04),
                          blurRadius: 16,
                          offset: const Offset(0, -4),
                        )
                      ],
                    ),
                    child: SafeArea(
                      child: SlideToPayButton(
                        key: ValueKey(_dragKey),
                        // For postpaid subscription: always enabled (no upfront payment)
                        // For prepaid/one-time: check wallet balance
                        disabled: !isPostpaidSubscription &&
                            _selectedPayment == 'wallet' &&
                            payableNow > walletBalance,
                        onSwipeCompleted: () {
                          final list = sessionState.addresses;
                          final addressId = list.isEmpty
                              ? null
                              : list.firstWhere((a) => a.isDefault, orElse: () => list.first).id?.toString();
                          _placeOrder(
                            grandTotal,
                            checkoutItems,
                            sessionState.profile?.customerId ?? '',
                            addressId,
                          );
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
          // Loading overlay
          if (_isLoading)
            Positioned.fill(
              child: Container(
                color: Colors.black.withValues(alpha: 0.3),
                child: const Center(
                  child: CircularProgressIndicator(color: kPrimary),
                ),
              ),
            ),
        ],
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? kPrimaryPl.withOpacity(0.4) : kBgDeep.withOpacity(0.6),
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
              child: Icon(icon, color: isSelected ? kPrimary : kTextSub, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Opacity(
                opacity: disabled ? 0.5 : 1.0,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: disabled ? kMuted : kText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 10,
                        color: isSelected ? kPrimaryMid : kTextSub,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
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
                      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    builder: (_) => const TopupDrawer(),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                  isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
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

  /// Read-only counter for subscription items, editable for one-time items.
  Widget _buildCheckoutItemCounter(CartItemEntity item) {
    final isSub = item.purchaseType == 'subscription';
    if (isSub) {
      // Subscription items show quantity as read-only
      final qty = getItemQuantity(item);
      return Container(
        width: 36,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: kBgDeep,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kBorder),
        ),
        child: Text(
          '$qty',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
      );
    }

    // One-time items are editable
    int qty = item.quantity ?? 1;

    return QuantityCounter(
      quantity: qty,
      width: 80,
      onDecrement: () {
        context.read<CartBloc>().add(RemoveFromCartEvent(item.copyWith(quantity: 1)));
      },
      onIncrement: () {
        context.read<CartBloc>().add(AddToCartEvent(item.copyWith(quantity: 1)));
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
                    child: const Icon(
                      Icons.arrow_forward,
                      color: Colors.white,
                    ),
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
