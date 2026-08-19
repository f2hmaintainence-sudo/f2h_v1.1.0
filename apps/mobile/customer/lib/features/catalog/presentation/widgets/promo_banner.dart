import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';

/// Displays top promo banners (subscription_banner.png & wallet_banner.png) as a sliding carousel.
class PromoBanner extends StatefulWidget {
  const PromoBanner({super.key});

  @override
  State<PromoBanner> createState() => _PromoBannerState();
}

class _PromoBannerState extends State<PromoBanner> {
  List<Map<String, dynamic>> _banners = [];
  bool _loading = true;
  static const int _initialPage = 3000;
  late final PageController _pageController = PageController(initialPage: _initialPage);
  Timer? _autoScrollTimer;

  @override
  void initState() {
    super.initState();
    _fetchBanners();
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    if (_banners.length <= 1) return;
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_pageController.hasClients) return;
      _pageController.nextPage(
        duration: const Duration(milliseconds: 650),
        curve: Curves.fastOutSlowIn,
      );
    });
  }

  Future<void> _fetchBanners() async {
    try {
      final dioClient = DioClient();
      final resp = await dioClient.dio.get(ApiEndpoints.promoBanners);
      dynamic data = resp.data;
      if (data is String) {
        data = jsonDecode(data);
      }
      if (data is Map && data['status'] == true && data['data'] is List && (data['data'] as List).isNotEmpty) {
        final list = (data['data'] as List)
            .where((b) => b['isActive'] == true)
            .map((b) => Map<String, dynamic>.from(b as Map))
            .toList();
        if (mounted && list.isNotEmpty) {
          setState(() {
            _banners = list;
            _loading = false;
          });
          _startAutoScroll();
          return;
        }
      }
      _useDefaultBanners();
    } catch (_) {
      _useDefaultBanners();
    }
  }

  void _useDefaultBanners() {
    if (!mounted) return;
    setState(() {
      _banners = [
        {
          'id': 'promo-1',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/subscription_banner.png',
          'title': 'Subscription Savings',
          'subtitle': 'Subscribe to fresh milk, curd, paneer & more for hassle-free morning deliveries.',
          'cta': 'Subscribe Now',
          'route': 'subscribe',
          'isActive': true,
        },
        {
          'id': 'promo-2',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/wallet_banner.png',
          'title': 'F2H Wallet',
          'subtitle': 'Add cash to your wallet & get instant cashback on orders.',
          'cta': 'Add Money',
          'route': 'wallet',
          'isActive': true,
        },
      ];
      _loading = false;
    });
    _startAutoScroll();
  }

  void _onBannerTap(Map<String, dynamic> banner) {
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final imageUrl = banner['imageUrl']?.toString().toLowerCase() ?? '';

    if (route == 'wallet' || imageUrl.contains('wallet_banner')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => const WalletScreen(),
        ),
      );
    } else {
      // Default to subscribe tab (tab 3 in AppShell)
      final shellState = context.findAncestorStateOfType<AppShellState>();
      shellState?.setTab(2);
    }
  }

  String _formatImageUrl(String rawUrl) {
    if (rawUrl.isEmpty) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      final uri = Uri.tryParse(rawUrl);
      if (uri != null && uri.path.isNotEmpty) {
        return '${ApiEndpoints.host}${uri.path}';
      }
      return rawUrl;
    }
    final cleanPath = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return '${ApiEndpoints.host}$cleanPath';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 3.10,
            child: Container(
              color: Colors.grey.shade200,
              child: const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          ),
        ),
      );
    }

    if (_banners.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: AspectRatio(
        aspectRatio: 3.24,
        child: PageView.builder(
          controller: _pageController,
          itemCount: 100000,
          itemBuilder: (context, index) {
            final banner = _banners[index % _banners.length];
            final rawUrl = banner['imageUrl']?.toString() ?? '';
            final imageUrl = _formatImageUrl(rawUrl);

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: GestureDetector(
                    onTap: () => _onBannerTap(banner),
                    child: Image.network(
                      imageUrl,
                      fit: BoxFit.fill,
                      width: double.infinity,
                      loadingBuilder: (_, child, progress) {
                        if (progress == null) return child;
                        return Container(
                          color: const Color(0xFF16A34A),
                          child: const Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        final isWallet = banner['route'] == 'wallet' || imageUrl.contains('wallet');
                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isWallet
                                  ? [const Color(0xFF1D4ED8), const Color(0xFF3B82F6)]
                                  : [const Color(0xFF15803D), const Color(0xFF22C55E)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      banner['title']?.toString() ??
                                          (isWallet ? 'F2H Wallet' : 'Save Up To 5%'),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 18,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      banner['subtitle']?.toString() ??
                                          (isWallet
                                              ? 'Add cash & get instant cashback on orders.'
                                              : 'Subscription to fresh milk, curd, paneer & more.'),
                                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  banner['cta']?.toString() ?? (isWallet ? 'Add Money' : 'Order Now'),
                                  style: TextStyle(
                                    color: isWallet ? const Color(0xFF1D4ED8) : const Color(0xFF15803D),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
