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
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final imageUrl = banner['imageUrl']?.toString().toLowerCase() ?? '';

    // Admin-managed banners carry an explicit destination.
    final actionType = banner['actionType']?.toString().toUpperCase() ?? '';
    final actionValue = banner['actionValue']?.toString();
    if (actionType == 'PRODUCT' &&
        actionValue != null &&
        actionValue.startsWith('PRD')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              ProductDetailViewScreen(product: getProductById(actionValue)),
        ),
      );
      return;
    }
    if (actionType == 'CATEGORY' &&
        actionValue != null &&
        actionValue.isNotEmpty) {
      AppShell.of(context)?.setTab(1, category: actionValue);
      return;
    }
    if (actionType == 'MENU' || route == 'menu') {
      AppShell.of(context)?.setTab(1);
      return;
    }

    if (route == 'wallet' || imageUrl.contains('wallet_banner')) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WalletScreen()),
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
      // Admin banners may point at an external image host — only URLs served
      // by the API itself (or a stale dev host) get rewritten to the current
      // host, otherwise the external image would 404 against our domain.
      const localHosts = {'localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'};
      final apiHost = Uri.tryParse(ApiEndpoints.host)?.host;
      if (uri != null &&
          uri.path.isNotEmpty &&
          (localHosts.contains(uri.host) || uri.host == apiHost)) {
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

            final hasRichContent = (banner['title'] != null && banner['title'].toString().isNotEmpty) ||
                (banner['discountText'] != null && banner['discountText'].toString().isNotEmpty) ||
                (banner['discount_text'] != null && banner['discount_text'].toString().isNotEmpty) ||
                (banner['categoryName'] != null && banner['categoryName'].toString().isNotEmpty) ||
                (banner['category_name'] != null && banner['category_name'].toString().isNotEmpty) ||
                (banner['backgroundColor'] != null && banner['backgroundColor'].toString().isNotEmpty) ||
                (banner['background_color'] != null && banner['background_color'].toString().isNotEmpty);

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GestureDetector(
                onTap: () => _onBannerTap(banner),
                child: hasRichContent
                    ? _buildOfferCard(banner, imageUrl)
                    : Container(
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
                              return _buildOfferCard(banner, imageUrl);
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

  Widget _buildOfferCard(Map<String, dynamic> banner, String imageUrl) {
    final title = banner['title']?.toString() ?? 'Special Offer';
    final subtitle = banner['subtitle']?.toString() ?? banner['description']?.toString() ?? '';
    final discountText = banner['discountText']?.toString() ?? banner['discount_text']?.toString();
    final categoryName = banner['categoryName']?.toString() ?? banner['category_name']?.toString();
    final couponCode = banner['couponCode']?.toString() ?? banner['coupon_code']?.toString() ?? banner['promoCode']?.toString();
    final ctaText = banner['cta']?.toString() ?? banner['cta_label']?.toString() ?? 'Shop Now';
    final bannerType = banner['bannerType']?.toString() ?? banner['banner_type']?.toString() ?? 'home_carousel';
    final bgHex = banner['backgroundColor']?.toString() ?? banner['background_color']?.toString();

    Color bgColor = const Color(0xFF8B1214); // Dynamic crimson red matching admin preview
    if (bgHex != null && bgHex.isNotEmpty) {
      final cleanHex = bgHex.replaceAll('#', '').trim();
      if (cleanHex.length == 6) {
        bgColor = Color(int.parse('0xFF$cleanHex'));
      } else if (cleanHex.length == 8) {
        bgColor = Color(int.parse('0x$cleanHex'));
      }
    }

    String placementLabel = 'SPECIAL OFFER';
    IconData placementIcon = Icons.local_offer_rounded;
    if (bannerType == 'category_slide') {
      placementLabel = 'CATEGORY SLIDE';
      placementIcon = Icons.folder_copy_rounded;
    } else if (bannerType == 'checkout_promo' || bannerType == 'checkout_banner') {
      placementLabel = 'CHECKOUT PROMO';
      placementIcon = Icons.shopping_bag_rounded;
    } else if (bannerType == 'home_carousel') {
      placementLabel = 'HOME CAROUSEL';
      placementIcon = Icons.tag_rounded;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
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
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.25),
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
                                fontSize: 8,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (categoryName != null && categoryName.isNotEmpty) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.20),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            categoryName,
                            style: const TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                      if (discountText != null && discountText.isNotEmpty) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            discountText.toUpperCase(),
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w900,
                              color: bgColor,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 5),

                // Title
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    height: 1.15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),

                // Subtitle / Description
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 10,
                      height: 1.1,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: 6),

                // CTA / Coupon Code Button Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
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
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                          color: bgColor,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 11,
                        color: bgColor,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Right side product/banner image (if available)
          if (imageUrl.isNotEmpty) ...[
            const SizedBox(width: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 95,
                height: 70,
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
