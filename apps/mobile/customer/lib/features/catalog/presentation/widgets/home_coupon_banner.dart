import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class HomeCouponBanner extends StatefulWidget {
  const HomeCouponBanner({super.key});

  @override
  State<HomeCouponBanner> createState() => _HomeCouponBannerState();
}

class _HomeCouponBannerState extends State<HomeCouponBanner> {
  List<Map<String, dynamic>> _coupons = [];

  @override
  void initState() {
    super.initState();
    _loadCoupons();
  }

  Future<void> _loadCoupons() async {
    try {
      final response = await DioClient().dio.get(
        ApiEndpoints.availableCoupons,
        queryParameters: {'subtotal': 0},
      );
      final rawCoupons = response.data is Map ? response.data['data'] : null;
      if (!mounted || rawCoupons is! List) return;
      final coupons = rawCoupons
          .whereType<Map>()
          .map((coupon) => Map<String, dynamic>.from(coupon))
          .where((coupon) => coupon['eligible'] != false)
          .take(6)
          .toList();
      if (coupons.isNotEmpty) setState(() => _coupons = coupons);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_coupons.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 0, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Coupons for You',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 86,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(right: 16),
              itemCount: _coupons.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, index) {
                final coupon = _coupons[index];
                final code = coupon['code']?.toString() ?? '';
                final label =
                    coupon['label']?.toString() ??
                    coupon['description']?.toString() ??
                    'Save on your order';
                return Container(
                  width: 220,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFD7EBDD)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_offer_outlined, color: kPrimary),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              code,
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                color: kPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              label,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: kTextSub,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
