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

            final maxImageHeight = MediaQuery.of(context).size.height * 0.45;
            final screenWidth = MediaQuery.of(context).size.width - 36;
            final containerWidth = screenWidth.clamp(0.0, 380.0);

            final hasCustomImage = imageUrl.isNotEmpty;

            Widget imageWidget;
            if (hasCustomImage) {
              imageWidget = Image.network(
                imageUrl,
                width: double.infinity,
                fit: BoxFit.fitWidth,
                errorBuilder: (_, _, e) => Container(
                  height: 160,
                  color: bannerBgColor.withValues(alpha: 0.15),
                  child: Center(
                    child: Icon(Icons.local_offer_rounded, size: 48, color: bannerBgColor),
                  ),
                ),
                loadingBuilder: (_, child, progress) {
                  if (progress == null) return child;
                  return Container(
                    height: 180,
                    width: double.infinity,
                    color: const Color(0xFFF1F5F9),
                    child: const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                      ),
                    ),
                  );
                },
              );
            } else {
              imageWidget = Container(
                height: 140,
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [bannerBgColor, bannerBgColor.withValues(alpha: 0.85)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: const Center(
                  child: Icon(Icons.stars_rounded, size: 54, color: Colors.white),
                ),
              );
            }

            return Dialog(
              backgroundColor: Colors.transparent,
              insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              elevation: 0,
              // The Stack is capped at the card width so the close button can be
              // positioned against the card's own corner. Constraining the card
              // instead would leave the Stack full-width and strand the button
              // out in the barrier on wide screens.
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: containerWidth),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Main Banner Card Container: Top Image -> Next Details
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 28,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // 1. TOP: Banner Image (Full width, edge-to-edge)
                          GestureDetector(
                            onTap: () {
                              Navigator.pop(dialogContext);
                              _handleRedirection(context, actionType, actionValue);
                            },
                            child: ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                              child: imageWidget,
                            ),
                          ),

                          // 2. NEXT: Banner Details Section
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (discountText != null && discountText.isNotEmpty) ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFF59E0B), width: 1),
                                    ),
                                    child: Text(
                                      discountText.toUpperCase(),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFFB45309),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],

                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w900,
                                    color: kText,
                                    height: 1.25,
                                  ),
                                  textAlign: TextAlign.center,
                                ),

                                if (description != null && description.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    description,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: kTextSub,
                                      height: 1.4,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],

                                const SizedBox(height: 16),

                                // Full-width CTA Button
                                SizedBox(
                                  width: double.infinity,
                                  height: 46,
                                  child: ElevatedButton(
                                    onPressed: () {
                                      Navigator.pop(dialogContext);
                                      _handleRedirection(context, actionType, actionValue);
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: bannerBgColor,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          ctaLabel,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.3,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        const Icon(Icons.arrow_forward_rounded, size: 16),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Close 'X' sits inside the card's top-right corner. Hanging
                    // it outside the card notched the rounded corner and risked
                    // being clipped by the dialog inset on narrow screens.
                    Positioned(
                      top: 4,
                      right: 4,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(dialogContext),
                        behavior: HitTestBehavior.opaque,
                        // Padding keeps the visible circle small while giving the
                        // tap target a comfortable 44x44.
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              // Translucent scrim so the icon stays legible over
                              // whatever artwork the banner image happens to use.
                              color: Colors.black.withValues(alpha: 0.45),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close_rounded, size: 18, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
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
    if (actionType == 'NONE') {
      return;
    }

    if (actionType == 'PRODUCT' && actionValue != null && actionValue.isNotEmpty) {
      final appShell = AppShell.of(context);
      if (appShell != null) {
        appShell.setTab(1, productId: actionValue);
      } else {
        AppShell.activeTab = 1;
        Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppShell()),
          (route) => false,
        );
      }
      return;
    }

    if (actionType == 'SUBSCRIPTION') {
      AppShell.of(context)?.setTab(2);
      return;
    }

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
