import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_typography.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/profile/data/models/container_balance_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:f2h_customer/core/widgets/cow_loading_widget.dart';

class ContainerBalanceScreen extends StatefulWidget {
  const ContainerBalanceScreen({super.key});

  @override
  State<ContainerBalanceScreen> createState() => _ContainerBalanceScreenState();
}

class _ContainerBalanceScreenState extends State<ContainerBalanceScreen> {
  late Future<List<ContainerBalanceModel>> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = _loadData();
  }

  Future<List<ContainerBalanceModel>> _loadData() async {
    final dio = sl<DioClient>().dio;
    final response = await dio.get(ApiEndpoints.customerPakages);

    final rawBalances = response.data;
    if (rawBalances is Map && rawBalances['status'] == false) {
      throw Exception(
          rawBalances['message'] ?? 'Failed to load container balances');
    }
    final balancesData =
        rawBalances is Map ? rawBalances['data'] : rawBalances;
    final List<ContainerBalanceModel> balances = [];
    if (balancesData is List) {
      for (final item in balancesData) {
        if (item is Map) {
          balances.add(ContainerBalanceModel.fromJson(
              Map<String, dynamic>.from(item)));
        }
      }
    }
    return balances;
  }

  void _retry() => setState(() => _dataFuture = _loadData());

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final isLoggedIn =
        authState is Authenticated || sessionState.profile != null;

    if (!isLoggedIn) {
      return Scaffold(
        backgroundColor: kBg,
        appBar: _buildAppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: kPrimaryPl,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.shopping_bag_outlined,
                    size: 38,
                    color: kPrimary,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Sign In Required',
                  style: AppTypography.titleLarge.copyWith(
                    fontWeight: FontWeight.w800,
                    color: kText,
                    fontSize: 20,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Please sign in to view your container balance.',
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium.copyWith(color: kTextSub),
                ),
                const SizedBox(height: 28),
                ElevatedButton.icon(
                  icon: const Icon(Icons.shopping_cart_outlined),
                  label: const Text('Browse Products'),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const BrowseScreen()),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: FutureBuilder<List<ContainerBalanceModel>>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CowLoadingWidget(
                  size: 140, message: 'Loading container balance...'),
            );
          }
          if (snapshot.hasError) {
            return _buildError(snapshot.error);
          }
          final balances = snapshot.data ?? [];
          return _buildContent(balances);
        },
      ),
    );
  }

  AppBar _buildAppBar() => AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: kText),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Container Balance',
          style: AppTypography.titleLarge.copyWith(
            fontWeight: FontWeight.w800,
            color: kText,
            fontSize: 18,
          ),
        ),
      );

  Widget _buildError(Object? error) {
    String msg = 'Failed to load container data';
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        msg = data['message'].toString();
      }
    }
    return Scaffold(
      backgroundColor: kBg,
      appBar: _buildAppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: kRedLt,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.error_outline_rounded,
                  size: 36,
                  color: kRed,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                msg,
                textAlign: TextAlign.center,
                style: AppTypography.titleMedium.copyWith(
                  fontWeight: FontWeight.w800,
                  color: kText,
                  fontSize: 17,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Something went wrong while retrieving your data.',
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(color: kTextSub),
              ),
              const SizedBox(height: 28),
              ElevatedButton.icon(
                onPressed: _retry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try Again'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(List<ContainerBalanceModel> balances) {
    if (balances.isEmpty) {
      return Scaffold(
        backgroundColor: kBg,
        appBar: _buildAppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: const BoxDecoration(
                  color: kPrimaryPl,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.inventory_2_outlined,
                  size: 36,
                  color: kPrimary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'No containers yet',
                style: AppTypography.titleMedium.copyWith(
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Containers will appear here once\nyou receive your first order.',
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(color: kTextSub),
              ),
            ],
          ),
        ),
      );
    }

    final totalBalance =
        balances.fold<int>(0, (sum, e) => sum + e.balanceQuantity);
    final totalIssued =
        balances.fold<int>(0, (sum, e) => sum + e.issuedQuantity);
    final totalReturned =
        balances.fold<int>(0, (sum, e) => sum + e.returnedQuantity);

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        // ── Gradient SliverAppBar ──
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          backgroundColor: const Color(0xFF064E3B),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Container Balance',
            style: AppTypography.titleMedium.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 17,
            ),
          ),
          flexibleSpace: FlexibleSpaceBar(
            collapseMode: CollapseMode.parallax,
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF064E3B), Color(0xFF15803D), Color(0xFF16A34A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 32),
                    // Icon with frosted container
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.inventory_2_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Total Containers Held',
                      style: AppTypography.labelMedium.copyWith(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '$totalBalance',
                      style: AppTypography.displayLarge.copyWith(
                        color: Colors.white,
                        fontSize: 52,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -2,
                        height: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // ── Stats Strip ──
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                _StatCell(
                  label: 'Issued',
                  value: '$totalIssued',
                  icon: Icons.outbox_rounded,
                  iconColor: const Color(0xFFEA580C),
                  iconBg: const Color(0xFFFFF7ED),
                ),
                Container(width: 1, height: 44, color: kBorderLt),
                _StatCell(
                  label: 'Returned',
                  value: '$totalReturned',
                  icon: Icons.assignment_return_rounded,
                  iconColor: kPrimary,
                  iconBg: kPrimaryPl,
                ),
                Container(width: 1, height: 44, color: kBorderLt),
                _StatCell(
                  label: 'Pending',
                  value: '$totalBalance',
                  icon: Icons.pending_actions_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  iconBg: const Color(0xFFEDE9FE),
                ),
              ],
            ),
          ),
        ),

        // ── Section Header ──
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Row(
              children: [
                Text(
                  'Container Details',
                  style: AppTypography.headlineSmall.copyWith(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: kText,
                    letterSpacing: -0.3,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: kPrimaryPl,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${balances.length} type${balances.length != 1 ? 's' : ''}',
                    style: AppTypography.labelSmall.copyWith(
                      color: kPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Container Cards ──
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => _ContainerCard(item: balances[index]),
            childCount: balances.length,
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  STAT CELL
// ═══════════════════════════════════════════════════════════════
class _StatCell extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;

  const _StatCell({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: AppTypography.labelSmall.copyWith(
                    fontSize: 10.5,
                    color: kTextSub,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  style: AppTypography.titleMedium.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: kText,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTAINER CARD
// ═══════════════════════════════════════════════════════════════
class _ContainerCard extends StatelessWidget {
  final ContainerBalanceModel item;

  const _ContainerCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final hasBalance = item.balanceQuantity > 0;
    final hasDamage = item.damagedQuantity > 0;
    final hasLost = item.lostQuantity > 0;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: hasBalance
              ? const Color(0xFFBBF7D0)
              : const Color(0xFFE2E8F0),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          children: [
            // ── Header ──
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
              decoration: BoxDecoration(
                color: hasBalance
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFF8FAFC),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: hasBalance ? kPrimaryPl : const Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.local_drink_rounded,
                      color: hasBalance ? kPrimary : kTextSub,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.packageName,
                          style: AppTypography.titleMedium.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: kText,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (item.updatedAt != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            'Updated ${_formatDate(item.updatedAt!)}',
                            style: AppTypography.labelSmall.copyWith(
                              fontSize: 10.5,
                              color: kTextSub,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Balance badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: hasBalance ? kPrimary : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      hasBalance
                          ? '${item.balanceQuantity} Held'
                          : 'All Returned',
                      style: AppTypography.labelSmall.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 11.5,
                        color: hasBalance ? Colors.white : kTextSub,
                        letterSpacing: 0.1,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Divider ──
            const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),

            // ── Metrics Grid ──
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                children: [
                  _MetricCell(
                    label: 'Issued',
                    value: item.issuedQuantity,
                    color: const Color(0xFFEA580C),
                    bg: const Color(0xFFFFF7ED),
                  ),
                  _MetricCell(
                    label: 'Returned',
                    value: item.returnedQuantity,
                    color: kPrimary,
                    bg: kPrimaryPl,
                  ),
                  _MetricCell(
                    label: 'Damaged',
                    value: item.damagedQuantity,
                    color: hasDamage
                        ? const Color(0xFFD97706)
                        : kMuted,
                    bg: hasDamage
                        ? const Color(0xFFFEF3C7)
                        : const Color(0xFFF8FAFC),
                  ),
                  _MetricCell(
                    label: 'Lost',
                    value: item.lostQuantity,
                    color: hasLost ? kRed : kMuted,
                    bg: hasLost ? kRedLt : const Color(0xFFF8FAFC),
                    isLast: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(DateTime dt) {
    final local = dt.toLocal();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${local.day} ${months[local.month - 1]}';
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final Color bg;
  final bool isLast;

  const _MetricCell({
    required this.label,
    required this.value,
    required this.color,
    required this.bg,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: EdgeInsets.only(right: isLast ? 0 : 8),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: AppTypography.titleMedium.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: color,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: AppTypography.labelSmall.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color.withValues(alpha: 0.75),
                letterSpacing: 0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}