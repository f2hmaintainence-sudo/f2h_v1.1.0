import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
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
    return balances;
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
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const BrowseScreen(),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
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
      ),
      body: FutureBuilder<List<ContainerBalanceModel>>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CowLoadingWidget(size: 140, message: 'Loading container balance...'),
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

          final balances = snapshot.data ?? [];
          return _buildBalancesTab(balances);
        },
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

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        const Text(
          'Container Insights',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Breakdown by container type',
          style: TextStyle(fontSize: 12.5, color: kTextSub),
        ),
        const SizedBox(height: 16),

        ...balances.map(
          (item) => _containerCard(
            name: item.packageName,
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
            color: Colors.black.withValues(alpha: 0.01),
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
}