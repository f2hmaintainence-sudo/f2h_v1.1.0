
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

// ══════════════════════════════════════════════════════════
//  PRODUCT VARIANT — size/weight options per product
// ══════════════════════════════════════════════════════════

class ProductVariant {
  final String id;
  final String label;     // e.g. "500 ml", "1 Litre", "250 g"
  final double price;
  final double originalPrice;
  final double? subscriptionPrice;
  const ProductVariant({
    required this.id,
    required this.label,
    required this.price,
    required this.originalPrice,
    this.subscriptionPrice,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'price': price,
      'originalPrice': originalPrice,
      'subscriptionPrice': subscriptionPrice,
    };
  }

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: json['id'],
      label: json['label'],
      price: json['price'],
      originalPrice: json['originalPrice'],
      subscriptionPrice: json['subscriptionPrice']?.toDouble(),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  PRODUCT MODEL
// ══════════════════════════════════════════════════════════

class Product {
  final String id, name, vendor, unit, category, emoji, badge;
  final double price, originalPrice, rating;
  final double? subscriptionPrice;
  final int reviews;
  final bool isOrganic, isSubscribable, isOneTime;
  final Color badgeColor;
  final List<ProductVariant> variants;
  final String? imageAsset;
  final List<String> images;
  const Product({
    required this.id,
    required this.name,
    required this.vendor,
    required this.unit,
    required this.category,
    required this.emoji,
    required this.price,
    required this.originalPrice,
    this.subscriptionPrice,
    required this.rating,
    required this.reviews,
    this.isOrganic = false,
    this.isSubscribable = true,
    this.isOneTime = true,
    required this.badge,
    required this.badgeColor,
    this.variants = const [],
    this.imageAsset,
    this.images = const [],
  });

