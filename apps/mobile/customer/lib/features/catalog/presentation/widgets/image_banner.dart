import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/app.dart';

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

  @override
  void initState() {
    super.initState();
    _fetchBanners();
  }

  Future<void> _fetchBanners() async {
    try {
      final dioClient = DioClient();
      final resp = await dioClient.dio.get(ApiEndpoints.banners);
      final data = resp.data;
      if (data['status'] == true && data['data'] is List && (data['data'] as List).isNotEmpty) {
        final list = (data['data'] as List)
            .where((b) => b['isActive'] == true)
            .map((b) => Map<String, dynamic>.from(b as Map))
            .toList();
        if (mounted && list.isNotEmpty) {
          setState(() { _banners = list; _loading = false; });
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
          'id': 'sub-save-5',
          'imageUrl': '${ApiEndpoints.host}/uploads/banners/subscription_banner.png',
          'title': 'Save Up To 5%',
          'subtitle': 'Subscription to fresh milk, curd, paneer & more for hassle-free morning deliveries.',
          'cta': 'Order Now',
          'route': 'menu',
          'isActive': true,
        }
      ];
      _loading = false;
    });
  }

  void _onBannerTap(Map<String, dynamic> banner) {
    final shellState = context.findAncestorStateOfType<AppShellState>();
    shellState?.setTab(1); // Redirect to Menu tab (BrowseScreen)
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
        height: 150,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: Colors.grey.shade200,
        ),
        child: const Center(
          child: SizedBox(
            width: 24, height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (_banners.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 150,
          child: PageView.builder(
            itemCount: _banners.length,
            itemBuilder: (context, index) {
              final banner = _banners[index];
              final rawUrl = banner['imageUrl']?.toString() ?? '';
              final imageUrl = _formatImageUrl(rawUrl);

              return GestureDetector(
                onTap: () => _onBannerTap(banner),
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return Container(
                      color: const Color(0xFF16A34A),
                      child: const Center(
                        child: SizedBox(
                          width: 24, height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white,
                          ),
                        ),
                      ),
                    );
                  },
                  errorBuilder: (context, error, stackTrace) => Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A),
                      borderRadius: BorderRadius.circular(16),
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
                                child: const Text(
                                  'DAILY SUBSCRIPTION',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                banner['title']?.toString() ?? 'Save Up To 5%',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                banner['subtitle']?.toString() ??
                                    'Subscribe to fresh milk, curd, paneer & more for hassle-free morning deliveries.',
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
                          child: const Icon(
                            Icons.calendar_month_rounded,
                            color: Colors.amber,
                            size: 26,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
