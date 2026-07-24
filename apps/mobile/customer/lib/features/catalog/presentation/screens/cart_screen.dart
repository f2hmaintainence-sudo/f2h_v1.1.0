// ═══════════════════════════════════════════════════════════════════════════
//  CART SCREEN
//
//  One-Time Orders only.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../app.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import 'checkout_screen.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../../../core/widgets/custom_date_picker.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_state.dart';
import '../bloc/cart/cart_event.dart';
import '../../../../core/session/customer_session_cubit.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/widgets/app_refresh_indicator.dart';
import '../../../../core/guards/auth_guard.dart';
import '../../../../core/network/network_bloc.dart';
import '../../../../core/network/network_state.dart';
import '../../../../core/widgets/scrolling_items_loader.dart';
import 'product_detail_view_screen.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../helpers/cart_helpers.dart';
import '../widgets/cart_widgets.dart';

// ═══════════════════════════════════════════════════════════════════════════
//  CART SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  // ===== State Variables =====

  /// Tracks which items are selected (checked) in the cart.
  /// Key format: "{variantId}_once"
  final Map<String, bool> _selectedItems = {};

  // ignore: unused_field
  bool _isAddressLoading = false;

  /// Global delivery date for all one-time items.
  DateTime? _globalOnetimeDate;

  /// Global delivery slot for all one-time items ('Morning' or 'Evening').
  String _globalOnetimeSlot = 'Morning';

  @override
  void initState() {
    super.initState();
    // Load cart on first build if not already loaded
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final bloc = context.read<CartBloc>();
      final sessionState = context.read<CustomerSessionCubit>().state;
      final customerId = sessionState.profile?.customerId;
      if (bloc.state is CartInitialState && customerId != null) {
        bloc.add(LoadCartEvent(customerId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;
  
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Cart',
          style: TextStyle(
            color: kText,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: !isLoggedIn
          ? _buildEmptyState(context)
          : BlocBuilder<CartBloc, CartState>(
              builder: (context, state) {
                if (state is CartErrorState) {
                  if (state.message.toLowerCase().contains('unauthorized') || state.message.contains('401')) {
                    return _buildEmptyState(context);
                  }
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.shopping_bag_outlined, color: kPrimary, size: 64),
                          const SizedBox(height: 16),
                          const Text(
                            'Unable to load your cart',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: kText, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            state.message,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: kTextSub, fontSize: 13),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: () {
                              final sessionState = context.read<CustomerSessionCubit>().state;
                              final customerId = sessionState.profile?.customerId;
                              if (customerId != null) {
                                context.read<CartBloc>().add(LoadCartEvent(customerId));
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: kPrimary,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                if (state is! CartLoadedState) {
                  return const Center(
                    child: CircularProgressIndicator(color: kPrimary),
                  );
                }

                // ===== Initialize Global Date/Slot =====
                // Uses time-based rules:
                //   Before noon → Today (Evening only)
                //   After noon → Tomorrow (both slots)
                if (_globalOnetimeDate == null) {
                  final now = DateTime.now();
                  CartItemEntity? firstOnetime;
                  try {
                    firstOnetime = state.items.firstWhere(
                      (item) => item.purchaseType == 'onetime',
                    );
                  } catch (_) {}
                  if (firstOnetime != null &&
                      firstOnetime.deliveryDate != null) {
                    _globalOnetimeDate = DateTime.tryParse(
                      firstOnetime.deliveryDate!,
                    );
                  }
                  if (firstOnetime != null &&
                      firstOnetime.deliverySlot != null) {
                    _globalOnetimeSlot = firstOnetime.deliverySlot!;
                  }
                  // Apply time-based default from helpers
                  _globalOnetimeDate ??= getDefaultDeliveryDate(now);
                  // Ensure slot is valid for the selected date
                  final availableSlots = getAvailableSlots(
                    _globalOnetimeDate!,
                    now,
                  );
                  if (!availableSlots.contains(_globalOnetimeSlot)) {
                    _globalOnetimeSlot = getDefaultSlot(
                      _globalOnetimeDate!,
                      now,
                    );
                  }
                }

                // ===== Sync One-Time Items to Global Settings =====
                // If any one-time item has a different date/slot than the global
                // setting, sync them all to match the global values.
                final globalDateStr = _globalOnetimeDate!.toString().split(
                  ' ',
                )[0];
                final hasMismatch = state.items.any(
                  (item) =>
                      item.purchaseType == 'onetime' &&
                      (item.deliveryDate != globalDateStr ||
                          item.deliverySlot != _globalOnetimeSlot),
                );

                if (hasMismatch) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    final updatedItems = state.items.map((item) {
                      if (item.purchaseType == 'onetime') {
                        return item.copyWith(
                          deliveryDate: globalDateStr,
                          deliverySlot: _globalOnetimeSlot,
                        );
                      }
                      return item;
                    }).toList();
                    context.read<CartBloc>().add(SyncCartEvent(updatedItems));
                  });
                }

                // ===== Filter: One-Time items only =====
                final List<CartItemEntity> filteredItems;
                {
                  final Map<String, CartItemEntity> uniqueOnetime = {};
                  for (final item in state.items) {
                    if (item.purchaseType == 'onetime') {
                      uniqueOnetime[item.variantId] = item;
                    }
                  }
                  filteredItems = uniqueOnetime.values.toList();
                }

                // ===== Build Display Items Map =====
                final Map<String, int> displayItems = {};
                final List<String> displayItemKeys = [];

                for (final item in filteredItems) {
                  final key = '${item.variantId}_once';
                  final qty = item.quantity ?? 1;

                  displayItems[key] = qty;
                  displayItemKeys.add(key);
                }

                // ===== Handle Loading & Empty States =====
                final isOffline =
                    context.read<NetworkBloc>().state is NetworkOffline;
                if ((state is CartLoadingState && state.items.isEmpty) ||
                    isOffline) {
                  return const Center(child: ScrollingItemsLoader());
                }

                if (state.items.isEmpty) {
                  return _buildEmptyState(context);
                }

                // Initialize selection state for new items
                for (var key in displayItemKeys) {
                  _selectedItems.putIfAbsent(key, () => true);
                }



                // ===== Calculate Totals =====
                // One-time only: unitPrice × quantity
                double selectedSubtotal = 0;
                for (final item in filteredItems) {
                  final key = '${item.variantId}_once';
                  if (_selectedItems[key] ?? true) {
                    final price = getEffectivePrice(item);
                    final qty = getItemQuantity(item);
                    selectedSubtotal += price * qty;
                  }
                }

                final double finalGrandTotal = selectedSubtotal;

                return Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 768),
                    child: Stack(
                      children: [
                        Column(
                          children: [
                            Expanded(
                              child: AppRefreshIndicator(
                                onRefresh: () async {
                                  final session = context
                                      .read<CustomerSessionCubit>()
                                      .state;
                                  final customerId =
                                      session.profile?.customerId;
                                  if (customerId != null) {
                                    context.read<CartBloc>().add(
                                      LoadCartEvent(customerId),
                                    );
                                    await context
                                        .read<CartBloc>()
                                        .stream
                                        .firstWhere(
                                          (s) =>
                                              s is CartLoadedState ||
                                              s is CartErrorState,
                                        );
                                  }
                                },
                                child: SingleChildScrollView(
                                  physics: const BouncingScrollPhysics(
                                    parent: AlwaysScrollableScrollPhysics(),
                                  ),
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      // ===== Cart Items List (One-Time Only) =====
                                      _buildItemsCard(
                                        context,
                                        displayItemKeys,
                                        displayItems,
                                        filteredItems,
                                      ),
                                      const SizedBox(height: 16),

                                      // ===== One-Time Configuration =====
                                      if (filteredItems.any(
                                        (item) => item.purchaseType == 'onetime',
                                      )) ...[
                                        _buildGlobalOneTimeConfiguration(
                                          context,
                                          filteredItems,
                                        ),
                                        const SizedBox(height: 16),
                                      ],

                                      // ===== Bill Summary =====
                                      _buildBillSummary(filteredItems),
                                      const SizedBox(height: 24),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            // ===== Checkout =====
                            _buildBottomAction(
                              context,
                              finalGrandTotal,
                              displayItemKeys,
                            ),
                          ],
                        ),
                        // Loading overlay
                        if (state is CartLoadingState)
                          Positioned.fill(
                            child: Container(
                              color: Colors.white24,
                              child: const Center(
                                child: CircularProgressIndicator(
                                  color: kPrimary,
                                ),
                              ),
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

  // ===== Empty State =====

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: const BoxDecoration(
                color: kPrimaryPl,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.shopping_bag_outlined,
                size: 48,
                color: kPrimary,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Your Cart is Empty',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Explore our premium organic milk, ghee, paneer, and fresh dairy products delivered straight to your door.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: kTextSub, height: 1.4),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                AppShell.of(context)?.setTab(1); // Navigate to Menu/Browse tab
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Explore Menu',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward, size: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===== Cart Items List =====

  Widget _buildItemsCard(
    BuildContext context,
    List<String> itemKeys,
    Map<String, int> items,
    List<CartItemEntity> filteredItems,
  ) {
    return SectionCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with item count
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Added Items',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                ),
                Text(
                  '${itemKeys.fold(0, (sum, key) => sum + (items[key] ?? 0))} item(s)',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: kPrimaryMid,
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: kBorderLt, height: 1),

          // ===== Items List or Empty State =====
          if (itemKeys.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32, horizontal: 16),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.shopping_basket_rounded,
                      size: 40,
                      color: Color(0x669CA3AF),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'No items in your cart',
                      style: TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            ListView.separated(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: itemKeys.length,
              separatorBuilder: (_, __) =>
                  const Divider(color: kBorderLt, height: 1),
              itemBuilder: (context, i) {
                final key = itemKeys[i];
                final state = context.read<CartBloc>().state;
                CartItemEntity? matchedItem;
                if (state is CartLoadedState) {
                  try {
                    matchedItem = filteredItems.firstWhere((item) {
                      final itemKey = '${item.variantId}_once';
                      final variantIdFromKey = key.endsWith('_once')
                          ? key.substring(0, key.length - 5)
                          : (key.endsWith('_sub') ? key.substring(0, key.length - 4) : key);
                      return itemKey == key || item.variantId == variantIdFromKey || item.variantId == key;
                    });
                  } catch (_) {}
                }
                if (matchedItem == null) return const SizedBox.shrink();

                final p = getProductById(
                  matchedItem.variantId,
                  name: matchedItem.productName,
                  variantName: matchedItem.variantName,
                  price: getEffectivePrice(matchedItem),
                  imageAsset: matchedItem.imageAsset,
                  isSubscribable: matchedItem.isSubscribable,
                  isOneTime: matchedItem.isOneTime,
                );
                final qty = items[key] ?? 0;
                final isChecked = _selectedItems[key] ?? true;

                return _CartItemTile(
                  key: ValueKey(key),
                  itemKey: key,
                  product: p,
                  cartItem: matchedItem,
                  baseQty: qty,
                  index: i,
                  isChecked: isChecked,
                  globalOnetimeDate: _globalOnetimeDate,
                  globalOnetimeSlot: _globalOnetimeSlot,
                  onCheckChanged: (val) {
                    setState(() {
                      _selectedItems[key] = val ?? false;
                    });
                  },
                );
              },
            ),
        ],
      ),
    );
  }




  // ===== Bill Summary =====

  /// Shows the bill breakdown for one-time cart items.
  Widget _buildBillSummary(List<CartItemEntity> filteredItems) {
    double subtotal = 0;
    final List<Widget> itemRows = [];

    for (final item in filteredItems) {
      final key = '${item.variantId}_once';
      if (_selectedItems[key] ?? true) {
        final price = getEffectivePrice(item);
        final qty = getItemQuantity(item);
        final itemAmount = price * qty;
        final description = '₹${price.toStringAsFixed(0)} × $qty';

        subtotal += itemAmount;

        itemRows.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item.productName} (${item.variantName})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: kText,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        description,
                        style: const TextStyle(
                          fontSize: 10,
                          color: kTextSub,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '₹${itemAmount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          if (itemRows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8.0),
              child: Text(
                'No items selected',
                style: TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: kTextSub,
                ),
              ),
            )
          else
            ...itemRows,
          const Divider(color: kBorderLt, height: 20),
          SummaryRow(
            label: 'Item Total',
            value: '₹${subtotal.toStringAsFixed(0)}',
            isBold: true,
            fontSize: 14,
            valueColor: kPrimary,
          ),
        ],
      ),
    );
  }

  // ===== Checkout Bottom Action =====

  Widget _buildBottomAction(
    BuildContext context,
    double total,
    List<String> itemKeys,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: kSurface,
        border: const Border(top: BorderSide(color: kBorderLt)),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: ElevatedButton(
          onPressed: () {
            final selectedKeys = itemKeys
                .where((k) => _selectedItems[k] ?? true)
                .toList();

            if (selectedKeys.isEmpty) {
              F2HToast.error(
                context,
                'Please select at least one item to proceed.',
              );
              return;
            }

            // Navigate to Checkout Screen
            context.runWithAuth(() {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CheckoutScreen(selectedItemIds: selectedKeys),
                ),
              );
            });
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: kPrimary,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '₹${total.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              const Row(
                children: [
                  Text(
                    'PROCEED TO CHECKOUT',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_forward_rounded, size: 16),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ===== One-Time Configuration =====

  /// Global date and slot selector for all one-time items.
  Widget _buildGlobalOneTimeConfiguration(
    BuildContext context,
    List<CartItemEntity> items,
  ) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_shipping_rounded, size: 16, color: kPrimary),
              SizedBox(width: 8),
              Text(
                'One-Time Delivery Schedule',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'DELIVERY DATE',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: kTextSub,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => _selectGlobalDate(context, items),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kBorder),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.calendar_today_rounded,
                    size: 16,
                    color: kPrimary,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _globalOnetimeDate != null
                          ? 'Delivery Date: ${_globalOnetimeDate!.day}/${_globalOnetimeDate!.month}/${_globalOnetimeDate!.year}'
                          : 'Select Delivery Date',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.keyboard_arrow_right_rounded,
                    size: 18,
                    color: kTextSub,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),
          const Text(
            'DELIVERY SLOT',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: kTextSub,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          // ===== Slot visibility based on selected date =====
          // Today → Evening only; Tomorrow+ → both Morning and Evening
          Builder(
            builder: (context) {
              final now = DateTime.now();
              final slots = getAvailableSlots(_globalOnetimeDate ?? now, now);
              return Row(
                children: [
                  if (slots.contains('Morning')) ...[
                    Expanded(
                      child: _buildGlobalSlotOption(
                        'Morning',
                        Icons.wb_sunny_rounded,
                        Colors.white,
                        Colors.orange.shade300,
                        items,
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: _buildGlobalSlotOption(
                      'Evening',
                      Icons.nightlight_round,
                      kTextMid,
                      Colors.blueGrey.shade100,
                      items,
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _selectGlobalDate(
    BuildContext context,
    List<CartItemEntity> items,
  ) async {
    final now = DateTime.now();
    final firstDate = getFirstAllowedDate(now);

    final DateTime? picked = await showCustomDatePicker(
      context: context,
      initialDate: _globalOnetimeDate ?? firstDate,
      firstDate: firstDate,
      lastDate: now.add(const Duration(days: 30)),
      title: 'Select Delivery Date',
    );

    if (picked != null) {
      setState(() {
        _globalOnetimeDate = picked;
        // Auto-update slot based on new date:
        // Today → Evening only, Tomorrow+ → keep current or default to Morning
        final availableSlots = getAvailableSlots(picked, now);
        if (!availableSlots.contains(_globalOnetimeSlot)) {
          _globalOnetimeSlot = getDefaultSlot(picked, now);
        }
      });
      _syncGlobalOnetimeToBloc(items);
    }
  }

  /// Syncs the global date/slot to all one-time items in the cart.
  void _syncGlobalOnetimeToBloc(List<CartItemEntity> items) {
    final dateStr =
        (_globalOnetimeDate ?? DateTime.now().add(const Duration(days: 1)))
            .toString()
            .split(' ')[0];

    final updatedItems = items.map((item) {
      if (item.purchaseType == 'onetime') {
        return item.copyWith(
          deliveryDate: dateStr,
          deliverySlot: _globalOnetimeSlot,
        );
      }
      return item;
    }).toList();

    context.read<CartBloc>().add(SyncCartEvent(updatedItems));
  }

  Widget _buildGlobalSlotOption(
    String title,
    IconData icon,
    Color iconColorInactive,
    Color iconColorActive,
    List<CartItemEntity> items,
  ) {
    final isSel = _globalOnetimeSlot == title;
    return GestureDetector(
      onTap: () {
        setState(() => _globalOnetimeSlot = title);
        _syncGlobalOnetimeToBloc(items);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFFFFC107) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSel ? const Color(0xFFFFB300) : kBorderLt,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isSel ? Colors.white : iconColorInactive,
            ),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isSel ? Colors.white : kText,
              ),
            ),
            if (isSel) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.check_circle_rounded,
                size: 14,
                color: Colors.white,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CART ITEM TILE
//
//  Renders a single one-time order item in the cart list.
// ═══════════════════════════════════════════════════════════════════════════

class _CartItemTile extends StatefulWidget {
  final String itemKey;
  final Product product;
  final CartItemEntity? cartItem;
  final int baseQty;
  final int index;
  final bool isChecked;
  final Function(bool?) onCheckChanged;
  final DateTime? globalOnetimeDate;
  final String globalOnetimeSlot;

  const _CartItemTile({
    super.key,
    required this.itemKey,
    required this.product,
    this.cartItem,
    required this.baseQty,
    required this.index,
    required this.isChecked,
    required this.onCheckChanged,
    required this.globalOnetimeDate,
    required this.globalOnetimeSlot,
  });

  @override
  State<_CartItemTile> createState() => _CartItemTileState();
}

class _CartItemTileState extends State<_CartItemTile> {
  /// Whether a cart update is in progress (shows spinner on counter)
  bool _isUpdating = false;

  @override
  void didUpdateWidget(covariant _CartItemTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_isUpdating) {
      setState(() {
        _isUpdating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final displayPrice = p.price;
    final effectiveQty = widget.baseQty;
    final bgColor = widget.index % 2 == 0 ? Colors.white : kBg;

    return Container(
      color: bgColor,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: widget.isChecked,
            activeColor: kPrimary,
            onChanged: widget.onCheckChanged,
          ),
          const SizedBox(width: 2),
          GestureDetector(
            onTap: () {
              Product fullProduct = p;
              final catState = context.read<CatalogBloc>().state;
              if (catState is CatalogLoaded) {
                final match = catState.products.cast<Product?>().firstWhere(
                  (cp) =>
                      cp!.id == (widget.cartItem?.productId ?? p.id) ||
                      cp.variants.any((v) => v.id == p.id),
                  orElse: () => null,
                );
                if (match != null) fullProduct = match;
              }
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductDetailViewScreen(product: fullProduct),
                ),
              );
            },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 68,
                height: 68,
                color: Colors.white,
                padding: const EdgeInsets.all(2),
                child: buildProductImage(
                  p.name,
                  imageAsset: p.imageAsset,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: kText,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${p.unit} · ₹${displayPrice.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: kTextSub,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () {
                        if (widget.cartItem != null) {
                          setState(() {
                            _isUpdating = true;
                          });
                          context.read<CartBloc>().add(
                                DeleteCartItemEvent(widget.cartItem!),
                              );
                        }
                      },
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.all(4.0),
                        child: Icon(
                          Icons.close_rounded,
                          size: 18,
                          color: kTextMid,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildBaseCounter(p, effectiveQty),
                    Text(
                      '₹${(displayPrice * effectiveQty).toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: kText,
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
  }

  Widget _buildBaseCounter(Product p, int qty) {
    void dispatchAdd() {
      setState(() {
        _isUpdating = true;
      });
      final cartItem = CartItemEntity(
        productId: widget.cartItem?.productId ?? p.id,
        variantId: widget.cartItem?.variantId ?? p.id,
        productName: p.name,
        variantName: p.unit,
        unitPrice: p.price,
        purchaseType: 'onetime',
        quantity: 1,
        deliveryDate: (widget.globalOnetimeDate ?? DateTime.now().add(const Duration(days: 1)))
            .toString()
            .split(' ')[0],
        deliverySlot: widget.globalOnetimeSlot,
        imageAsset: widget.cartItem?.imageAsset ?? p.imageAsset,
        isSubscribable: p.isSubscribable,
        isOneTime: p.isOneTime,
      );
      context.read<CartBloc>().add(AddToCartEvent(cartItem));
    }

    void dispatchRemove() {
      setState(() {
        _isUpdating = true;
      });
      final cartItem = CartItemEntity(
        productId: widget.cartItem?.productId ?? p.id,
        variantId: widget.cartItem?.variantId ?? p.id,
        productName: p.name,
        variantName: p.unit,
        unitPrice: p.price,
        purchaseType: 'onetime',
        quantity: 1,
        deliveryDate: (widget.globalOnetimeDate ?? DateTime.now().add(const Duration(days: 1)))
            .toString()
            .split(' ')[0],
        deliverySlot: widget.globalOnetimeSlot,
        imageAsset: widget.cartItem?.imageAsset ?? p.imageAsset,
        isSubscribable: p.isSubscribable,
        isOneTime: p.isOneTime,
      );
      context.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
    }

    return QuantityCounter(
      quantity: qty,
      isLoading: _isUpdating,
      onDecrement: dispatchRemove,
      onIncrement: dispatchAdd,
    );
  }
}
