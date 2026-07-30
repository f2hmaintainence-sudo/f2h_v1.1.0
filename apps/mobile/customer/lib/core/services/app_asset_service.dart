import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';

class AppAssetService {
  static final AppAssetService _instance = AppAssetService._internal();
  factory AppAssetService() => _instance;
  AppAssetService._internal();

  static const String _prefKey = 'cached_app_assets_v1';
  final Map<String, String> _assetMap = {};
  bool _isInitialized = false;

  /// Initialize and load cached mappings from SharedPreferences, then fetch fresh from API
  Future<void> init() async {
    if (_isInitialized) return;
    _isInitialized = true;
    await _loadFromLocalCache();
    // Silently refresh in background
    fetchAndCacheAppAssets();
  }

  Future<void> _loadFromLocalCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawData = prefs.getString(_prefKey);
      if (rawData != null && rawData.isNotEmpty) {
        final Map<String, dynamic> decoded = jsonDecode(rawData);
        decoded.forEach((key, value) {
          if (value is String) {
            _assetMap[key] = value;
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading cached app assets: $e');
    }
  }

  /// Fetches app assets list from GET /customer/assets and updates local cache
  Future<void> fetchAndCacheAppAssets() async {
    try {
      final dioClient = DioClient();
      final response = await dioClient.dio.get(ApiEndpoints.customerAssets);
      if (response.data != null &&
          response.data['data'] != null &&
          response.data['data']['assets'] is List) {
        final List assets = response.data['data']['assets'];
        final Map<String, String> newMap = {};

        for (final item in assets) {
          if (item is Map) {
            final key = item['key']?.toString() ?? '';
            final rawUrl = item['url']?.toString() ?? '';
            if (key.isNotEmpty && rawUrl.isNotEmpty) {
              final fullUrl = rawUrl.startsWith('http')
                  ? rawUrl
                  : '${ApiEndpoints.host}$rawUrl';
              newMap[key] = fullUrl;
            }
          }
        }

        if (newMap.isNotEmpty) {
          _assetMap.addAll(newMap);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_prefKey, jsonEncode(_assetMap));
        }
      }
    } catch (e) {
      debugPrint('Error fetching remote app assets: $e');
    }
  }

  /// Resolve an asset key (e.g. 'assets/icon/app_icon.png') to a full remote URL.
  /// Falls back to constructing host upload URL if key is not yet in the fetched asset map.
  static String getAssetUrl(String key) {
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    if (key.startsWith('/uploads/') || key.startsWith('uploads/')) {
      final clean = key.startsWith('/') ? key : '/$key';
      return '${ApiEndpoints.host}$clean';
    }

    // Check in-memory map
    if (_instance._assetMap.containsKey(key)) {
      return _instance._assetMap[key]!;
    }

    // Fallback: construct standard URL from uploads/app_assets directory
    String subPath = key;
    if (subPath.startsWith('assets/')) {
      subPath = subPath.substring('assets/'.length);
    } else if (subPath.startsWith('/assets/')) {
      subPath = subPath.substring('/assets/'.length);
    }

    // Map legacy 'assets/icon/home_bg.jpg' to 'bg/home_bg.jpg' if needed
    if (subPath == 'icon/home_bg.jpg') {
      subPath = 'bg/home_bg.jpg';
    }

    return '${ApiEndpoints.host}/uploads/app_assets/$subPath';
  }
}

/// Reusable Widget for rendering app assets fetched from backend & cached locally
class AppAssetImage extends StatelessWidget {
  final String assetKey;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;
  final Widget Function(BuildContext, Object, StackTrace?)? errorBuilder;

  const AppAssetImage({
    required this.assetKey,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.errorBuilder,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final imageUrl = AppAssetService.getAssetUrl(assetKey);

    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      placeholder: (context, url) => SizedBox(
        width: width,
        height: height,
        child: const Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 1.5),
          ),
        ),
      ),
      errorWidget: (context, url, error) {
        if (errorBuilder != null) {
          return errorBuilder!(context, error, null);
        }
        return Container(
          width: width,
          height: height,
          color: Colors.grey.shade200,
          child: const Icon(Icons.image_not_supported_outlined, size: 20, color: Colors.grey),
        );
      },
    );
  }
}
