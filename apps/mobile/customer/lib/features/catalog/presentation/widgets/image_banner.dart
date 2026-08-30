import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/profile/presentation/screens/referral_screen.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';

/// Fetches banners from the API and displays them as a tappable carousel.
/// Tapping navigates to the route specified by each banner (e.g. Subscribe tab).
class ImageBanner extends StatefulWidget {
  const ImageBanner({super.key});

  @override
  State<ImageBanner> createState() => _ImageBannerState();
}

class _ImageBannerState extends State<ImageBanner> {
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
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
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
      final resp = await dioClient.dio.get(ApiEndpoints.banners);
      dynamic data = resp.data;
      if (data is String) {
        data = jsonDecode(data);
      }
      if (data is Map &&
          data['status'] == true &&
          data['data'] is List &&
          (data['data'] as List).isNotEmpty) {
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
      _useDefaultBanner();
    } catch (_) {
      _useDefaultBanner();
    }
  }

  void _useDefaultBanner() {
    if (!mounted) return;
    setState(() {
      _banners = [
        {
          'id': 'sub-banner-1',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/sub_banner_1.png',
          'title': 'VIP Member',
          'subtitle': 'Exclusive benefits & premium experience.',
          'cta': 'Subscribe Now',
          'route': 'subscribe',
          'isActive': true,
        },
        {
          'id': 'sub-banner-2',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/sub_banner_2.png',
          'title': 'Refer & Earn',
          'subtitle': 'Invite friends and earn rewards on every referral.',
          'cta': 'Refer Now',
          'route': 'refer',
          'isActive': true,
        },
        {
          'id': 'sub-banner-3',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/sub_banner_3.png',
          'title': 'Farm Fresh Essentials',
          'subtitle': 'Pure, fresh and natural milk, curd, paneer & ghee.',
          'cta': 'Shop Now',
          'route': 'menu',
          'isActive': true,
        },
      ];
      _loading = false;
    });
  }

  void _onBannerTap(Map<String, dynamic> banner) {
    final actionType = (banner['actionType'] ?? banner['action_type'] ?? banner['type'] ?? banner['route'] ?? '').toString().toUpperCase();
    final actionValue = (banner['actionValue'] ?? banner['action_value'] ?? '').toString();
    final categoryId = (banner['categoryId'] ?? banner['category_id'] ?? '').toString();
    final productId = (banner['productId'] ?? banner['product_id'] ?? '').toString();
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final bannerType = (banner['bannerType'] ?? banner['banner_type'] ?? '').toString().toLowerCase();

    // 1. PRODUCT REDIRECTION
    final targetProductId = productId.isNotEmpty
        ? productId
        : (actionType == 'PRODUCT' || actionType == 'PRD' || bannerType == 'product' || actionValue.startsWith('PRD') ? actionValue : '');

    if (targetProductId.isNotEmpty) {
      final title = banner['title']?.toString() ?? banner['name']?.toString() ?? 'Product';
      final targetCat = categoryId.isNotEmpty ? categoryId : (banner['category_id']?.toString() ?? '');
      AppShell.of(context)?.setTab(
        1,
        category: targetCat.isNotEmpty ? targetCat : null,
        productId: targetProductId,
        productName: title,
      );
      return;
    }

    // 2. CATEGORY REDIRECTION
    final targetCatId = categoryId.isNotEmpty
        ? categoryId
        : (actionType == 'CATEGORY' || actionType == 'CAT' || route == 'category' || bannerType == 'category_slide' || bannerType == 'category' || actionValue.startsWith('CAT') ? actionValue : '');

    if (targetCatId.isNotEmpty) {
      AppShell.of(context)?.setTab(1, category: targetCatId);
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

    // 5. REFERRAL REDIRECTION
    if (actionType == 'REFERRAL' || route == 'refer') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ReferralScreen()),
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
            aspectRatio: 2.0,
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
        aspectRatio: 2.0,
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
                  color: Colors.white,
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
                                color: const Color(0xFFF1F5F9),
                                child: const Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF16A34A),
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
    final title = banner['title']?.toString() ?? 'F2H Fresh';
    final desc = banner['description']?.toString() ?? 'Fresh Daily Essentials Delivered To Your Doorstep';
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF15803D), Color(0xFF16A34A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Image.asset(
            'assets/icon/app_icon.png',
            width: 50,
            height: 50,
            fit: BoxFit.contain,
          ),
        ],
      ),
    );
  }
}
