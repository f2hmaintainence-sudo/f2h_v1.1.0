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
import '../../../../core/session/customer_session_state.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/data/models/profile_address.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/widgets/app_refresh_indicator.dart';
import '../../../../core/widgets/cow_loading_widget.dart';
import '../../../../core/guards/auth_guard.dart';
import '../../../../core/network/network_bloc.dart';
import '../../../../core/network/network_state.dart';
import '../../../../core/widgets/scrolling_items_loader.dart';
import 'product_detail_view_screen.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../bloc/catalog_event.dart';
import '../helpers/cart_helpers.dart';
import '../widgets/cart_widgets.dart';
import '../widgets/product_grid_card.dart';
import 'home_screen.dart';



// ═══════════════════════════════════════════════════════════════════════════
//  CART SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

/// Finds the live catalog entry for a cart line's variant.
///
/// A product card IS a variant, so the id matches either a Product directly or
/// one of its sibling variants. Returns null when the catalog has not loaded,
/// in which case callers must not assume the item is in stock — the server
/// revalidates on checkout regardless.
ProductVariant? _findCatalogVariant(BuildContext context, String variantId) {
  final state = context.read<CatalogBloc>().state;
  if (state is! CatalogLoaded) return null;
  for (final product in state.products) {
    for (final v in product.variants) {
      if (v.id == variantId) return v;
    }
    if (product.id == variantId) {
      return product.allVariants.firstWhere(
        (v) => v.id == variantId,
        orElse: () => ProductVariant(
          id: product.id,
          label: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          isOutOfStock: product.isOutOfStock,
          isLowStock: product.isLowStock,
        ),
      );
    }
  }
  return null;
}

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

  /// Global delivery date for all one-time items.
  DateTime? _globalOnetimeDate;

  /// Global delivery slot for all one-time items ('Morning' or 'Evening').
  String _globalOnetimeSlot = 'Morning';

  @override
  void initState() {
    super.initState();
    // Load cart on first build if not already loaded and refresh session/slot timings
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerSessionCubit>().refreshSilently();
      final bloc = context.read<CartBloc>();
      final sessionState = context.read<CustomerSessionCubit>().state;
      final customerId = sessionState.profile?.customerId;
      if (bloc.state is CartInitialState && customerId != null) {
        bloc.add(LoadCartEvent(customerId));
      }
      final catBloc = context.read<CatalogBloc>();
      if (catBloc.state is! CatalogLoaded) {
        String? branchId;
        try {
          if (sessionState.addresses.isNotEmpty) {
            final def = sessionState.addresses.firstWhere(
              (a) => a.isDefault,
              orElse: () => sessionState.addresses.first,
            );
            if (def.branchId.isNotEmpty) branchId = def.branchId;
          }
        } catch (_) {}
        catBloc.add(LoadCatalog(branchId: branchId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;
  
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9F8),
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kText),
          onPressed: () => Navigator.maybePop(context),
        ),
        iconTheme: const IconThemeData(color: kText, size: 20),
        title: const Text(
          'Your Cart',
          style: TextStyle(
            color: kText,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
        centerTitle: true,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: Color(0xFFEDF1EE)),
        ),
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
                final now = DateTime.now();
                final firstAllowedDate = getFirstAllowedDate(now, sessionState.slotTimings);

                if (_globalOnetimeDate == null) {
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
                      firstOnetime.deliverySlot != null &&
                      firstOnetime.deliverySlot!.trim().isNotEmpty) {
                    final raw = firstOnetime.deliverySlot!.trim();
                    _globalOnetimeSlot = raw.toLowerCase() == 'evening' ? 'Evening' : 'Morning';
                  }
                }

                // If selected date is before firstAllowedDate (e.g. today's cutoff has passed), move to firstAllowedDate
                if (_globalOnetimeDate == null || _globalOnetimeDate!.isBefore(firstAllowedDate)) {
                  _globalOnetimeDate = firstAllowedDate;
                }

                // Ensure slot is valid for the selected date
                final availableSlots = getAvailableSlots(
                  _globalOnetimeDate!,
                  now,
                  sessionState.slotTimings,
                );
                if (!availableSlots.contains(_globalOnetimeSlot) || _globalOnetimeSlot.isEmpty) {
                  _globalOnetimeSlot = getDefaultSlot(
                    _globalOnetimeDate!,
                    now,
                    sessionState.slotTimings,
                  );
                }
                if (_globalOnetimeSlot.isEmpty) {
                  _globalOnetimeSlot = availableSlots.isNotEmpty ? availableSlots.first : 'Morning';
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
                                      // ===== Delivery Address Card =====
                                      _buildDeliveryAddressCard(
                                        context,
                                        sessionState,
                                      ),

                                      // ===== Cart Items List (One-Time Only) =====
                                      _buildItemsCard(
                                        context,
                                        displayItemKeys,
                                        displayItems,
                                        filteredItems,
                                      ),
                                      const SizedBox(height: 16),

                                      // ===== Related Products Carousel =====
                                      _buildRelatedProducts(filteredItems),
                                      const SizedBox(height: 16),

                                      // ===== Bill Summary =====
                                      _buildBillSummary(filteredItems),
                                      const SizedBox(height: 24),

                                    ],
                                  ),
                                ),
                              ),
                            ),

                            // ===== Checkout & Delivery Date Bottom Bar =====
                            _buildBottomAction(
                              context,
                              finalGrandTotal,
                              displayItemKeys,
                              filteredItems,
                            ),
                          ],

                        ),
                        // Loading overlay
                        if (state is CartLoadingState)
                          const Positioned.fill(
                            child: CowLoadingOverlay(message: 'Updating cart...'),
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
                // The cart is a pushed route, so leave it before switching tabs.
                if (Navigator.canPop(context)) Navigator.pop(context);
                AppShell.of(context)?.setTab(1);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Start Shopping',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward_rounded, size: 18),
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
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: kText,
                    letterSpacing: -0.2,
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
          const Divider(color: Color(0xFFF1F4F2), height: 1),

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
              separatorBuilder: (_, _) =>
                  const Divider(color: Color(0xFFF1F4F2), height: 1),
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

                // getProductById synthesizes a Product from the cart row and
                // knows nothing about stock, so look the variant up in the
                // catalog and carry its real flags across. Without this the
                // cart shows a sold-out line as freshly addable.
                final catalogMatch = _findCatalogVariant(context, matchedItem.variantId);
                final p = getProductById(
                  matchedItem.variantId,
                  name: matchedItem.productName,
                  variantName: matchedItem.variantName,
                  price: getEffectivePrice(matchedItem),
                  imageAsset: matchedItem.imageAsset,
                  isSubscribable: matchedItem.isSubscribable,
                  isOneTime: matchedItem.isOneTime,
                  isOutOfStock: catalogMatch?.isOutOfStock ?? false,
                  isLowStock: catalogMatch?.isLowStock ?? false,
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
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: kText,
              letterSpacing: -0.2,
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
    List<CartItemEntity> filteredItems,
  ) {
    final now = DateTime.now();
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final date = _globalOnetimeDate ?? getDefaultDeliveryDate(now, sessionState.slotTimings);
    final slot = _globalOnetimeSlot;
    final dateFormatted = '${date.day}/${date.month}/${date.year}';
    final slotInitial = slot.isNotEmpty ? ' (${slot[0]})' : '';
    final hasOnetimeItems =
        filteredItems.any((item) => item.purchaseType == 'onetime');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: kSurface,
        border: const Border(top: BorderSide(color: kBorderLt)),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Button 1 (Left): Delivery Date Button (if one-time items exist)
            if (hasOnetimeItems) ...[
              Expanded(
                flex: 5,
                child: GestureDetector(
                  onTap: () => _selectGlobalDate(context, filteredItems),
                  child: Container(
                    height: 50,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: kBorderLt),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.calendar_today_rounded,
                          size: 16,
                          color: kPrimary,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            '$dateFormatted$slotInitial',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: kPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.edit_rounded,
                          size: 13,
                          color: kPrimary,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
            ],

            // Button 2 (Right): Proceed to Checkout Button (without price)
            Expanded(
              flex: 6,
              child: SizedBox(
                height: 50,
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
                    context.runWithAuth(() async {
                      final sessionCubit = context.read<CustomerSessionCubit>();
                      final session = sessionCubit.state;
                      if (session.addresses.isEmpty) {
                        final chosen =
                            await AddressSelectorDrawer.show(context);
                        if (context.mounted) {
                          await sessionCubit.refreshSilently();
                          final updatedSession = sessionCubit.state;
                          if (updatedSession.addresses.isEmpty) {
                            F2HToast.error(
                              context,
                              'Please select or add a delivery address to proceed.',
                            );
                            return;
                          }
                        }
                      }

                      if (context.mounted) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                CheckoutScreen(selectedItemIds: selectedKeys),
                          ),
                        );
                      }
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Checkout',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          letterSpacing: 0.1,
                        ),
                      ),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, size: 18),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeliveryAddressCard(
    BuildContext context,
    CustomerSessionState sessionState,
  ) {
    final list = sessionState.addresses;
    if (list.isEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kRed.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: kRed.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.location_off_rounded,
                size: 20,
                color: kRed,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'No Delivery Address',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: kRed,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Add an address to proceed with order',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: kTextSub,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                final chosen = await AddressSelectorDrawer.show(context);
                if (chosen != null && context.mounted) {
                  await context.read<CustomerSessionCubit>().refreshSilently();
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                visualDensity: VisualDensity.compact,
              ),
              child: const Text(
                'Add Address',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
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

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: kPrimaryPl,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.location_on_rounded,
              size: 20,
              color: kPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Delivery to ${primaryAddress.addressType.toUpperCase()}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: kTextSub,
                        letterSpacing: 0.3,
                      ),
                    ),
                    if (primaryAddress.isDefault) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: kPrimaryPl,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'DEFAULT',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: kPrimary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  primaryAddress.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 1),
                Text(
                  primaryAddress.detail,
                  style: const TextStyle(
                    fontSize: 11,
                    color: kTextSub,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () async {
              final chosen = await AddressSelectorDrawer.show(context);
              if (chosen != null && context.mounted) {
                await context.read<CustomerSessionCubit>().refreshSilently();
              }
            },
            style: TextButton.styleFrom(
              foregroundColor: kPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              visualDensity: VisualDensity.compact,
            ),
            child: const Text(
              'Change',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
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
    final sessionState = context.read<CustomerSessionCubit>().state;
    final firstDate = getFirstAllowedDate(now, sessionState.slotTimings);

    final DateSlotResult? result = await showCustomDateAndSlotPicker(
      context: context,
      initialDate: _globalOnetimeDate ?? firstDate,
      initialSlot: _globalOnetimeSlot,
      firstDate: firstDate,
      lastDate: now.add(const Duration(days: 30)),
      title: 'Select Delivery Date',
      slotTimings: sessionState.slotTimings,
    );

    if (result != null) {
      setState(() {
        _globalOnetimeDate = result.date;
        _globalOnetimeSlot = result.slot;
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

  /// Renders non-subscription related product cards with auto-scroll animation like home screen.
  Widget _buildRelatedProducts(List<CartItemEntity> filteredItems) {
    return BlocBuilder<CatalogBloc, CatalogState>(
      builder: (context, state) {
        if (state is! CatalogLoaded || state.products.isEmpty) {
          return const SizedBox.shrink();
        }

        // Filter out subscription products AND products already in cart
        final cartVariantIds = filteredItems.map((i) => i.variantId).toSet();
        final relatedProducts = state.products
            .where((p) => !p.isSubscribable && !cartVariantIds.contains(p.id) && !p.isOutOfStock)
            .toList();

        if (relatedProducts.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, size: 16, color: kPrimary),
                  SizedBox(width: 6),
                  Text(
                    'You Might Also Like',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            InfiniteAutoScrollList(
              height: 285,
              itemWidth: 165,
              autoScrollInterval: const Duration(milliseconds: 10000),
              scrollDuration: const Duration(milliseconds: 1000),
              animateClockwise: false,
              items: relatedProducts
                  .map(
                    (p) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: SizedBox(
                        width: 165,
                        child: ProductGridCard(p),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        );
      },
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

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(6, 14, 14, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: widget.isChecked,
            activeColor: kPrimary,
            checkColor: Colors.white,
            side: const BorderSide(color: Color(0xFFC7D0CB), width: 1.6),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(5),
            ),
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
            child: Container(
              width: 72,
              height: 72,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F9F8),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEDF1EE)),
              ),
              child: buildProductImage(
                p.name,
                imageAsset: p.imageAsset,
                fit: BoxFit.contain,
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
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: kText,
                              letterSpacing: -0.2,
                              height: 1.25,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${p.unit}  ·  ₹${displayPrice.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: kPrimary,
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
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3F5F4),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 16,
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
                        fontSize: 20,
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
    final matchedVar = p.allVariants.where((v) => v.id == (widget.cartItem?.variantId ?? p.id)).firstOrNull;
    final maxStock = matchedVar?.maxStock ?? p.maxStock;
    final isAtMaxStock = qty >= maxStock;

    void dispatchAdd() {
      if (qty + 1 > maxStock) {
        F2HToast.error(context, 'Only $maxStock unit(s) available in stock');
        return;
      }
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
      onIncrement: isAtMaxStock
          ? () => F2HToast.error(context, 'Only $maxStock unit(s) available in stock')
          : dispatchAdd,
      canIncrement: !p.isOutOfStock && !isAtMaxStock,
    );
  }
}
