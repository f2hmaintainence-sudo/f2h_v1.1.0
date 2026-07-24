import 'package:flutter/material.dart';
import 'package:f2h_customer/core/di/injection.dart';
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
      final resp = await sl<DioClient>().dio.get(ApiEndpoints.banners);
      final data = resp.data;
      if (data['status'] == true && data['data'] is List) {
        final list = (data['data'] as List)
            .where((b) => b['isActive'] == true)
            .map((b) => Map<String, dynamic>.from(b as Map))
            .toList();
        if (mounted) setState(() { _banners = list; _loading = false; });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onBannerTap(Map<String, dynamic> banner) {
    final route = banner['route']?.toString() ?? '';
    if (route == 'subscribe') {
      // Navigate to Subscribe tab (index 3) via AppShell
      final shellState = context.findAncestorStateOfType<AppShellState>();
      shellState?.setTab(3);
    }
    // ponytail: extend with other routes (e.g. 'menu', 'cart') when needed
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        height: 140,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          height: 140,
          child: PageView.builder(
            itemCount: _banners.length,
            itemBuilder: (context, index) {
              final banner = _banners[index];
              final imageUrl = banner['imageUrl']?.toString() ?? '';
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
                  errorBuilder: (_, __, ___) => Container(
                    color: const Color(0xFF16A34A),
                    child: const Center(
                      child: Icon(Icons.image_not_supported, color: Colors.white54),
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
