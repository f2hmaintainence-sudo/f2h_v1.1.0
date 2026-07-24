import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/profile/data/models/container_balance_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart';

class ContainerBalanceScreen extends StatefulWidget {
  const ContainerBalanceScreen({super.key});

  @override
  State<ContainerBalanceScreen> createState() => _ContainerBalanceScreenState();
}

class _ContainerBalanceScreenState extends State<ContainerBalanceScreen> {
  late Future<(List<ContainerBalanceModel>, List<ContainerTransactionModel>)> _dataFuture;

  @override
  void initState() {
    super.initState();
    _dataFuture = _loadData();
  }

  Future<(List<ContainerBalanceModel>, List<ContainerTransactionModel>)> _loadData() async {
    final dio = sl<DioClient>().dio;
    final futures = await Future.wait([
      dio.get(ApiEndpoints.customerPakages),
      dio.get(ApiEndpoints.customerPakagesTransactions),
    ]);

    final rawBalances = futures[0].data;
    if (rawBalances is Map && rawBalances['status'] == false) {
      throw Exception(rawBalances['message'] ?? 'Failed to load container balances');
    }
    final balancesData = rawBalances is Map ? rawBalances['data'] : rawBalances;
    final List<ContainerBalanceModel> balances = [];
    if (balancesData is List) {
      for (final item in balancesData) {
        if (item is Map) {
          balances.add(ContainerBalanceModel.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }

    final rawTxns = futures[1].data;
    if (rawTxns is Map && rawTxns['status'] == false) {
      throw Exception(rawTxns['message'] ?? 'Failed to load container transactions');
    }
    final txnsData = rawTxns is Map ? rawTxns['data'] : rawTxns;
    final List<ContainerTransactionModel> txns = [];
    if (txnsData is List) {
      for (final item in txnsData) {
        if (item is Map) {
          txns.add(ContainerTransactionModel.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }

    return (balances, txns);
  }

  void _retry() {
    setState(() {
      _dataFuture = _loadData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final sessionState = context.watch<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;

    if (!isLoggedIn) {
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

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: kText),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'Container Balance',
            style: TextStyle(fontWeight: FontWeight.w800, color: kText, fontSize: 18),
          ),
          bottom: const TabBar(
            labelColor: kPrimary,
            unselectedLabelColor: kTextSub,
            indicatorColor: kPrimary,
            indicatorWeight: 3,
            labelStyle: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            tabs: [
              Tab(text: 'Balances'),
              Tab(text: 'History'),
            ],
          ),
        ),
        body: FutureBuilder<(List<ContainerBalanceModel>, List<ContainerTransactionModel>)>(
          future: _dataFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: kPrimary),
              );
            }
            if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        size: 64,
                        color: kRed,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage(snapshot.error),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Something went wrong while retrieving your data.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: kTextSub,
                        ),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _retry,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }

            final data = snapshot.data!;
            final balances = data.$1;
            final txns = data.$2;

            return TabBarView(
              children: [
                _buildBalancesTab(balances),
                _buildHistoryTab(txns),
              ],
            );
          },
        ),
      ),
    );
  }

  String _errorMessage(Object? error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
    }
    return 'Failed to load container data';
  }

  Widget _buildBalancesTab(List<ContainerBalanceModel> balances) {
    if (balances.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 64, color: kMuted),
            const SizedBox(height: 16),
            const Text(
              'No container balances found',
              style: TextStyle(fontWeight: FontWeight.w800, color: kText, fontSize: 16),
            ),
            const SizedBox(height: 8),
            const Text(
              'Containers will appear here once you receive items.',
              style: TextStyle(color: kTextSub, fontSize: 14),
            ),
          ],
        ),
      );
    }

    final totalBalance = balances.fold<int>(0, (sum, e) => sum + e.balanceQuantity);
    final totalIssued = balances.fold<int>(0, (sum, e) => sum + e.issuedQuantity);
    final totalReturned = balances.fold<int>(0, (sum, e) => sum + e.returnedQuantity);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Total Containers Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(
              colors: [
                kPrimary,
                kPrimaryMid,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withOpacity(0.15),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              const Icon(
                Icons.inventory_2_outlined,
                color: Colors.white,
                size: 44,
              ),
              const SizedBox(height: 12),
              const Text(
                'Total Containers Held',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '$totalBalance',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Summary Row
        Row(
          children: [
            Expanded(
              child: _summaryCard(
                'Issued',
                '$totalIssued',
                Icons.outbox_outlined,
                const Color(0xFFFFF3E0),
                const Color(0xFFE65100),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _summaryCard(
                'Returned',
                '$totalReturned',
                Icons.assignment_return_outlined,
                const Color(0xFFE8F5E9),
                const Color(0xFF2E7D32),
              ),
            ),
          ],
        ),

        const SizedBox(height: 24),

        const Text(
          'Container Details',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),

        const SizedBox(height: 12),

        ...balances.map(
          (item) => _containerCard(
            name: '${item.packageName} (${item.packageCapacity.toStringAsFixed(0)} ${item.packageUnit})',
            issued: item.issuedQuantity,
            returned: item.returnedQuantity,
            damaged: item.damagedQuantity,
            lost: item.lostQuantity,
            balance: item.balanceQuantity,
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryTab(List<ContainerTransactionModel> txns) {
    if (txns.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.history_rounded, size: 64, color: kMuted),
            const SizedBox(height: 16),
            const Text(
              'No container transactions',
              style: TextStyle(fontWeight: FontWeight.w800, color: kText, fontSize: 16),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your container delivery history will be listed here.',
              style: TextStyle(color: kTextSub, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: txns.length,
      itemBuilder: (context, index) {
        final txn = txns[index];
        Color typeBg;
        Color typeColor;
        IconData icon;
        String prefix = '';

        final type = txn.transactionType.toLowerCase();
        if (type == 'return') {
          typeBg = const Color(0xFFE8F5E9);
          typeColor = const Color(0xFF2E7D32);
          icon = Icons.assignment_return_outlined;
          prefix = '-';
        } else if (type == 'issue') {
          typeBg = const Color(0xFFFFF3E0);
          typeColor = const Color(0xFFE65100);
          icon = Icons.outbox_outlined;
          prefix = '+';
        } else if (type == 'damaged' || type == 'lost') {
          typeBg = kRedLt;
          typeColor = kRed;
          icon = Icons.report_problem_outlined;
          prefix = '-';
        } else {
          // adjustment
          typeBg = kPrimaryPl;
          typeColor = kPrimary;
          icon = Icons.handyman_outlined;
          prefix = txn.quantity >= 0 ? '+' : '';
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.01),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: typeBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: typeColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_capitalize(txn.transactionType)}: ${txn.packageName}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _formatTxnSubtitle(txn),
                      style: const TextStyle(
                        fontSize: 11,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (txn.remarks != null && txn.remarks!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        txn.remarks!,
                        style: const TextStyle(
                          fontSize: 11,
                          color: kMuted,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '$prefix${txn.quantity}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: typeColor,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  static Widget _summaryCard(
    String title,
    String value,
    IconData icon,
    Color bg,
    Color iconColor,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: kTextSub,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _containerCard({
    required String name,
    required int issued,
    required int returned,
    required int damaged,
    required int lost,
    required int balance,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: kPrimaryPl,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.local_drink_outlined,
                  color: kPrimary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: kText,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: balance > 0 ? kPrimaryPl : kBorderLt,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Balance: $balance',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: balance > 0 ? kPrimary : kTextSub,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, thickness: 1, color: kBorderLt),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metric('Issued', issued),
              ),
              Expanded(
                child: _metric('Returned', returned),
              ),
              Expanded(
                child: _metric('Damaged', damaged),
              ),
              Expanded(
                child: _metric('Lost', lost),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static Widget _metric(
    String title,
    int value,
  ) {
    return Column(
      children: [
        Text(
          '$value',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: kTextSub,
          ),
        ),
      ],
    );
  }

  String _capitalize(String value) {
    if (value.isEmpty) return value;
    return value[0].toUpperCase() + value.substring(1).toLowerCase();
  }

  String _formatTxnSubtitle(ContainerTransactionModel txn) {
    final parts = <String>[];
    if (txn.transactionDate != null) {
      parts.add(_formatDate(txn.transactionDate!));
    }
    if (txn.referenceType.isNotEmpty && txn.referenceType != 'manual') {
      parts.add('Ref: ${txn.referenceType.toUpperCase()}');
    }
    return parts.join(' | ');
  }

  String _formatDate(DateTime value) {
    final local = value.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(local.year, local.month, local.day);
    final dayDiff = today.difference(date).inDays;

    if (dayDiff == 0) return 'Today';
    if (dayDiff == 1) return 'Yesterday';

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    return '${local.day} ${months[local.month - 1]} ${local.year}';
  }
}