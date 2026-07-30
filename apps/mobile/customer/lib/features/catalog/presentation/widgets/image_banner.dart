import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/features/profile/presentation/screens/referral_screen.dart';

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
    final route = banner['route']?.toString().toLowerCase() ?? '';
    final imageUrl = banner['imageUrl']?.toString().toLowerCase() ?? '';
    final id = banner['id']?.toString().toLowerCase() ?? '';

    if (route == 'subscribe' || imageUrl.contains('sub_banner_1') || id.contains('sub-banner-1')) {
      final shellState = context.findAncestorStateOfType<AppShellState>();
      shellState?.setTab(3); // Redirect to Subscription tab
    } else if (route == 'refer' || imageUrl.contains('sub_banner_2') || id.contains('sub-banner-2')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => const ReferralScreen(),
        ),
      );
    } else {
      final shellState = context.findAncestorStateOfType<AppShellState>();
      shellState?.setTab(1); // Redirect to Menu tab (BrowseScreen)
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
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
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
                        final isRefer = banner['route'] == 'refer' || imageUrl.contains('sub_banner_2');
                        final isMenu = banner['route'] == 'menu' || imageUrl.contains('sub_banner_3');
                        return Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isRefer
                                  ? [const Color(0xFFD97706), const Color(0xFFF59E0B)]
                                  : isMenu
                                      ? [const Color(0xFF0284C7), const Color(0xFF38BDF8)]
                                      : [const Color(0xFF15803D), const Color(0xFF22C55E)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.white24,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        isRefer
                                            ? 'REFER & EARN'
                                            : isMenu
                                                ? 'FARM FRESH'
                                                : 'DAILY SUBSCRIPTION',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      banner['title']?.toString() ??
                                          (isRefer
                                              ? 'Refer & Earn'
                                              : isMenu
                                                  ? 'Farm Fresh Essentials'
                                                  : 'VIP Member'),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 18,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      banner['subtitle']?.toString() ??
                                          (isRefer
                                              ? 'Invite friends and earn rewards on every referral.'
                                              : isMenu
                                                  ? 'Pure, fresh and natural milk, curd, paneer & ghee.'
                                                  : 'Exclusive benefits & premium experience.'),
                                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Container(
                                width: 48,
                                height: 48,
                                decoration: const BoxDecoration(
                                  color: Colors.white24,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isRefer
                                      ? Icons.card_giftcard_rounded
                                      : isMenu
                                          ? Icons.shopping_bag_rounded
                                          : Icons.calendar_month_rounded,
                                  color: Colors.amber,
                                  size: 26,
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
