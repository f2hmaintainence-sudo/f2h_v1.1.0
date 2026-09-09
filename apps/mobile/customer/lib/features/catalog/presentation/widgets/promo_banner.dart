import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/profile/presentation/screens/referral_screen.dart';
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
  late int _currentPage = _initialPage;
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
              if (bType != 'home_carousel' && bType != 'offer_banner' && bType.isNotEmpty) {
                return false;
              }
              final rawUrl = (b['imageUrl'] ?? b['image_url'] ?? b['imagePath'] ?? b['image_path'])?.toString().trim() ?? '';
              return rawUrl.isNotEmpty;
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
    } catch (_) {}
    if (mounted) {
      setState(() {
        _banners = [];
        _loading = false;
      });
    }
  }

  void _onBannerTap(Map<String, dynamic> banner) {
    final actionType = (banner['actionType'] ?? banner['action_type'] ?? banner['type'] ?? '').toString().toUpperCase();
    final actionValue = (banner['actionValue'] ?? banner['action_value'] ?? '').toString();
    final categoryId = (banner['categoryId'] ?? banner['category_id'] ?? '').toString();
    final productId = (banner['productId'] ?? banner['product_id'] ?? '').toString();
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final bannerType = (banner['bannerType'] ?? banner['banner_type'] ?? '').toString().toLowerCase();

    // 0. EXPLICIT NONE
    if (actionType == 'NONE' && categoryId.isEmpty && productId.isEmpty && route.isEmpty) {
      return;
    }

    // 1. PRODUCT REDIRECTION (Open Shop screen, select category, filter to this product)
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

    // If NONE action, do not perform navigation
    if (actionType == 'NONE') {
      return;
    }
  }

  String _formatImageUrl(String rawUrl) {
    if (rawUrl.isEmpty) return '';

    if (rawUrl.contains('/uploads/')) {
      final pathAfterUploads = rawUrl.substring(rawUrl.indexOf('/uploads/'));
      return '${ApiEndpoints.host}$pathAfterUploads';
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      final uri = Uri.tryParse(rawUrl);
      if (uri != null) {
        const devHosts = {'localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'};
        if (devHosts.contains(uri.host)) {
          return '${ApiEndpoints.host}${uri.path}';
        }
        return rawUrl;
      }
    }

    if (rawUrl.contains('/assets/')) {
      final pathAfterAssets = rawUrl.substring(rawUrl.indexOf('/assets/'));
      return 'https://f2hfresh.com$pathAfterAssets';
    }

    final formatted = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return '${ApiEndpoints.host}$formatted';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _banners.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 2.0,
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) {
                if (mounted) {
                  setState(() => _currentPage = index);
                }
              },
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
                                  return Container(
                                    color: const Color(0xFFF8FAFC),
                                    child: const Center(
                                      child: Icon(
                                        Icons.image_outlined,
                                        color: Color(0xFFCBD5E1),
                                        size: 28,
                                      ),
                                    ),
                                  );
                                },
                              )
                            : const SizedBox.shrink(),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_banners.length > 1) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_banners.length, (index) {
                final isSelected = index == (_currentPage % _banners.length);
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 2.5),
                  width: isSelected ? 8 : 5.5,
                  height: isSelected ? 8 : 5.5,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1),
                  ),
                );
              }),
            ),
          ],
        ],
      ),
    );
  }
}