  List<ProductVariant> get allVariants {
    if (variants.isNotEmpty) return variants;
    final nameLower = name.toLowerCase();
    final unitLower = unit.toLowerCase();
    final isLiquid = category == 'Milk' || category == 'Oil' || unitLower.contains('ml') || unitLower.contains('l') || nameLower.contains('milk') || nameLower.contains('ghee') || nameLower.contains('oil');
    if (isLiquid) {
      return [
        ProductVariant(id: '$id-200ml', label: '200 ml', price: (price * 0.45).roundToDouble(), originalPrice: (originalPrice * 0.45).roundToDouble()),
        ProductVariant(id: '$id-500ml', label: '500 ml', price: price, originalPrice: originalPrice),
        ProductVariant(id: '$id-1L', label: '1 Litre', price: (price * 1.8).roundToDouble(), originalPrice: (originalPrice * 1.8).roundToDouble()),
      ];
    } else {
      return [
        ProductVariant(id: '$id-200g', label: '200 g', price: (price * 0.45).roundToDouble(), originalPrice: (originalPrice * 0.45).roundToDouble()),
        ProductVariant(id: '$id-500g', label: '500 g', price: price, originalPrice: originalPrice),
        ProductVariant(id: '$id-1kg', label: '1 kg', price: (price * 1.8).roundToDouble(), originalPrice: (originalPrice * 1.8).roundToDouble()),
      ];
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'vendor': vendor,
      'unit': unit,
      'category': category,
      'emoji': emoji,
      'badge': badge,
      'price': price,
      'originalPrice': originalPrice,
      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      'subscriptionPrice': subscriptionPrice,
      'rating': rating,
      'reviews': reviews,
      'isOrganic': isOrganic,
      'isSubscribable': isSubscribable,
      'isOneTime': isOneTime,
      'badgeColor': badgeColor.toARGB32(),
      'variants': variants.map((v) => v.toJson()).toList(),
      'imageAsset': imageAsset,
      'images': images,
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'],
      name: json['name'],
      vendor: json['vendor'],
      unit: json['unit'],
      category: json['category'],
      emoji: json['emoji'],
      badge: json['badge'],
      price: json['price'],
      originalPrice: json['originalPrice'],
      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      subscriptionPrice: json['subscriptionPrice']?.toDouble(),
      rating: json['rating'],
      reviews: json['reviews'],
      isOrganic: json['isOrganic'] ?? false,
      isSubscribable: json['isSubscribable'] ?? true,
      isOneTime: json['isOneTime'] ?? true,
      badgeColor: Color(json['badgeColor']),
      variants: json['variants'] != null
          ? (json['variants'] as List).map((v) => ProductVariant.fromJson(v)).toList()
          : [],
      imageAsset: json['imageAsset'],
      images: json['images'] != null
          ? List<String>.from(json['images'])
          : (json['imageAsset'] != null ? [json['imageAsset'] as String] : const []),
    );
  }
}

// ── Image helpers ────────────────────────────────────────

IconData getProductFallbackIcon(String name) {
  final n = name.toLowerCase();
  if (n.contains('milk')) return Icons.water_drop_rounded;
  if (n.contains('curd') || n.contains('yogurt')) return Icons.soup_kitchen_rounded;
  if (n.contains('kova') || n.contains('sweets') || n.contains('peda') || n.contains('sweet')) return Icons.cake_rounded;
  if (n.contains('almond') || n.contains('badam') || n.contains('nut') || n.contains('dry fruit')) return Icons.grain_rounded;
  if (n.contains('ghee')) return Icons.opacity_rounded;
  if (n.contains('butter') && !n.contains('milk')) return Icons.breakfast_dining_rounded;
  if (n.contains('paneer') || n.contains('cheese')) return Icons.grid_view_rounded;
  if (n.contains('chaas') || n.contains('buttermilk') || n.contains('drink')) return Icons.local_cafe_rounded;
  if (n.contains('oil')) return Icons.water_drop_outlined;
  if (n.contains('honey')) return Icons.hive_rounded;
  return Icons.shopping_bag_outlined;
}

(Color, Color) getFallbackColors(String name) {
  final n = name.toLowerCase();
  if (n.contains('milk')) return (const Color(0xFFE8F5E9), const Color(0xFF1B5E20));
  if (n.contains('curd') || n.contains('yogurt')) return (const Color(0xFFE3F2FD), const Color(0xFF0D47A1));
  if (n.contains('kova') || n.contains('sweets') || n.contains('peda') || n.contains('sweet')) return (const Color(0xFFF3E5F5), const Color(0xFF4A148C));
  if (n.contains('almond') || n.contains('badam') || n.contains('nut')) return (const Color(0xFFFFF3E0), const Color(0xFFE65100));
  if (n.contains('ghee')) return (const Color(0xFFFFFDE7), const Color(0xFFF57F17));
  if (n.contains('butter')) return (const Color(0xFFFFF8E1), const Color(0xFFFF6F00));
  if (n.contains('paneer') || n.contains('cheese')) return (const Color(0xFFE0F2F1), const Color(0xFF004D40));
  if (n.contains('chaas') || n.contains('buttermilk')) return (const Color(0xFFF1F8E9), const Color(0xFF33691E));
  return (const Color(0xFFF5F5F5), const Color(0xFF16653A));
}

/// Renders the product image using the remote URL if available, falling back to an icon.
Widget buildProductImage(String name, {String? imageAsset, double? width, double? height, BoxFit fit = BoxFit.cover, Color? fallbackColor}) {
  String? asset = imageAsset;

  if (asset != null && asset.isNotEmpty) {
    if (asset.startsWith('assets/')) {
      return Image.asset(
        asset,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) {
          return _fallbackIconWidget(name, width, height, fallbackColor);
        },
      );
    } else {
      String resolvedAsset = asset;
      // 1. Convert relative path (e.g. '/uploads/...' or 'uploads/...' or 'products/...' or 'categories/...') to absolute URL using the active baseUrl
      if (resolvedAsset.startsWith('/uploads/') || resolvedAsset.startsWith('uploads/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(RegExp(r'/+$'), ''); // strip trailing slash
        final cleanAsset = resolvedAsset.startsWith('/') ? resolvedAsset : '/$resolvedAsset';
        resolvedAsset = '$activeBase$cleanAsset';
      } else if (resolvedAsset.startsWith('products/') || resolvedAsset.startsWith('categories/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(RegExp(r'/+$'), '');
        resolvedAsset = '$activeBase/uploads/$resolvedAsset';
      } else if (resolvedAsset.startsWith('/products/') || resolvedAsset.startsWith('/categories/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(RegExp(r'/+$'), '');
        resolvedAsset = '$activeBase/uploads$resolvedAsset';
      }

      if (resolvedAsset.startsWith('http://') || resolvedAsset.startsWith('https://')) {
        // 2. Normalize secure connection protocols for localhost/private IPs
        if (resolvedAsset.startsWith('https://192.168.') || resolvedAsset.startsWith('https://localhost') || resolvedAsset.startsWith('https://127.0.0.1') || resolvedAsset.startsWith('https://10.0.2.2')) {
          resolvedAsset = resolvedAsset.replaceFirst('https://', 'http://');
        }

        // 3. Dynamically rewrite local development/private network IP address hosts to match the active baseUrl.
        try {
          final activeBase = ApiEndpoints.baseUrl;
          final uri = Uri.parse(resolvedAsset);
          if ((uri.host.startsWith('192.168.') || uri.host == 'localhost' || uri.host == '127.0.0.1' || uri.host == '10.0.2.2') &&
              !activeBase.contains(uri.host)) {
            final activeUri = Uri.parse(activeBase);
            resolvedAsset = uri.replace(
              scheme: activeUri.scheme,
              host: activeUri.host,
              port: activeUri.port,
            ).toString();
          }
        } catch (_) {
          // Fallback if URL parsing fails
        }

        return CachedNetworkImage(
          imageUrl: resolvedAsset,
          width: width,
          height: height,
          fit: fit,
          placeholder: (context, url) => _fallbackIconWidget(name, width, height, fallbackColor),
          errorWidget: (context, url, err) {
            return _fallbackIconWidget(name, width, height, fallbackColor);
          },
        );
      }
    }
  }

  return _fallbackIconWidget(name, width, height, fallbackColor);
}

Widget _fallbackIconWidget(String name, double? width, double? height, Color? fallbackColor) {
  final (bg, defaultIconColor) = getFallbackColors(name);
  return Container(
    width: width,
    height: height,
    color: bg,
    child: Center(
      child: Icon(
        getProductFallbackIcon(name),
        color: fallbackColor ?? defaultIconColor,
        size: width != null ? (width * 0.45).clamp(16.0, 36.0) : 24,
      ),
    ),
  );
}

Product getProductById(String id, {String? name, String? variantName, double? price, double? subscriptionPrice, String? imageAsset, bool isSubscribable = true, bool isOneTime = true}) {
  return Product(
    id: id,
    name: name?.replaceAll('_', ' ') ?? 'Product',
    vendor: 'Farm to Home',
    unit: variantName ?? 'Unit',
    category: 'General',
    emoji: '📦',
    price: price ?? 0.0,
    originalPrice: price ?? 0.0,
    subscriptionPrice: subscriptionPrice,
    rating: 4.5,
    reviews: 10,
    isOrganic: false,
    isSubscribable: isSubscribable,
    isOneTime: isOneTime,
    badge: 'Fresh',
    badgeColor: const Color(0xFF1B4332),
    imageAsset: imageAsset,
    variants: [],
  );
}

