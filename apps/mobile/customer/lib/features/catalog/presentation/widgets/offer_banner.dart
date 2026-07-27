// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : offer_banner.dart
// Description : Premium auto-rotating offer banner carousel for Customer App.
//               Loads banner assets directly from API uploads (/uploads/app_assets).
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';

class OfferBanner extends StatefulWidget {
  const OfferBanner({super.key});

  @override
  State<OfferBanner> createState() => _OfferBannerState();
}

class _OfferBannerState extends State<OfferBanner> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  Timer? _timer;
  bool _isLoading = true;

  List<Map<String, dynamic>> _offers = [];

  @override
  void initState() {
    super.initState();
    _fetchAppAssets();
  }

  Future<void> _fetchAppAssets() async {
    try {
      final dioClient = DioClient();
      final response = await dioClient.dio.get(ApiEndpoints.customerAssets);
      
      List<String> imageUrls = [];
      if (response.data != null && response.data['data'] != null && response.data['data']['assets'] is List) {
        final List assets = response.data['data']['assets'];
        for (final item in assets) {
          if (item is Map && item['type'] == 'image') {
            final rawUrl = item['url']?.toString() ?? '';
            if (rawUrl.isNotEmpty) {
              final fullUrl = rawUrl.startsWith('http')
                  ? rawUrl
                  : '${ApiEndpoints.host}$rawUrl';
              imageUrls.add(fullUrl);
            }
          }
        }
      }

      if (!mounted) return;

      if (imageUrls.isNotEmpty) {
        // Map fetched server asset images to offer banners
        setState(() {
          _offers = imageUrls.map((url) {
            final isMilk = url.contains('milk') || url.contains('splash');
            final isCurd = url.contains('curd');
            
            return {
              'imageUrl': url,
              'tag': isMilk ? 'FRESH MILK' : (isCurd ? 'ORGANIC CURD' : 'FLAT 50% OFF'),
              'title': isMilk ? 'Pure Farm Milk' : (isCurd ? 'Fresh Daily Curd' : 'Special Offer'),
              'subtitle': 'Delivered fresh from farm to home every morning.',
              'gradient': isMilk 
                  ? [const Color(0xFF16A34A), const Color(0xFF059669)]
                  : [const Color(0xFF0F766E), const Color(0xFF0D9488)],
            };
          }).toList();
          _isLoading = false;
        });
      } else {
        _useDefaultAssets();
      }
    } catch (_) {
      if (mounted) {
        _useDefaultAssets();
      }
    }

    _startAutoPlay();
  }

  void _useDefaultAssets() {
    // Construct direct static upload URLs from backend uploads/app_assets
    final String host = ApiEndpoints.host;
    final List<String> serverAssetPaths = [
      '$host/uploads/app_assets/images/milk_bottle.png',
      '$host/uploads/app_assets/images/milk_can.png',
      '$host/uploads/app_assets/images/curd.png',
      '$host/uploads/app_assets/images/oil.png',
    ];

    setState(() {
      _offers = [
        {
          'imageUrl': serverAssetPaths[0],
          'tag': 'FLAT 50% OFF',
          'title': 'First Order Special',
          'subtitle': 'Get 50% cashback on your first milk subscription order.',
          'gradient': [const Color(0xFF16A34A), const Color(0xFF059669)],
        },
        {
          'imageUrl': serverAssetPaths[1],
          'tag': 'MORNING GUARANTEE',
          'title': 'Delivered Before 7 AM',
          'subtitle': 'Chilled, unprocessed pure farm milk right at your doorstep.',
          'gradient': [const Color(0xFF0F766E), const Color(0xFF0D9488)],
        },
        {
          'imageUrl': serverAssetPaths[2],
          'tag': '100% PURE & FRESH',
          'title': 'Zero Preservatives',
          'subtitle': 'Untouched & lab-tested pure cow & buffalo milk daily.',
          'gradient': [const Color(0xFF15803D), const Color(0xFF16A34A)],
        },
      ];
      _isLoading = false;
    });
  }

  void _startAutoPlay() {
    _timer?.cancel();
    if (_offers.isEmpty) return;
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (mounted && _pageController.hasClients && _offers.isNotEmpty) {
        _currentPage = (_currentPage + 1) % _offers.length;
        _pageController.animateToPage(
          _currentPage,
          duration: const Duration(milliseconds: 600),
          curve: Curves.fastOutSlowIn,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        height: 140,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderLt),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
        ),
      );
    }

    if (_offers.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        children: [
          SizedBox(
            height: 140,
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) {
                setState(() => _currentPage = index);
              },
              itemCount: _offers.length,
              itemBuilder: (context, index) {
                final offer = _offers[index];
                final List<Color> bgColors = offer['gradient'] as List<Color>;
                final String imageUrl = offer['imageUrl'] as String;

                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(
                      colors: bgColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: bgColors.first.withValues(alpha: 0.25),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Stack(
                      children: [
                        // Decorative Background Circles
                        Positioned(
                          right: -20,
                          bottom: -20,
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                        Positioned(
                          right: 40,
                          top: -30,
                          child: Container(
                            width: 90,
                            height: 90,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.05),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),

                        // Content Layout
                        Padding(
                          padding: const EdgeInsets.all(18.0),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.4),
                                        ),
                                      ),
                                      child: Text(
                                        offer['tag'].toString(),
                                        style: GoogleFonts.outfit(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      offer['title'].toString(),
                                      style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      offer['subtitle'].toString(),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: Colors.white.withValues(alpha: 0.9),
                                        height: 1.2,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Network Image loaded directly from backend API uploads/app_assets
                              Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.4),
                                    width: 1.5,
                                  ),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(14),
                                  child: Image.network(
                                    imageUrl,
                                    fit: BoxFit.contain,
                                    errorBuilder: (context, error, stackTrace) {
                                      return const Icon(
                                        Icons.local_offer_rounded,
                                        color: Colors.white,
                                        size: 28,
                                      );
                                    },
                                    loadingBuilder: (context, child, loadingProgress) {
                                      if (loadingProgress == null) return child;
                                      return const Center(
                                        child: SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          // Page Indicator Dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_offers.length, (index) {
              final isSelected = _currentPage == index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isSelected ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isSelected ? kPrimary : kBorder,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
