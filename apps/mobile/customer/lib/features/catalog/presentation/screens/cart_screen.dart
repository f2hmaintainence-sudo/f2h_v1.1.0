// ═══════════════════════════════════════════════════════════════════════════
//  CART SCREEN
//
//  Displays the shopping cart with two modes:
//    • Buy One-Time  — single delivery with date/slot selection
//    • Subscribe     — recurring deliveries with Daily or Custom schedule
//
//  BUSINESS RULES:
//    • Subscription items ALWAYS use variant.subscription_price
//    • One-time items ALWAYS use variant.price (normal selling price)
//    • Subscription Payment Type (Prepaid/Postpaid) is managed in Checkout
//
//  SUBSCRIPTION MODES:
//    • Daily   — Mon–Sun, Morning slot, user only changes quantity
//    • Custom  — User picks specific days and Morning/Evening quantities
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/checkout_screen.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/widgets/custom_date_picker.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/core/widgets/app_refresh_indicator.dart';
import 'package:f2h_customer/core/guards/auth_guard.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';
import 'package:f2h_customer/core/network/network_state.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_state.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/cart_widgets.dart';

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
  /// Key format: "{variantId}_{sub|once}"
  final Map<String, bool> _selectedItems = {};

  /// Tracks the currently selected day per tile in Custom subscription mode.
  final Map<String, String> _tileSelectedDays = {};

  /// Whether the address is currently being loaded (unused, preserved for compatibility).
  // ignore: unused_field
  bool _isAddressLoading = false;

  /// Whether subscription information is expanded.
  bool _showSubscriptionInfo = false;
  
  /// Global delivery date for all one-time items.
  DateTime? _globalOnetimeDate;

  /// Global delivery slot for all one-time items ('Morning' or 'Evening').
  String _globalOnetimeSlot = 'Morning';

  /// User override for subscription vs one-time mode.
  /// null = auto-detect from items, true = subscription, false = one-time.
  bool? _isSubscriptionCartOverride;

  /// Subscription schedule mode is always 'daily' (all 7 days, M+E editable).
  /// The Daily/Custom toggle has been removed — all days are auto-selected.
  final String _subscriptionMode = 'daily';

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
  
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Shopping Cart',
          style: TextStyle(
            color: kText,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: authState is! Authenticated
          ? _buildEmptyState(context)
          : BlocBuilder<CartBloc, CartState>(
              builder: (context, state) {
                if (state is CartErrorState) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Colors.red, size: 64),
                          const SizedBox(height: 16),
                          Text(
                            state.message,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: kText, fontSize: 16),
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

                // ===== Determine Cart Mode =====
                // Show the One-Time/Subscribe toggle only if at least one item
                // in the cart is subscribable.
                final showToggle = state.items.any((item) {
                  final p = getProductById(
                    item.variantId,
                    isSubscribable: item.isSubscribable,
                  );
                  return p.isSubscribable;
                });

                final isSubscriptionCart = showToggle
                    ? (_isSubscriptionCartOverride ?? true)
                    : false;

                // ===== Filter Items by Cart Mode =====
                // Show only subscription or one-time items based on the toggle.
                // If switching modes, auto-convert items that don't have an entry
                // in the target mode.
                final List<CartItemEntity> filteredItems;
                if (isSubscriptionCart) {
                  final Map<String, CartItemEntity> uniqueSubscription = {};
                  // First, collect existing subscription items
                  for (final item in state.items) {
                    if (item.purchaseType == 'subscription') {
                      uniqueSubscription[item.variantId] = item;
                    }
                  }
                  // Then, auto-create subscription versions of subscribable items
                  // that don't already have a subscription entry
                  for (final item in state.items) {
                    final p = getProductById(
                      item.variantId,
                      isSubscribable: item.isSubscribable,
                    );
                    if (p.isSubscribable &&
                        !uniqueSubscription.containsKey(item.variantId)) {
                      uniqueSubscription[item.variantId] = item.copyWith(
                        purchaseType: 'subscription',
                        schedules: [
                          SubscriptionSchedule(
                            day: 0,
                            mQuantity: 1,
                            eQuantity: 0,
                          ),
                        ],
                        quantity: null,
                      );
                    }
                  }
                  filteredItems = uniqueSubscription.values.toList();
                } else {
                  final Map<String, CartItemEntity> uniqueOnetime = {};
                  // First, collect existing one-time items
                  for (final item in state.items) {
                    if (item.purchaseType == 'onetime') {
                      uniqueOnetime[item.variantId] = item;
                    }
                  }
                  // Then, auto-create one-time versions of items that
                  // don't already have a one-time entry
                  for (final item in state.items) {
                    if (!uniqueOnetime.containsKey(item.variantId)) {
                      // Default to qty=1 for newly-created one-time view
                      // (don't derive from subscription schedule totals)
                      uniqueOnetime[item.variantId] = item.copyWith(
                        purchaseType: 'onetime',
                        quantity: 1,
                        schedules: null,
                        deliveryDate: _globalOnetimeDate!.toString().split(
                          ' ',
                        )[0],
                        deliverySlot: _globalOnetimeSlot,
                      );
                    }
                  }
                  filteredItems = uniqueOnetime.values.toList();
                }

                // ===== Build Display Items Map =====
                final Map<String, int> displayItems = {};
                final List<String> displayItemKeys = [];

                for (final item in filteredItems) {
                  final isSub = item.purchaseType == 'subscription';
                  final key = '${item.variantId}_${isSub ? "sub" : "once"}';

                  int qty = 1;
                  if (isSub) {
                    qty = 1; // Subscription quantity shown via schedule
                  } else {
                    qty = item.quantity ?? 1;
                  }

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
                // Uses shared helpers for consistent pricing
                // For subscription items: use delivery-count estimated amount
                // For one-time items: use unitPrice × quantity
                double selectedSubtotal = 0;
                for (final item in filteredItems) {
                  final isSub = item.purchaseType == 'subscription';
                  final key = '${item.variantId}_${isSub ? "sub" : "once"}';
                  if (_selectedItems[key] ?? true) {
                    if (isSub) {
                      // Subscription: use tomorrow to end of month for "This Month Estimate"
                      final tomorrow = DateTime.now().add(const Duration(days: 1));
                      final estimate = calculateSubscriptionEstimate([
                        item,
                      ], tomorrow);
                      selectedSubtotal += estimate.estimatedAmount;
                    } else {
                      // One-time: simple price × quantity
                      final price = getEffectivePrice(item);
                      final qty = getItemQuantity(item);
                      selectedSubtotal += price * qty;
                    }
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
                                      // ===== Cart Items List =====
                                      _buildItemsCard(
                                        context,
                                        displayItemKeys,
                                        displayItems,
                                        isSubscriptionCart,
                                        showToggle,
                                        filteredItems,
                                      ),
                                      const SizedBox(height: 16),

                                      // ===== One-Time Configuration =====
                                      // Show date/slot selector only for one-time items
                                      if (filteredItems.any(
                                        (item) =>
                                            item.purchaseType == 'onetime',
                                      )) ...[
                                        _buildGlobalOneTimeConfiguration(
                                          context,
                                          filteredItems,
                                        ),
                                        const SizedBox(height: 16),
                                      ],

                                      // ===== Info Tooltip =====
                                      // Show contextual explanation based on current mode
                                      if (!isSubscriptionCart) ...[
                                        ExpansionTile(
                                          initiallyExpanded: false,
                                          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                                          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                          leading: const Icon(Icons.info_outline, color: kPrimary),
                                          title: const Text(
                                            'Order Information',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 14,
                                            ),
                                          ),
                                          subtitle: const Text(
                                            'View ordering information',
                                            style: TextStyle(fontSize: 11),
                                          ),
                                          children: [
                                            InfoTooltipCard.oneTimeOrder(),
                                          ],
                                        ),

                                        const SizedBox(height: 16),
                                      ],

                                      // ===== Subscription Information =====
                                      if (isSubscriptionCart) ...[
                                        Card(
                                          elevation: 0,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            side: const BorderSide(color: Color(0xFFE5E7EB)),
                                          ),
                                          child: Column(
                                            children: [
                                              ListTile(
                                                dense: true,
                                                contentPadding: const EdgeInsets.symmetric(
                                                  horizontal: 16,
                                                  vertical: 4,
                                                ),
                                                leading: const Icon(
                                                  Icons.info_outline,
                                                  color: kPrimary,
                                                  size: 20,
                                                ),
                                                title: const Text(
                                                  'Subscription Information',
                                                  style: TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                                subtitle: const Text(
                                                  'View subscription calculation details',
                                                  style: TextStyle(fontSize: 11),
                                                ),
                                                trailing: Icon(
                                                  _showSubscriptionInfo
                                                      ? Icons.keyboard_arrow_up
                                                      : Icons.keyboard_arrow_down,
                                                ),
                                                onTap: () {
                                                  setState(() {
                                                    _showSubscriptionInfo = !_showSubscriptionInfo;
                                                  });
                                                },
                                              ),

                                              AnimatedCrossFade(
                                                duration: const Duration(milliseconds: 250),
                                                crossFadeState: _showSubscriptionInfo
                                                    ? CrossFadeState.showSecond
                                                    : CrossFadeState.showFirst,
                                                firstChild: const SizedBox.shrink(),
                                                secondChild: Padding(
                                                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                                  child: Column(
                                                    children: [
                                                      InfoTooltipCard.dailySchedule(),
                                                      const SizedBox(height: 8),
                                                      InfoTooltipCard.subscriptionPrice(),
                                                      const SizedBox(height: 16),
                                                      _buildSubscriptionSummary(filteredItems),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),

                                        const SizedBox(height: 16),
                                      ],

                                      // ===== Bill Summary =====
                                      _buildBillSummary(
                                        filteredItems,
                                        isSubscriptionCart,
                                      ),
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
    bool isSubscriptionCart,
    bool showToggle,
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

          // ===== One-Time / Subscribe Toggle =====
          // Only shown when at least one item in the cart is subscribable
          if (showToggle) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: PillToggle(
                leftLabel: 'Buy One-Time',
                rightLabel: 'Subscribe',
                leftIcon: Icons.shopping_basket_rounded,
                rightIcon: Icons.repeat_rounded,
                isLeftSelected: !isSubscriptionCart,
                onLeftTap: () =>
                    setState(() => _isSubscriptionCartOverride = false),
                onRightTap: () =>
                    setState(() => _isSubscriptionCartOverride = true),
              ),
            ),

            // ===== Subscription Section =====
            // All days (Mon-Sun) are auto-selected with Morning + Evening qty editable
            if (isSubscriptionCart) ...[const SizedBox(height: 4)],

            const Divider(color: kBorderLt, height: 1),
          ],

          // ===== Items List or Empty State =====
          if (itemKeys.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      isSubscriptionCart
                          ? Icons.repeat_rounded
                          : Icons.shopping_basket_rounded,
                      size: 40,
                      color: kTextSub.withOpacity(0.4),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isSubscriptionCart
                          ? 'No subscription items in your cart'
                          : 'No one-time items in your cart',
                      style: const TextStyle(
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
                      final itemSub = item.purchaseType == 'subscription';
                      final itemKey =
                          '${item.variantId}_${itemSub ? "sub" : "once"}';
                      return itemKey == key;
                    });
                  } catch (_) {}
                }
                if (matchedItem == null) return const SizedBox.shrink();

                // Build the product display model from cart item data
                final p = getProductById(
                  matchedItem.variantId,
                  name: matchedItem.productName,
                  variantName: matchedItem.variantName,
                  price: getEffectivePrice(matchedItem),
                  subscriptionPrice: matchedItem.subscriptionPrice,
                  imageAsset: matchedItem.imageAsset,
                  isSubscribable: matchedItem.isSubscribable,
                  isOneTime: matchedItem.isOneTime,
                );
                final isSub = matchedItem.purchaseType == 'subscription';
                final qty = items[key] ?? 0;
                final isChecked = _selectedItems[key] ?? true;

                return _CartItemTile(
                  key: ValueKey(key),
                  itemKey: key,
                  product: p,
                  cartItem: matchedItem,
                  isSub: isSub,
                  baseQty: qty,
                  index: i,
                  isChecked: isChecked,
                  globalOnetimeDate: _globalOnetimeDate,
                  globalOnetimeSlot: _globalOnetimeSlot,
                  initialSelectedDay: _tileSelectedDays[key] ?? 'Mon',
                  subscriptionMode: _subscriptionMode,
                  onDayChanged: (day) {
                    _tileSelectedDays[key] = day;
                  },
                  onCheckChanged: (val) {
                    setState(() {
                      _selectedItems[key] = val ?? false;
                    });
                  },
                  onToggleMode: () {
                    final bloc = context.read<CartBloc>();
                    if (state is CartLoadedState) {
                      final List<CartItemEntity> currentItems = List.from(
                        state.items,
                      );
                      final oldIndex = currentItems.indexWhere(
                        (item) =>
                            item.productId == matchedItem!.productId &&
                            item.variantId == matchedItem.variantId &&
                            item.purchaseType ==
                                (isSub ? 'subscription' : 'onetime'),
                      );

                      if (oldIndex >= 0) {
                        currentItems.removeAt(oldIndex);
                      }

                      if (!isSub) {
                        if (!matchedItem!.isSubscribable) return;
                        final schedules = List.generate(
                          7,
                          (i) => SubscriptionSchedule(
                            day: i,
                            mQuantity: 1,
                            eQuantity: 0,
                          ),
                        );
                        currentItems.add(
                          CartItemEntity(
                            productId: matchedItem.productId,
                            variantId: matchedItem.variantId,
                            productName: matchedItem.productName,
                            variantName: matchedItem.variantName,
                            unitPrice: matchedItem.unitPrice,
                            purchaseType: 'subscription',
                            schedules: schedules,
                            imageAsset: matchedItem.imageAsset,
                            isSubscribable: matchedItem.isSubscribable,
                            isOneTime: matchedItem.isOneTime,
                            subscriptionPrice: matchedItem.subscriptionPrice,
                          ),
                        );
                      } else {
                        final dateStr =
                            (_globalOnetimeDate ??
                                    DateTime.now().add(const Duration(days: 1)))
                                .toString()
                                .split(' ')[0];
                        currentItems.add(
                          CartItemEntity(
                            productId: matchedItem!.productId,
                            variantId: matchedItem.variantId,
                            productName: matchedItem.productName,
                            variantName: matchedItem.variantName,
                            unitPrice: matchedItem.unitPrice,
                            purchaseType: 'onetime',
                            quantity: qty,
                            deliveryDate: dateStr,
                            deliverySlot: _globalOnetimeSlot,
                            imageAsset: matchedItem.imageAsset,
                            isSubscribable: matchedItem.isSubscribable,
                            isOneTime: matchedItem.isOneTime,
                          ),
                        );
                      }
                      bloc.add(SyncCartEvent(currentItems));
                    }
                  },
                );
              },
            ),
        ],
      ),
    );
  }

  // ===== Daily Mode Helper =====

  /// When switching to Daily mode, auto-set all subscription items to
  /// Mon–Sun with existing Morning + Evening quantities preserved.
  /// If no existing quantities, defaults to Morning=1, Evening=0.


  // ===== Subscription Summary =====

  /// Shows estimated subscription cost for BOTH This Month (tomorrow to end of month)
  /// and Full Month (1st to end of month).
  Widget _buildSubscriptionSummary(List<CartItemEntity> filteredItems) {
    final subItems = filteredItems
        .where((item) => item.purchaseType == 'subscription')
        .toList();

    final now = DateTime.now();
    final tomorrow = now.add(const Duration(days: 1));
    final fullMonthStart = DateTime(now.year, now.month, 1);
    final endOfMonth = DateTime(now.year, now.month + 1, 0);

    final estThisMonth = calculateSubscriptionEstimate(subItems, tomorrow);
    final estFullMonth = calculateSubscriptionEstimate(subItems, fullMonthStart);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.analytics_rounded, size: 16, color: kAccent),
              SizedBox(width: 8),
              Text(
                'Subscription Estimates',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ===== This Month Section =====
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: kAccentLt.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kAccent.withValues(alpha: 0.15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'THIS MONTH ESTIMATE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: kAccent,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: kAccent,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'CHECKOUT VALUE',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${tomorrow.day}/${tomorrow.month}/${tomorrow.year} to ${endOfMonth.day}/${endOfMonth.month}/${endOfMonth.year}',
                  style: const TextStyle(
                    fontSize: 9.5,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Divider(color: kBorderLt, height: 16),
                SummaryRow(
                  label: 'Delivery Days',
                  value: '${estThisMonth.totalDays} days',
                ),
                const SizedBox(height: 4),
                SummaryRow(
                  label: 'Estimated Quantity',
                  value: '${estThisMonth.totalQuantity} items',
                ),
                const SizedBox(height: 4),
                SummaryRow(
                  label: 'Subscription Price Total',
                  value: '₹${estThisMonth.estimatedAmount.toStringAsFixed(0)}',
                  isBold: true,
                  valueColor: kAccent,
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ===== Full Month Section =====
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'FULL MONTH ESTIMATE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: kTextSub,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${fullMonthStart.day}/${fullMonthStart.month}/${fullMonthStart.year} to ${endOfMonth.day}/${endOfMonth.month}/${endOfMonth.year}',
                  style: const TextStyle(
                    fontSize: 9.5,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Divider(color: kBorderLt, height: 16),
                SummaryRow(
                  label: 'Delivery Days',
                  value: '${estFullMonth.totalDays} days',
                ),
                const SizedBox(height: 4),
                SummaryRow(
                  label: 'Estimated Quantity',
                  value: '${estFullMonth.totalQuantity} items',
                ),
                const SizedBox(height: 4),
                SummaryRow(
                  label: 'Subscription Price Total',
                  value: '₹${estFullMonth.estimatedAmount.toStringAsFixed(0)}',
                  isBold: true,
                  valueColor: kText,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===== Monthly Savings Card =====

  /// Builds the monthly savings estimation card comparing normal vs subscription pricing.
  /// Uses calculateMonthlySavings() from shared helpers.
  // Widget _buildMonthlySavingsCard(List<CartItemEntity> filteredItems) {
  //   final subItems = filteredItems
  //       .where((item) => item.purchaseType == 'subscription')
  //       .toList();

  //   // Use tomorrow for this month's savings comparison (matches checkout)
  //   final now = DateTime.now();
  //   final tomorrow = now.add(const Duration(days: 1));
  //   final savings = calculateMonthlySavings(subItems, tomorrow);

  //   return MonthlySavingsCard(
  //     normalPriceTotal: savings.normalPriceTotal,
  //     subscriptionTotal: savings.subscriptionTotal,
  //     savings: savings.savings,
  //     savingsPercent: savings.savingsPercent,
  //     totalDeliveryDays: savings.totalDeliveryDays,
  //     totalEstimatedQuantity: savings.totalEstimatedQuantity,
  //   );
  // }

  // ===== Bill Summary =====

  /// Shows the bill breakdown.
  /// For subscription mode: uses delivery-count estimated monthly amount.
  /// For one-time mode: uses normal selling price × quantity.
  Widget _buildBillSummary(
    List<CartItemEntity> filteredItems,
    bool isSubscriptionCart,
  ) {
    // Calculate totals using the correct formula per type
    double subtotal = 0;
    final List<Widget> itemRows = [];

    for (final item in filteredItems) {
      final isSub = item.purchaseType == 'subscription';
      final key = '${item.variantId}_${isSub ? "sub" : "once"}';
      if (_selectedItems[key] ?? true) {
        double itemAmount = 0;
        String description = '';

        if (isSub) {
          // Subscription: calculated from tomorrow to end of month
          final tomorrow = DateTime.now().add(const Duration(days: 1));
          final estimate = calculateSubscriptionEstimate([item], tomorrow);
          itemAmount = estimate.estimatedAmount;
          description = '₹${estimate.unitPrice.toStringAsFixed(0)}/del · ${estimate.totalQuantity} items (${estimate.totalDays} deliveries)';
        } else {
          // One-time: simple price × quantity
          final price = getEffectivePrice(item);
          final qty = getItemQuantity(item);
          itemAmount = price * qty;
          description = '₹${price.toStringAsFixed(0)} × $qty';
        }

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
          Text(
            isSubscriptionCart
                ? 'Subscription Items Summary'
                : 'One-Time Items Summary',
            style: const TextStyle(
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
            label: isSubscriptionCart ? 'This Month\'s Estimate (Checkout Value)' : 'Item Total',
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

  /// Bottom bar with total and "Proceed to Checkout" button.
  /// No longer passes subscriptionPaymentType — Checkout manages it internally.
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

            // Navigate to Checkout without passing subscriptionPaymentType.
            // Checkout now manages its own payment type state internally.
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
//  Renders a single item in the cart list. Handles:
//    • One-time mode: product info + quantity counter
//    • Subscription mode (Daily): product info + single quantity counter
//    • Subscription mode (Custom): product info + day/slot schedule editor
// ═══════════════════════════════════════════════════════════════════════════

class _CartItemTile extends StatefulWidget {
  final String itemKey;
  final Product product;
  final CartItemEntity? cartItem;
  final bool isSub;
  final int baseQty;
  final int index;
  final bool isChecked;
  final Function(bool?) onCheckChanged;
  final VoidCallback onToggleMode;
  final String initialSelectedDay;
  final ValueChanged<String> onDayChanged;
  final DateTime? globalOnetimeDate;
  final String globalOnetimeSlot;

  /// Current subscription mode: 'daily' or 'custom'
  final String subscriptionMode;

  const _CartItemTile({
    super.key,
    required this.itemKey,
    required this.product,
    this.cartItem,
    required this.isSub,
    required this.baseQty,
    required this.index,
    required this.isChecked,
    required this.onCheckChanged,
    required this.onToggleMode,
    required this.initialSelectedDay,
    required this.onDayChanged,
    required this.globalOnetimeDate,
    required this.globalOnetimeSlot,
    this.subscriptionMode = 'daily',
  });

  @override
  State<_CartItemTile> createState() => _CartItemTileState();
}

class _CartItemTileState extends State<_CartItemTile> {
  /// Currently selected day in the Custom schedule day picker
  String _selectedDay = 'Mon';

  /// Whether a cart update is in progress (shows spinner on counter)
  bool _isUpdating = false;

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  /// Tracks the specific slot ('Morning' or 'Evening') currently being updated to isolate the spinner
  String? _updatingSlot;

  // Weekday short names starting from Monday
  static final List<String> _days = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];

  /// Day → Slot → Quantity map for subscription schedules.
  /// Example: { 'Mon': {'Morning': 2, 'Evening': 0}, ... }
  final Map<String, Map<String, int>> _schedule = {};

  @override
  void initState() {
    super.initState();
    _selectedDay = widget.initialSelectedDay;
    _initSchedule();
  }

  /// Initializes the schedule map from the cart item's existing schedules,
  /// or defaults to qty=1 on Monday Morning if no schedules exist.
  void _initSchedule() {
    for (var day in _days) {
      _schedule[day] = {'Morning': 0, 'Evening': 0};
    }
    if (widget.isSub) {
      final itemSchedules = widget.cartItem?.schedules;
      if (itemSchedules != null && itemSchedules.isNotEmpty) {
        final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (final s in itemSchedules) {
          if (s.day >= 0 && s.day < dayNames.length) {
            final dName = dayNames[s.day];
            _schedule[dName]!['Morning'] = s.mQuantity;
            _schedule[dName]!['Evening'] = s.eQuantity;
          }
        }
      } else {
        // Default select Monday with morning 1 quantity
        _schedule['Mon']!['Morning'] = 1;
        _schedule['Mon']!['Evening'] = 0;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            _syncSubscriptionToBloc();
          }
        });
      }
    }
  }

  @override
  void didUpdateWidget(covariant _CartItemTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSelectedDay != oldWidget.initialSelectedDay) {
      _selectedDay = widget.initialSelectedDay;
    }
    if (_isUpdating) {
      setState(() {
        _isUpdating = false;
      });
    }
    if (_updatingSlot != null) {
      setState(() {
        _updatingSlot = null;
      });
    }
    if (widget.isSub && widget.cartItem != oldWidget.cartItem) {
      setState(() {
        _initSchedule();
      });
    }
  }

  /// Total weekly items across all days and slots
  int get _weeklyTotalItems {
    int total = 0;
    for (var slots in _schedule.values) {
      total += (slots['Morning'] ?? 0) + (slots['Evening'] ?? 0);
    }
    return total;
  }

  /// Toggles selection of a specific day slot (setting quantity to 0 or 1).
  Widget _buildSlotSelector(String day, String slot) {
    final qty = _schedule[day]?[slot] ?? 0;
    final isSelected = qty > 0;
    final color = slot == 'Morning' ? kPrimary : const Color(0xFF2E7D32);
    final bgColor = slot == 'Morning' ? kPrimaryPl : const Color(0xFFE8F5E9);

    // Enforce at least one slot selected
    bool canDecrementOrUncheck() {
      int totalOthers = 0;
      _schedule.forEach((dayKey, slots) {
        slots.forEach((slotKey, value) {
          if (dayKey == day && slotKey == slot) {
            // ignore
          } else {
            totalOthers += value;
          }
        });
      });
      return totalOthers > 0;
    }

    void increment() {
      setState(() {
        _schedule[day]![slot] = qty + 1;
      });
      _syncSubscriptionToBloc();
    }

    void decrement() {
      if (qty <= 0) return;
      if (qty == 1) {
        if (!canDecrementOrUncheck()) {
          F2HToast.error(context, 'You must select at least one delivery slot and day for your subscription!');
          return;
        }
        setState(() {
          _schedule[day]![slot] = 0;
        });
        _syncSubscriptionToBloc();
      } else {
        setState(() {
          _schedule[day]![slot] = qty - 1;
        });
        _syncSubscriptionToBloc();
      }
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      decoration: BoxDecoration(
        color: isSelected ? bgColor : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected ? color : kBorder,
          width: isSelected ? 1.5 : 1.0,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Minus Button
          GestureDetector(
            onTap: decrement,
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white : kBg,
                shape: BoxShape.circle,
                border: Border.all(color: isSelected ? color.withOpacity(0.15) : kBorderLt),
              ),
              child: Icon(
                Icons.remove,
                size: 14,
                color: isSelected ? color : kTextSub,
              ),
            ),
          ),
          
          // Quantity display (large & bold)
          Expanded(
            child: Text(
              '$qty',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: isSelected ? color : kTextSub,
              ),
            ),
          ),
          
          // Plus Button
          GestureDetector(
            onTap: increment,
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white : kBg,
                shape: BoxShape.circle,
                border: Border.all(color: isSelected ? color.withOpacity(0.15) : kBorderLt),
              ),
              child: Icon(
                Icons.add,
                size: 14,
                color: isSelected ? color : kTextSub,
              ),
            ),
          ),
        ],
      ),
    );
  }



  /// Converts the local schedule map back to a list of SubscriptionSchedule
  /// objects and syncs to the CartBloc via SyncCartEvent.
  void _syncSubscriptionToBloc() {
    final List<SubscriptionSchedule> schedules = [];
    final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (int i = 0; i < dayNames.length; i++) {
      final day = dayNames[i];
      final mQty = _schedule[day]?['Morning'] ?? 0;
      final eQty = _schedule[day]?['Evening'] ?? 0;
      if (mQty > 0 || eQty > 0) {
        schedules.add(
          SubscriptionSchedule(day: i, mQuantity: mQty, eQuantity: eQty),
        );
      }
    }

    final cartItem = CartItemEntity(
      productId: widget.cartItem?.productId ?? widget.product.id,
      variantId: widget.cartItem?.variantId ?? widget.product.id,
      productName: widget.product.name,
      variantName: widget.product.unit,
      unitPrice: widget.product.price,
      purchaseType: 'subscription',
      schedules: schedules,
      imageAsset: widget.cartItem?.imageAsset ?? widget.product.imageAsset,
      isSubscribable: widget.product.isSubscribable,
      isOneTime: widget.product.isOneTime,
      subscriptionPrice: widget.cartItem?.subscriptionPrice ?? widget.product.subscriptionPrice,
    );

    final bloc = context.read<CartBloc>();
    final state = bloc.state;
    if (state is CartLoadedState) {
      final List<CartItemEntity> currentItems = List.from(state.items);
      final index = currentItems.indexWhere(
        (item) =>
            item.productId == cartItem.productId &&
            item.variantId == cartItem.variantId &&
            item.purchaseType == 'subscription',
      );

      if (index >= 0) {
        if (schedules.isEmpty) {
          currentItems.removeAt(index);
        } else {
          currentItems[index] = cartItem;
        }
      } else if (schedules.isNotEmpty) {
        currentItems.add(cartItem);
      }
      bloc.add(SyncCartEvent(currentItems));
    }
  }

  /// Clears all schedule quantities (sets all days/slots to 0),
  /// except setting Mon Morning to 1 as default to prevent 0 overall items.
  void _clearSchedule() {
    setState(() {
      for (var day in _days) {
        _schedule[day] = {'Morning': 0, 'Evening': 0};
      }
      _schedule['Mon']!['Morning'] = 1;
      _selectedDay = 'Mon';
    });
    _syncSubscriptionToBloc();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;

    // ===== Effective Price Resolution =====
    // Subscription items use subscription_price; one-time items use normal price.
    final displayPrice =
        (widget.isSub &&
            p.subscriptionPrice != null &&
            p.subscriptionPrice! > 0)
        ? p.subscriptionPrice!
        : p.price;
    final effectiveQty = widget.isSub ? _weeklyTotalItems : widget.baseQty;

    // Alternate row background for visual distinction
    final bgColor = widget.index % 2 == 0 ? Colors.white : kBg;

    return Container(
      color: bgColor,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ===== Product Row =====
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Checkbox for selecting/deselecting item
              Checkbox(
                value: widget.isChecked,
                activeColor: kPrimary,
                onChanged: widget.onCheckChanged,
              ),
              const SizedBox(width: 2),

              // Product image — tappable to view detail
              GestureDetector(
                onTap: () {
                  // Look up the full product from catalog, fall back to minimal p
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
                      builder: (_) =>
                          ProductDetailViewScreen(product: fullProduct),
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

              // Product details (name, price, quantity)
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
                              Wrap(
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  Text(
                                    widget.isSub
                                        ? '${p.unit} · Subscription: ₹${displayPrice.toStringAsFixed(0)}'
                                        : '${p.unit} · One-Time: ₹${displayPrice.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: kTextSub,
                                    ),
                                  ),
                                  // Show subscription price badge if it differs from display price
                                  if (p.subscriptionPrice != null &&
                                      p.subscriptionPrice! > 0 &&
                                      p.subscriptionPrice! < displayPrice)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 4,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: kPrimaryPl,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        'Sub: ₹${p.subscriptionPrice!.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: kPrimary,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Delete/Cancel button
                        if (widget.isSub)
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: kRedLt,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: kRed.withOpacity(0.15),
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.cancel_outlined,
                                    size: 11,
                                    color: kRed,
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    'Cancel',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: kRed,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else
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

                    // ===== Quantity Display =====
                    if (!widget.isSub) ...[
                      // One-time: show counter and total price
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
                  ],
                ),
              ),
            ],
          ),

          // ===== Subscription Schedule Configuration =====
          if (widget.isSub) _buildScheduleConfiguration(displayPrice),
        ],
      ),
    );
  }

  // ===== One-Time Quantity Counter =====

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
        deliveryDate:
            (widget.globalOnetimeDate ??
                    DateTime.now().add(const Duration(days: 1)))
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
        deliveryDate:
            (widget.globalOnetimeDate ??
                    DateTime.now().add(const Duration(days: 1)))
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

  // ===== Custom Mode Schedule Configuration =====

  /// Full schedule editor for Custom subscription mode.
  /// Displays days on the left and morning/evening slots with checkmarks on the right.
  Widget _buildScheduleConfiguration(double pricePerItem) {
    final weeklyPrice = _weeklyTotalItems * pricePerItem;
    final monthlyEst = weeklyPrice * 4.28;

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9F3),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorderLt),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Table Headers
          const Row(
            children: [
              Expanded(
                flex: 3,
                child: Text(
                  'DAY',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: kTextSub,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Expanded(
                flex: 4,
                child: Text(
                  'MORNING SLOT',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: kTextSub,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Expanded(
                flex: 4,
                child: Text(
                  'EVENING SLOT',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: kTextSub,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: kBorderLt),
          const SizedBox(height: 8),

          // Vertical Timetable Rows for each day
          ..._days.map((day) {
            // Full day name for left side list
            final Map<String, String> dayNames = {
              'Mon': 'Monday',
              'Tue': 'Tuesday',
              'Wed': 'Wednesday',
              'Thu': 'Thursday',
              'Fri': 'Friday',
              'Sat': 'Saturday',
              'Sun': 'Sunday',
            };
            final dayLabel = dayNames[day] ?? day;

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6.0),
              child: Row(
                children: [
                  // Day name on left side list
                  Expanded(
                    flex: 3,
                    child: Text(
                      dayLabel,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                  ),

                  // Morning Slot selection box
                  Expanded(
                    flex: 4,
                    child: _buildSlotSelector(day, 'Morning'),
                  ),

                  // Evening Slot selection box
                  Expanded(
                    flex: 4,
                    child: _buildSlotSelector(day, 'Evening'),
                  ),
                ],
              ),
            );
          }).toList(),

          const SizedBox(height: 20),
          const Divider(height: 1, color: kBorder),
          const SizedBox(height: 16),

          // ===== Weekly Summary =====
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Weekly: $_weeklyTotalItems Items · ₹${weeklyPrice.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Est. monthly: ₹${monthlyEst.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: _clearSchedule,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Clear',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.red.shade400,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
