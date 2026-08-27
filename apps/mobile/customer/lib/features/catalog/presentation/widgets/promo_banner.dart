import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
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
  late final PageController _pageController = PageController(
    initialPage: _initialPage,
  );
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
      if (data is Map &&
          data['status'] == true &&
          data['data'] is List &&
          (data['data'] as List).isNotEmpty) {
        final list = (data['data'] as List)
            .where((b) {
              final isActive = b['isActive'] ?? b['is_active'] ?? true;
              if (isActive == false) return false;
              final bType = (b['bannerType'] ?? b['banner_type'] ?? '').toString().toLowerCase();
              return bType == 'home_carousel' || bType == 'offer_banner' || bType.isEmpty;
            })
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
          'imageUrl':
              '${ApiEndpoints.host}/uploads/banners/subscription_banner.png',
          'title': 'Subscription Savings',
          'subtitle':
              'Subscribe to fresh milk, curd, paneer & more for hassle-free morning deliveries.',
          'cta': 'Subscribe Now',
          'route': 'subscribe',
          'isActive': true,
        },
        {
          'id': 'promo-2',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/wallet_banner.png',
          'title': 'F2H Wallet',
          'subtitle':
              'Add cash to your wallet & get instant cashback on orders.',
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
    final actionType = (banner['actionType'] ?? banner['action_type'] ?? banner['type'] ?? banner['route'] ?? '').toString().toUpperCase();
    final actionValue = (banner['actionValue'] ?? banner['action_value'] ?? banner['productId'] ?? banner['product_id'] ?? banner['categoryId'] ?? banner['category_id'] ?? '').toString();
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final bannerType = (banner['bannerType'] ?? banner['banner_type'] ?? '').toString().toLowerCase();

    // 1. PRODUCT REDIRECTION
    final isProduct = actionType == 'PRODUCT' ||
        actionType == 'PRD' ||
        bannerType == 'product' ||
        actionValue.startsWith('PRD') ||
        banner['productId'] != null ||
        banner['product_id'] != null;

    if (isProduct && actionValue.isNotEmpty) {
      final title = banner['title']?.toString() ?? banner['name']?.toString() ?? 'Product';
      final product = getProductById(actionValue, name: title);
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProductDetailViewScreen(product: product),
        ),
      );
      return;
    }

    // 2. CATEGORY REDIRECTION
    if ((actionType == 'CATEGORY' || route == 'category' || bannerType == 'category_slide' || bannerType == 'category') && actionValue.isNotEmpty) {
      AppShell.of(context)?.setTab(1, category: actionValue);
      return;
    }

    // 3. SUBSCRIPTION REDIRECTION
    if (actionType == 'SUBSCRIPTION' || route == 'subscribe' || bannerType == 'subscribe') {
      AppShell.of(context)?.setTab(2);
      return;
    }

    // 4. WALLET REDIRECTION
    if (actionType == 'WALLET' || route == 'wallet' || banner['imageUrl'].toString().toLowerCase().contains('wallet_banner')) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WalletScreen()),
      );
      return;
    }

    // Default fallback to Shop tab
    AppShell.of(context)?.setTab(1);
  }

  String _formatImageUrl(String rawUrl) {
    if (rawUrl.isEmpty) return '';

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      final uri = Uri.tryParse(rawUrl);
      if (uri != null) {
        const devHosts = {'localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'};
        if (devHosts.contains(uri.host)) {
          return 'https://f2hfresh.com${uri.path}';
        }
        return rawUrl;
      }
    }

    if (rawUrl.contains('/uploads/')) {
      final pathAfterUploads = rawUrl.substring(rawUrl.indexOf('/uploads/'));
      return 'https://f2hfresh.com$pathAfterUploads';
    }

    if (rawUrl.contains('/assets/')) {
      final pathAfterAssets = rawUrl.substring(rawUrl.indexOf('/assets/'));
      return 'https://f2hfresh.com$pathAfterAssets';
    }

    final formatted = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return 'https://f2hfresh.com$formatted';
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
        aspectRatio: 2.65,
        child: PageView.builder(
          controller: _pageController,
          itemCount: 100000,
          itemBuilder: (context, index) {
            final banner = _banners[index % _banners.length];
            final rawUrl = (banner['imageUrl'] ?? banner['image_url'] ?? banner['imagePath'] ?? banner['image_path'])?.toString() ?? '';
            final imageUrl = _formatImageUrl(rawUrl);

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: GestureDetector(
                    onTap: () => _onBannerTap(banner),
                    child: imageUrl.isNotEmpty
                        ? Image.network(
                            imageUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
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
                              return _buildOfferCard(banner, imageUrl);
                            },
                          )
                        : _buildOfferCard(banner, ''),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildOfferCard(Map<String, dynamic> banner, String imageUrl) {
    return Image.asset(
      'assets/splash/splash.png',
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
    );
  }
}
