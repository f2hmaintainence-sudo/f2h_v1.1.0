import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
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
    final actionType = (banner['actionType'] ?? banner['action_type'] ?? banner['route'] ?? '').toString().toUpperCase();
    final actionValue = (banner['actionValue'] ?? banner['action_value'] ?? banner['categoryId'] ?? banner['category_id'] ?? banner['productId'] ?? banner['product_id'] ?? '').toString();
    final route = banner['route']?.toString().toLowerCase() ?? '';

    if (actionType == 'PRODUCT' && actionValue.isNotEmpty) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProductDetailViewScreen(product: getProductById(actionValue)),
        ),
      );
      return;
    }

    if ((actionType == 'CATEGORY' || route == 'category') && actionValue.isNotEmpty) {
      AppShell.of(context)?.setTab(1, category: actionValue);
      return;
    }

    if (actionType == 'SUBSCRIPTION' || route == 'subscribe') {
      AppShell.of(context)?.setTab(2);
      return;
    }

    if (actionType == 'WALLET' || route == 'wallet' || banner['imageUrl'].toString().toLowerCase().contains('wallet_banner')) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WalletScreen()),
      );
      return;
    }

    if (actionType == 'REFERRAL' || route == 'refer') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ReferralScreen()),
      );
      return;
    }

    if (actionType == 'MENU' || route == 'menu') {
      AppShell.of(context)?.setTab(1);
      return;
    }

    // Default fallback to Menu tab
    AppShell.of(context)?.setTab(1);
  }

  String _formatImageUrl(String rawUrl) {
    if (rawUrl.isEmpty) return '';

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      final uri = Uri.tryParse(rawUrl);
      if (uri != null) {
        const devHosts = {'localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'};
        if (devHosts.contains(uri.host) || uri.path.contains('/uploads/')) {
          final pathAfterUploads = uri.path.contains('/uploads/')
              ? uri.path.substring(uri.path.indexOf('/uploads/'))
              : uri.path;
          return '${ApiEndpoints.host}$pathAfterUploads';
        }
        return rawUrl;
      }
    }

    if (rawUrl.contains('/uploads/')) {
      final pathAfterUploads = rawUrl.substring(rawUrl.indexOf('/uploads/'));
      return '${ApiEndpoints.host}$pathAfterUploads';
    }

    final formatted = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return '${ApiEndpoints.host}$formatted';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 3.14,
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
            final rawUrl = banner['imageUrl']?.toString() ?? '';
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
    final title = banner['title']?.toString() ?? 'Special Offer';
    final subtitle = banner['subtitle']?.toString() ?? banner['description']?.toString() ?? '';
    final discountText = banner['discountText']?.toString() ?? banner['discount_text']?.toString();
    final categoryName = banner['categoryName']?.toString() ?? banner['category_name']?.toString();
    final couponCode = banner['couponCode']?.toString() ?? banner['coupon_code']?.toString() ?? banner['promoCode']?.toString();
    final ctaText = banner['cta']?.toString() ?? banner['cta_label']?.toString() ?? 'Shop Now';
    final bannerType = banner['bannerType']?.toString() ?? banner['banner_type']?.toString() ?? 'home_carousel';
    final bgHex = banner['backgroundColor']?.toString() ?? banner['background_color']?.toString();

    Color bgColor = const Color(0xFFa21616); // Dynamic crimson red matching admin preview
    if (bgHex != null && bgHex.isNotEmpty) {
      final cleanHex = bgHex.replaceAll('#', '').trim();
      if (cleanHex.length == 6) {
        bgColor = Color(int.parse('0xFF$cleanHex'));
      } else if (cleanHex.length == 8) {
        bgColor = Color(int.parse('0x$cleanHex'));
      }
    }

    String placementLabel = 'CATEGORY SLIDE';
    IconData placementIcon = Icons.folder_copy_rounded;
    if (bannerType == 'home_carousel') {
      placementLabel = 'HOME CAROUSEL';
      placementIcon = Icons.tag_rounded;
    } else if (bannerType == 'checkout_promo' || bannerType == 'checkout_banner') {
      placementLabel = 'CHECKOUT PROMO';
      placementIcon = Icons.shopping_bag_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          // Left text & badges section
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Top pill badges row
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      // Badge 1: Banner Placement
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.30),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(placementIcon, size: 10, color: Colors.white),
                            const SizedBox(width: 3),
                            Text(
                              placementLabel,
                              style: const TextStyle(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (categoryName != null && categoryName.isNotEmpty) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.22),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            categoryName,
                            style: const TextStyle(
                              fontSize: 8.5,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                      if (discountText != null && discountText.isNotEmpty) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            discountText.toUpperCase(),
                            style: TextStyle(
                              fontSize: 8.5,
                              fontWeight: FontWeight.w900,
                              color: bgColor,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 6),

                // Title
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                    height: 1.15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),

                // Subtitle / Description
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.88),
                      fontSize: 10.5,
                      height: 1.1,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: 8),

                // CTA / Coupon Code Button Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.10),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        (couponCode != null && couponCode.isNotEmpty)
                            ? 'USE CODE: $couponCode'
                            : ctaText,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: bgColor,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 12,
                        color: bgColor,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Right side product/banner image
          const SizedBox(width: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 110,
              height: 86,
              color: Colors.white.withValues(alpha: 0.15),
              child: imageUrl.isNotEmpty
                  ? Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: Colors.white.withValues(alpha: 0.15),
                        child: const Center(
                          child: Icon(
                            Icons.shopping_bag_rounded,
                            color: Colors.white70,
                            size: 32,
                          ),
                        ),
                      ),
                    )
                  : Container(
                      color: Colors.white.withValues(alpha: 0.15),
                      child: const Center(
                        child: Icon(
                          Icons.shopping_bag_rounded,
                          color: Colors.white70,
                          size: 32,
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
