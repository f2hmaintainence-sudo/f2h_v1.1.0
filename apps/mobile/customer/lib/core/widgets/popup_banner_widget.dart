import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';

/// App launch & recurring popup banner widget (Home Screen ONLY).
/// Rotates to the next active banner 2 minutes after a banner is closed.
class PopupBannerWidget {
  static List<Map<String, dynamic>> _bannerList = [];
  static int _currentBannerIndex = 0;
  static bool _hasLoadedBanners = false;
  static Timer? _nextBannerTimer;
  static bool _isBannerShowing = false;
  static DateTime? _nextDueTime;

  static Future<void> checkAndShowPopupBanner(BuildContext context) async {
    // Popup banner should ONLY be shown on the home screen
    final appShell = AppShell.of(context);
    if (appShell != null && !appShell.isHomeScreen) return;

    if (!_hasLoadedBanners) {
      _hasLoadedBanners = true;
      try {
        final url = Uri.parse('${ApiEndpoints.baseUrl}/customer/popup-banner');
        final response = await http.get(url).timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body);
          if (body['status'] == true) {
            final rawBanners = body['banners'] ?? (body['data'] != null ? [body['data']] : []);
            if (rawBanners is List && rawBanners.isNotEmpty) {
              _bannerList = List<Map<String, dynamic>>.from(
                rawBanners.map((b) => Map<String, dynamic>.from(b)),
              );
            }
          }
        }
      } catch (_) {
        // Ignore network errors on launch
      }
    }

    if (_bannerList.isEmpty || _isBannerShowing) return;

    // Check if 2 minutes have passed if a next due time was set
    if (_nextDueTime != null && DateTime.now().isBefore(_nextDueTime!)) {
      return;
    }

    // The banner fetch above is awaited, so the screen may have been popped
    // before we get here — showing a dialog on a dead context throws.
    if (!context.mounted) return;

    _showCurrentBanner(context);
  }

  static void onReturnedToHomeScreen(BuildContext context) {
    if (_bannerList.isEmpty || _isBannerShowing) return;
    if (_nextDueTime != null && DateTime.now().isBefore(_nextDueTime!)) {
      return;
    }
    _showCurrentBanner(context);
  }

  static void _showCurrentBanner(BuildContext context) {
    if (_bannerList.isEmpty || _isBannerShowing) return;
    if (!context.mounted) return;

    final appShell = AppShell.of(context);
    if (appShell != null && !appShell.isHomeScreen) return;

    final bannerData = _bannerList[_currentBannerIndex % _bannerList.length];
    _isBannerShowing = true;
    _showBannerDialog(context, bannerData);
  }

  static void _scheduleNextBanner(BuildContext context) {
    _isBannerShowing = false;
    _currentBannerIndex = (_currentBannerIndex + 1) % _bannerList.length;
    _nextDueTime = DateTime.now().add(const Duration(minutes: 2));

    _nextBannerTimer?.cancel();
    _nextBannerTimer = Timer(const Duration(minutes: 2), () {
      if (context.mounted) {
        _showCurrentBanner(context);
      }
    });
  }

  static String _resolveFullImageUrl(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '';
    final url = raw.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    final clean = url.startsWith('/') ? url : '/$url';
    return '${ApiEndpoints.host}$clean';
  }

  static void _showBannerDialog(BuildContext context, Map<String, dynamic> bannerData) {
    final title = bannerData['title']?.toString() ?? 'Special Offer';
    final discountText = bannerData['discount_text']?.toString();
    final description = bannerData['description']?.toString();
    final rawImageUrl = bannerData['image_url']?.toString() ?? '';
    final imageUrl = _resolveFullImageUrl(rawImageUrl);
    final actionType = (bannerData['action_type']?.toString() ?? 'NONE').toUpperCase();
    final actionValue = bannerData['action_value']?.toString();
    final ctaLabel = bannerData['cta_label']?.toString() ?? 'Shop Now';

    Color bannerBgColor = kPrimary;
    if (bannerData['background_color'] != null) {
      try {
        final hex = bannerData['background_color'].toString().replaceAll('#', '');
        if (hex.length == 6) {
          bannerBgColor = Color(int.parse('0xFF$hex'));
        }
      } catch (_) {}
    }

    showDialog(
      context: context,
      useRootNavigator: true,
      barrierDismissible: true,
      builder: (dialogContext) {
        // Declared outside StatefulBuilder so state persists across rebuilds
        double? imageAspectRatio;
        bool resolving = false;

        return StatefulBuilder(
          builder: (sbContext, setState) {
            void resolveAspectRatio() {
              if (resolving || imageUrl.isEmpty) return;
              resolving = true;
              final imageProvider = NetworkImage(imageUrl);
              final stream = imageProvider.resolve(ImageConfiguration.empty);
              stream.addListener(
                ImageStreamListener((info, _) {
                  final w = info.image.width.toDouble();
                  final h = info.image.height.toDouble();
                  if (h > 0 && sbContext.mounted) {
                    setState(() => imageAspectRatio = w / h);
                  }
                }, onError: (_, e) { resolving = false; }),
              );
            }

            if (imageAspectRatio == null && imageUrl.isNotEmpty) {
              resolveAspectRatio();
            }

            final maxImageHeight = MediaQuery.of(context).size.height * 0.75;
            final screenWidth = MediaQuery.of(context).size.width - 32;
            final containerWidth = screenWidth.clamp(0.0, 420.0);

            final hasCustomImage = imageUrl.isNotEmpty;

            Widget imageWidget;
            if (hasCustomImage) {
              if (imageAspectRatio != null) {
                final naturalHeight = containerWidth / imageAspectRatio!;
                final clampedHeight = naturalHeight.clamp(120.0, maxImageHeight);
                imageWidget = SizedBox(
                  width: double.infinity,
                  height: clampedHeight,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, e) => Container(
                      height: 200,
                      color: bannerBgColor.withValues(alpha: 0.15),
                      child: Center(
                        child: Icon(Icons.local_offer_rounded, size: 54, color: bannerBgColor),
                      ),
                    ),
                  ),
                );
              } else {
                // Loading placeholder while resolving aspect ratio
                imageWidget = Container(
                  height: 240,
                  width: double.infinity,
                  color: const Color(0xFF1E293B),
                  child: const Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    ),
                  ),
                );
              }
            } else {
              // No image URL: show rich gradient card
              imageWidget = Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [bannerBgColor, bannerBgColor.withValues(alpha: 0.85)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.stars_rounded, size: 56, color: Colors.white),
                    const SizedBox(height: 16),
                    if (discountText != null && discountText.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          discountText.toUpperCase(),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            color: bannerBgColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        description,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.white70,
                          height: 1.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          _handleRedirection(context, actionType, actionValue);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: bannerBgColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(
                          ctaLabel,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            return Dialog(
              backgroundColor: Colors.transparent,
              insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              elevation: 0,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  // Full-bleed edge-to-edge banner card with NO borders or empty white space
                  GestureDetector(
                    onTap: () {
                      Navigator.pop(dialogContext);
                      _handleRedirection(context, actionType, actionValue);
                    },
                    child: Container(
                      width: double.infinity,
                      constraints: BoxConstraints(maxWidth: containerWidth),
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.35),
                            blurRadius: 30,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: imageWidget,
                      ),
                    ),
                  ),

                  // Floating circular Close 'X' button on top-right corner
                  Positioned(
                    top: -12,
                    right: -12,
                    child: GestureDetector(
                      onTap: () => Navigator.pop(dialogContext),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF1E293B)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }, // end StatefulBuilder builder
        ); // end StatefulBuilder
      }, // end showDialog builder
    ).then((_) {
      if (!context.mounted) return;
      _scheduleNextBanner(context);
    });
  }

  static void _handleRedirection(BuildContext context, String actionType, String? actionValue) {
    if (actionType == 'PRODUCT' && actionValue != null && actionValue.startsWith('PRD')) {
      final p = getProductById(actionValue);
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProductDetailViewScreen(product: p),
        ),
      );
    } else {
      final appShell = AppShell.of(context);
      if (appShell != null) {
        appShell.setTab(1, category: actionValue);
      } else {
        AppShell.activeTab = 1;
        Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppShell()),
          (route) => false,
        );
      }
    }
  }
}
