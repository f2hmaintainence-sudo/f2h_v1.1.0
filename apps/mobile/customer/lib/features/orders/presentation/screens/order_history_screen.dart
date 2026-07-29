import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/data/models/subscription_plan_model.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_state.dart';
import 'package:f2h_customer/features/orders/presentation/widgets/order_tile.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_details_screen.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
// import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
// import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
// import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';

// ─────────────────────────────────────────────────────────────────────────────
class OrderHistoryScreen extends StatelessWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<OrderHistoryBloc>(
      create: (_) => sl<OrderHistoryBloc>()..add(LoadOrderHistory()),
      child: const OrderHistoryView(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class OrderHistoryView extends StatefulWidget {
  const OrderHistoryView({super.key});
  @override
  State<OrderHistoryView> createState() => _OrderHistoryViewState();
}

class _OrderHistoryViewState extends State<OrderHistoryView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedFilter = 'All';
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();
  

  // ── locally-held data (instant updates without full bloc rebuild) ──────────
  List<Order> _oneTimeOrders = [];
  List<Order> _subscriptionOrders = [];
  List<SubscriptionPlan> _subscriptionPlans = [];

  static const _filters = ['All', 'placed', 'Delivered', 'Cancelled'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  // ── filter helpers ─────────────────────────────────────────────────────────
  List<Order> _filterOrders(List<Order> list) {
    return list.where((o) {
      final matchStatus = _selectedFilter == 'All' ||
          o.status.toLowerCase() == _selectedFilter.toLowerCase();
      final matchSearch = _searchQuery.isEmpty ||
          o.productName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          o.id.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    }).toList();
  }

  List<SubscriptionPlan> _filterPlans(List<SubscriptionPlan> list) {
    if (_searchQuery.isEmpty) return list;
    return list.where((p) =>
        p.displayName.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
  }

  // ── update local cache when bloc emits ────────────────────────────────────
  void _onBlocState(OrderHistoryState state) {
    if (state is OrderHistoryLoaded) {
      setState(() {
        _oneTimeOrders       = state.oneTimeOrders;
        _subscriptionOrders  = state.subscriptionOrders;
        _subscriptionPlans   = state.subscriptionPlans;
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return BlocListener<OrderHistoryBloc, OrderHistoryState>(
      listener: (ctx, state) => _onBlocState(state),
      child: Scaffold(
        backgroundColor: kBg,
        appBar: _buildAppBar(),
        body: BlocBuilder<OrderHistoryBloc, OrderHistoryState>(
          // Only rebuild for initial states; data-level rebuilds handled locally
          buildWhen: (prev, curr) =>
              curr is OrderHistoryLoading || curr is OrderHistoryError ||
              (curr is OrderHistoryLoaded && prev is! OrderHistoryLoaded),
          builder: (ctx, state) {
            if (state is OrderHistoryLoading && _oneTimeOrders.isEmpty) {
              return const Center(child: ScrollingItemsLoader());
            }
            if (state is OrderHistoryError && _oneTimeOrders.isEmpty) {
              // return _buildErrorState(state.message);
              return _buildCreateOrderState();
            }
            return TabBarView(
              controller: _tabController,
              children: [
                _buildOneTimeTab(),
                _buildSubscriptionOrdersTab(),
                _buildSubscriptionPlansTab(),
              ],
            );
          },
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: kSurface,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 20),
        onPressed: () => Navigator.pop(context),
      ),
      title: const Text(
        'My Orders',
        style: TextStyle(color: kText, fontSize: 18, fontWeight: FontWeight.w800),
      ),
      centerTitle: true,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: Container(
          color: kSurface,
          child: TabBar(
            controller: _tabController,
            indicatorColor: kPrimary,
            indicatorWeight: 3,
            labelColor: kPrimary,
            unselectedLabelColor: kTextSub,
            labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
            tabs: [
              _tabWithBadge('One-Time', _oneTimeOrders.length),
              _tabWithBadge('Sub Orders', _subscriptionOrders.length),
              _tabWithBadge('My Plans', _subscriptionPlans.length),
            ],
          ),
        ),
      ),
    );
  }

  Tab _tabWithBadge(String label, int count) {
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (count > 0) ...[
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kPrimary),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildOneTimeTab() {
    final filtered = _filterOrders(_oneTimeOrders);
    return Column(
      children: [
        _buildSearchBar('Search one-time orders…'),
        _buildFilterChips(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                context.read<OrderHistoryBloc>().add(LoadOrderHistory()),
            color: kPrimary,
            child: filtered.isEmpty
                ? _buildEmpty(
                    icon: Icons.receipt_long_outlined,
                    title: 'No Orders',
                    subtitle: _searchQuery.isNotEmpty
                        ? 'No results for "$_searchQuery"'
                        : 'You have no one-time orders yet.',
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(top: 8, bottom: 24),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => GestureDetector(
                      onTap: () => _openDetails(filtered[i]),
                      child: ORow(filtered[i]),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildSubscriptionOrdersTab() {
    final filtered = _filterOrders(_subscriptionOrders);
    return Column(
      children: [
        _buildSearchBar('Search subscription orders…'),
        _buildFilterChips(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                context.read<OrderHistoryBloc>().add(LoadOrderHistory()),
            color: kPrimary,
            child: filtered.isEmpty
                ? _buildEmpty(
                    icon: Icons.calendar_today_outlined,
                    title: 'No Subscription Orders',
                    subtitle: _searchQuery.isNotEmpty
                        ? 'No results for "$_searchQuery"'
                        : 'No subscription-generated orders found.',
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(top: 8, bottom: 24),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => GestureDetector(
                      onTap: () => _openDetails(filtered[i]),
                      child: ORow(filtered[i]),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildSubscriptionPlansTab() {
    final filtered = _filterPlans(_subscriptionPlans);
    return Column(
      children: [
        _buildSearchBar('Search subscription plans…'),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                context.read<OrderHistoryBloc>().add(LoadOrderHistory()),
            color: kPrimary,
            child: filtered.isEmpty
                ? _buildEmpty(
                    icon: Icons.subscriptions_outlined,
                    title: 'No Subscription Plans',
                    subtitle: 'Subscribe to get regular deliveries of milk, paneer, and more.',
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => _buildPlanCard(filtered[i]),
                  ),
          ),
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildPlanCard(SubscriptionPlan plan) {
    final isActive = plan.isActive;
    final isPaused = plan.isPaused;
    final isExpired = plan.status.toLowerCase() == 'expaired' || plan.status.toLowerCase() == 'expired';
    final isCompleted = plan.status.toLowerCase() == 'completed';
    final isCancelled = plan.status.toLowerCase() == 'cancelled';

    final statusColor = isActive
        ? const Color(0xFF047857)
        : isPaused
            ? const Color(0xFFD97706)
            : isExpired
                ? const Color(0xFFDC2626)
                : isCompleted
                    ? const Color(0xFF2563EB)
                    : kTextSub;

    final statusBg = isActive
        ? const Color(0xFFECFDF5)
        : isPaused
            ? const Color(0xFFFEF3C7)
            : isExpired
                ? const Color(0xFFFEE2E2)
                : isCompleted
                    ? const Color(0xFFEFF6FF)
                    : kBgDeep;

    final statusLabel = isActive
        ? 'Active'
        : isPaused
            ? 'Paused'
            : isExpired
                ? 'Expired'
                : isCompleted
                    ? 'Completed'
                    : isCancelled
                        ? 'Cancelled'
                        : (plan.status.isEmpty
                            ? 'Unknown'
                            : plan.status[0].toUpperCase() + plan.status.substring(1));

    final firstItem = plan.items.isNotEmpty ? plan.items.first : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isActive ? kPrimary.withValues(alpha: 0.25) : kBorder.withValues(alpha: 0.8),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isActive ? kPrimary.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.03),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header Card Section ──────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            decoration: BoxDecoration(
              color: isActive ? kPrimaryPl.withValues(alpha: 0.3) : kSurface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            ),
            child: Row(
              children: [
                // Product Real Image / Avatar
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    width: 50,
                    height: 50,
                    color: statusBg,
                    child: buildProductImage(
                      plan.displayName,
                      imageAsset: firstItem?.imageUrl,
                      width: 50,
                      height: 50,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan.displayName,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: kText,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: kBgDeep,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          plan.subscriptionNumber,
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: kTextSub,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Status Chip with status dot
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Items List Section with Real Product Images ───────────────
          if (plan.items.isNotEmpty) ...[
            const Divider(height: 1, color: kBorder),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: plan.items.length,
              itemBuilder: (_, i) {
                final item = plan.items[i];
                final hasM = item.defaultMQty > 0;
                final hasE = item.defaultEQty > 0;
                return Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Real product variant thumbnail
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          width: 42,
                          height: 42,
                          color: kBgDeep,
                          child: buildProductImage(
                            item.productName,
                            imageAsset: item.imageUrl,
                            width: 42,
                            height: 42,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: kText,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (item.variantName.isNotEmpty &&
                                item.variantName.toLowerCase() != 'standard') ...[
                              const SizedBox(height: 2),
                              Text(
                                item.variantName,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: kTextSub,
                                ),
                              ),
                            ],
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                if (hasM)
                                  _qtyChip(
                                    '🌅 Morning ×${item.defaultMQty.toStringAsFixed(0)}',
                                    const Color(0xFFFFF7ED),
                                    const Color(0xFFC2410C),
                                  ),
                                if (hasM && hasE) const SizedBox(width: 6),
                                if (hasE)
                                  _qtyChip(
                                    '🌙 Evening ×${item.defaultEQty.toStringAsFixed(0)}',
                                    const Color(0xFFEEF2FF),
                                    const Color(0xFF3730A3),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '₹${item.finalPrice.toStringAsFixed(0)}/u',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],

          // ── Footer Section: Schedule & Billing ─────────────────────────────
          Container(
            margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: kBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: kBorder.withValues(alpha: 0.6)),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today_rounded, size: 13, color: kTextSub),
                const SizedBox(width: 6),
                Text(
                  plan.scheduleType.isEmpty ? 'Flexible' : plan.scheduleType,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: kTextMid,
                  ),
                ),
                const Spacer(),
                const Icon(Icons.sync_rounded, size: 14, color: kTextSub),
                const SizedBox(width: 5),
                Text(
                  plan.billingCycle,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: kTextMid,
                  ),
                ),
                if (plan.dailyMorningCost > 0 || plan.dailyEveningCost > 0) ...[
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '₹${(plan.dailyMorningCost + plan.dailyEveningCost).toStringAsFixed(0)}/day',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: kPrimary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _qtyChip(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg)),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  void _openDetails(Order order) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<OrderHistoryBloc>(),
          child: OrderDetailsScreen(order: order),
        ),
      ),
    ).then((_) {
      if (mounted) context.read<OrderHistoryBloc>().add(LoadOrderHistory());
    });
  }

  // ── shared search bar ─────────────────────────────────────────────────────
  Widget _buildSearchBar(String hint) {
    return Container(
      color: kSurface,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: kBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kBorder),
        ),
        child: TextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() => _searchQuery = v),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: kTextSub, fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: kTextSub, size: 20),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: kTextSub, size: 18),
                    onPressed: () {
                      _searchCtrl.clear();
                      setState(() => _searchQuery = '');
                    },
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
          ),
          style: const TextStyle(color: kText, fontSize: 14),
        ),
      ),
    );
  }

  // ── filter chips (for order tabs only) ───────────────────────────────────
  Widget _buildFilterChips() {
    return Container(
      color: kSurface,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _filters.map((f) {
            final selected = _selectedFilter == f;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(
                  f,
                  style: TextStyle(
                    color: selected ? Colors.white : kTextSub,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                selected: selected,
                selectedColor: kPrimary,
                backgroundColor: kBg,
                elevation: 0,
                pressElevation: 0,
                shadowColor: Colors.transparent,
                selectedShadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(color: selected ? kPrimary : kBorder),
                ),
                onSelected: (v) { if (v) setState(() => _selectedFilter = f); },
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ── empty state ───────────────────────────────────────────────────────────
  Widget _buildEmpty({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: 400,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: const BoxDecoration(color: kPrimaryPl, shape: BoxShape.circle),
                    child: Icon(icon, size: 44, color: kPrimary),
                  ),
                  const SizedBox(height: 18),
                  Text(title,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kText)),
                  const SizedBox(height: 8),
                  Text(subtitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, color: kTextSub)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── error state ───────────────────────────────────────────────────────────
  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: kRed, size: 48),
            const SizedBox(height: 16),
            const Text('Error Loading Data',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kText)),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: kTextSub)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.read<OrderHistoryBloc>().add(LoadOrderHistory()),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Try Again', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateOrderState(){

  return Scaffold(

    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.shopping_bag_outlined,
              size: 72,
              color: kPrimary,
            ),
            const SizedBox(height: 16),
            const Text(
              'No Order Found',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'You have not placed any order yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: kTextSub),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              icon: const Icon(Icons.shopping_cart_outlined),
              label: const Text('MAKE ORDER'),
              onPressed: () {
                Navigator.push(context, 
                  MaterialPageRoute(
                    builder: (_) => const BrowseScreen(),
                  ), );
                // or HomeScreen()
              },
            ),
          ],
        ),
      ),
    ),
  );

  }
}
