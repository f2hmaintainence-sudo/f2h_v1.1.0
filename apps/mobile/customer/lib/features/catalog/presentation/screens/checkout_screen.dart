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
import '../../../../core/session/customer_session_cubit.dart';
import '../../../../core/session/customer_session_state.dart';
import '../bloc/checkout/checkout_bloc.dart';
import '../bloc/checkout/checkout_event.dart';
import '../bloc/checkout/checkout_state.dart';
import '../../domain/entities/checkout/checkout_request_entity.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/presentation/screens/add_address_screen.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../../address/data/models/profile_address.dart';
import '../../../../core/widgets/scrolling_items_loader.dart';
import '../helpers/cart_helpers.dart';
import '../widgets/cart_widgets.dart';
// [ADDED BY ANTIGRAVITY FOR WALLET TOPUP]
import '../../../wallet/presentation/widgets/topup_drawer.dart';

// ═══════════════════════════════════════════════════════════════════════════
//  CHECKOUT SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class CheckoutScreen extends StatefulWidget {
  final List<String>? selectedItemIds;

  const CheckoutScreen({
    super.key,
    this.selectedItemIds,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  // ===== State Variables =====

  /// Selected payment method: 'wallet', 'upi', or 'cod'
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

  // ===== Checkout Item Filtering =====

  /// Filters cart items to only include one-time items selected by the user.
  List<CartItemEntity> _getCheckoutItems(List<CartItemEntity> allItems) {
    final List<CartItemEntity> checkoutItems = [];
    if (widget.selectedItemIds != null && widget.selectedItemIds!.isNotEmpty) {
      for (final key in widget.selectedItemIds!) {
        final variantId = key.endsWith('_once')
            ? key.substring(0, key.length - 5)
            : (key.endsWith('_sub') ? key.substring(0, key.length - 4) : key);
        final matches = allItems.where((i) =>
            i.variantId == variantId ||
            '${i.variantId}_once' == key ||
            '${i.variantId}_sub' == key ||
            i.variantId == key).toList();
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

  // ===== Price Calculation =====

  double _calculateSubtotal(List<CartItemEntity> checkoutItems) {
    return calculateOneTimeTotal(checkoutItems);
  }

  // ===== Order Placement =====

  void _placeOrder(double grandTotal, List<CartItemEntity> checkoutItems, String userId, String? addressId) {
    final paymentMethod = _selectedPayment;
    final paymentType = _selectedPayment == 'cod' ? 'postpaid' : 'prepaid';

    final request = CheckoutRequestEntity(
      userId: userId,
      items: checkoutItems,
      addressId: addressId,
      paymentMethod: paymentMethod,
      paymentType: paymentType,
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

          final backendStatus = checkoutState.responseData['status']?.toString() ?? 'success';
          final backendId = checkoutState.responseData['id']?.toString();
          final backendAddress = checkoutState.responseData['address']?.toString();

          setState(() {
            _isLoading = false;
            _isOrderPlaced = true;
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
            if (widget.selectedItemIds != null && widget.selectedItemIds!.isNotEmpty) {
              for (final key in widget.selectedItemIds!) {
                final variantId = key.endsWith('_once')
                    ? key.substring(0, key.length - 5)
                    : (key.endsWith('_sub') ? key.substring(0, key.length - 4) : key);
                remainingItems.removeWhere((item) =>
                    item.variantId == variantId ||
                    '${item.variantId}_once' == key ||
                    '${item.variantId}_sub' == key ||
                    item.variantId == key);
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
              final double deliveryFee = 0.0;
              final double taxes = 0.0;
              final double donation = 0.0;

              final double onetimeTotal = calculateOneTimeTotal(checkoutItems);
              final double subtotal = onetimeTotal;
              final double grandTotal = subtotal + deliveryFee + taxes + donation;
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

                          // ===== Payment Method =====
                          Container(
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
                                const SizedBox(height: 14),
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
                                const SizedBox(height: 10),
                                _buildPaymentOption(
                                  id: 'cod',
                                  icon: Icons.payments_outlined,
                                  title: 'Cash on Delivery (COD)',
                                  subtitle: 'Pay cash or Scan UPI on delivery',
                                ),
                              ],
                            ),
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
                                if (checkoutItems.isNotEmpty && checkoutItems.first.deliveryDate != null) ...[
                                  SummaryRow(
                                    label: 'Delivery Date',
                                    value: checkoutItems.first.deliveryDate!,
                                  ),
                                  const SizedBox(height: 4),
                                ],
                                if (checkoutItems.isNotEmpty && checkoutItems.first.deliverySlot != null) ...[
                                  SummaryRow(
                                    label: 'Delivery Slot',
                                    value: checkoutItems.first.deliverySlot!,
                                  ),
                                  const SizedBox(height: 4),
                                ],
                                SummaryRow(
                                  label: 'Total Items',
                                  value: '${checkoutItems.fold<int>(0, (sum, i) => sum + (i.quantity ?? 1))}',
                                ),
                                const Divider(color: kBorderLt, height: 16),
                                SummaryRow(label: 'Item Total', value: '₹${onetimeTotal.toStringAsFixed(0)}'),
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
                                SummaryRow(
                                  label: 'To Pay',
                                  value: '₹${payableNow.toStringAsFixed(0)}',
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
                        disabled: _selectedPayment == 'wallet' && payableNow > walletBalance,
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

  /// Item counter for one-time order items.
  Widget _buildCheckoutItemCounter(CartItemEntity item) {
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
