import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  PRODUCT VARIANT — size/weight options per product
// ══════════════════════════════════════════════════════════

class ProductVariant {
  final String id;
  final String label; // e.g. "500 ml", "1 Litre", "250 g"
  final String? unitValue;
  final String? unitType;
  final double price;
  final double originalPrice;
  final double? subscriptionPrice;
  final double? availableQuantity;
  final double? lowStockThreshold;
  final bool isLowStock;
  final String? imagePath;
  final List<String> images;

  const ProductVariant({
    required this.id,
    required this.label,
    this.unitValue,
    this.unitType,
    required this.price,
    required this.originalPrice,
    this.subscriptionPrice,
    this.availableQuantity,
    this.lowStockThreshold,
    this.isLowStock = false,
    this.imagePath,
    this.images = const [],
  });

  String get formattedUnit {
    if (unitValue != null &&
        unitType != null &&
        unitValue!.toString().trim().isNotEmpty &&
        unitType!.toString().trim().isNotEmpty) {
      final doubleVal = double.tryParse(unitValue!);
      final cleanVal = doubleVal != null
          ? (doubleVal == doubleVal.toInt()
                ? doubleVal.toInt().toString()
                : doubleVal.toString())
          : unitValue!;
      return '$cleanVal ${unitType!}'.trim();
    }
    return label;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'unit_value': unitValue,
      'unit_type': unitType,
      'price': price,
      'originalPrice': originalPrice,
      'subscriptionPrice': subscriptionPrice,
      'availableQuantity': availableQuantity,
      'lowStockThreshold': lowStockThreshold,
      'isLowStock': isLowStock,
      'imagePath': imagePath,
      'images': images,
    };
  }

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'] ?? json['variant_images'];
    List<String> parsedImages = [];
    if (rawImages is List) {
      parsedImages = rawImages.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    }
    final imgPath = json['image_path']?.toString() ?? json['imagePath']?.toString() ?? json['image']?.toString();
    if (parsedImages.isEmpty && imgPath != null && imgPath.isNotEmpty) {
      parsedImages = [imgPath];
    }

    final priceVal = double.tryParse(json['final_price']?.toString() ?? '') ??
        double.tryParse(json['finalPrice']?.toString() ?? '') ??
        double.tryParse(json['price']?.toString() ?? '') ??
        0.0;
    final origPriceVal = double.tryParse(json['original_price']?.toString() ?? '') ??
        double.tryParse(json['originalPrice']?.toString() ?? '') ??
        priceVal;
    final subPriceVal = double.tryParse(json['final_subscription_price']?.toString() ?? '') ??
        double.tryParse(json['finalSubscriptionPrice']?.toString() ?? '') ??
        double.tryParse(json['finalSubPrice']?.toString() ?? '') ??
        double.tryParse(json['special_price']?.toString() ?? '') ??
        double.tryParse(json['subscription_price']?.toString() ?? '') ??
        double.tryParse(json['subscriptionPrice']?.toString() ?? '');

    return ProductVariant(
      id: json['id']?.toString() ?? json['variant_id']?.toString() ?? '',
      label: json['label']?.toString() ?? json['variant_name']?.toString() ?? 'Standard',
      unitValue:
          json['unit_value']?.toString() ?? json['unitValue']?.toString(),
      unitType: json['unit_type']?.toString() ?? json['unitType']?.toString(),
      price: priceVal,
      originalPrice: origPriceVal,
      subscriptionPrice: subPriceVal,
      availableQuantity: double.tryParse(json['available_quantity']?.toString() ?? json['availableQuantity']?.toString() ?? ''),
      lowStockThreshold: double.tryParse(json['low_stock_threshold']?.toString() ?? json['lowStockThreshold']?.toString() ?? ''),
      isLowStock: json['is_low_stock'] == true || json['isLowStock'] == true,
      imagePath: imgPath,
      images: parsedImages,
    );
  }
}

// ══════════════════════════════════════════════════════════
//  PRODUCT MODEL
// ══════════════════════════════════════════════════════════

class Product {
  final String id, name, vendor, unit, category, emoji, badge;
  final String? unitValue;
  final String? unitType;
  final double price, originalPrice, rating;
  final double? subscriptionPrice;
  final int reviews;
  final bool isOrganic, isSubscribable, isOneTime, isOutOfStock, isLowStock;
  final String? description;
  final String? highlights;
  final String? ingredients;
  final String? legalInfo;
  final Color badgeColor;
  final List<ProductVariant> variants;
  final String? imageAsset;
  final List<String> images;
  const Product({
    required this.id,
    required this.name,
    required this.vendor,
    required this.unit,
    this.unitValue,
    this.unitType,
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
    this.isOutOfStock = false,
    this.isLowStock = false,
    this.description,
    this.highlights,
    this.ingredients,
    this.legalInfo,
    required this.badge,
    required this.badgeColor,
    this.variants = const [],
    this.imageAsset,
    this.images = const [],
  });

  String get formattedUnit {
    if (unitValue != null && unitType != null && unitValue!.toString().trim().isNotEmpty && unitType!.toString().trim().isNotEmpty) {
      final doubleVal = double.tryParse(unitValue!);
      final cleanVal = doubleVal != null
          ? (doubleVal == doubleVal.toInt() ? doubleVal.toInt().toString() : doubleVal.toString())
          : unitValue!;
      return '$cleanVal ${unitType!}'.trim();
    }
    if (unit.isNotEmpty) return unit;
    if (variants.isNotEmpty && variants.first.formattedUnit.isNotEmpty) {
      return variants.first.formattedUnit;
    }
    return '';
  }

  List<ProductVariant> get allVariants {
    if (variants.isNotEmpty) {
      final unique = <ProductVariant>[];
      for (final v in variants) {
        if (!unique.any((u) => u.id == v.id || (u.formattedUnit.isNotEmpty && u.formattedUnit.toLowerCase() == v.formattedUnit.toLowerCase()))) {
          unique.add(v);
        }
      }
      return unique;
    }
    // No real variants from DB — return single synthesized variant from product price
    return [
      ProductVariant(
        id: id,
        label: unit.isNotEmpty ? unit : 'Standard',
        unitValue: unitValue,
        unitType: unitType,
        price: price,
        originalPrice: originalPrice,
        subscriptionPrice: subscriptionPrice,
      ),
    ];
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'vendor': vendor,
      'unit': unit,
      'unit_value': unitValue,
      'unit_type': unitType,
      'category': category,
      'emoji': emoji,
      'badge': badge,
      'price': price,
      'originalPrice': originalPrice,
      'subscriptionPrice': subscriptionPrice,
      'rating': rating,
      'reviews': reviews,
      'isOrganic': isOrganic,
      'isSubscribable': isSubscribable,
      'isOneTime': isOneTime,
      'isOutOfStock': isOutOfStock,
      'isLowStock': isLowStock,
      'description': description,
      'highlights': highlights,
      'ingredients': ingredients,
      'legalInfo': legalInfo,
      'badgeColor': badgeColor.value,
      'variants': variants.map((v) => v.toJson()).toList(),
      'imageAsset': imageAsset,
      'images': images,
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final priceVal = double.tryParse(json['final_price']?.toString() ?? '') ??
        double.tryParse(json['finalPrice']?.toString() ?? '') ??
        double.tryParse(json['price']?.toString() ?? '') ??
        0.0;
    final origPriceVal = double.tryParse(json['original_price']?.toString() ?? '') ??
        double.tryParse(json['originalPrice']?.toString() ?? '') ??
        priceVal;
    final subPriceVal = double.tryParse(json['final_subscription_price']?.toString() ?? '') ??
        double.tryParse(json['finalSubscriptionPrice']?.toString() ?? '') ??
        double.tryParse(json['finalSubPrice']?.toString() ?? '') ??
        double.tryParse(json['special_price']?.toString() ?? '') ??
        double.tryParse(json['subscription_price']?.toString() ?? '') ??
        double.tryParse(json['subscriptionPrice']?.toString() ?? '');

    return Product(
      id: json['id']?.toString() ?? json['variant_id']?.toString() ?? json['product_id']?.toString() ?? '',
      name: json['name']?.toString() ?? json['product_name']?.toString() ?? json['variant_name']?.toString() ?? '',
      vendor: json['vendor']?.toString() ?? 'F2H',
      unit: json['unit']?.toString() ?? '',
      unitValue:
          json['unit_value']?.toString() ?? json['unitValue']?.toString(),
      unitType: json['unit_type']?.toString() ?? json['unitType']?.toString(),
      category: json['category']?.toString() ?? '',
      emoji: json['emoji']?.toString() ?? '',
      badge: json['badge']?.toString() ?? '',
      price: priceVal,
      originalPrice: origPriceVal,
      subscriptionPrice: subPriceVal,
      rating: double.tryParse(json['rating']?.toString() ?? '') ?? 0.0,
      reviews: int.tryParse(json['reviews']?.toString() ?? '') ?? 0,
      isOrganic: json['isOrganic'] == true || json['is_organic'] == true,
      isSubscribable: json['isSubscribable'] ?? json['is_subscribable'] ?? true,
      isOneTime: json['isOneTime'] ?? json['is_one_time'] ?? true,
      isOutOfStock: json['isOutOfStock'] == true || json['is_out_of_stock'] == true,
      isLowStock: json['isLowStock'] == true || json['is_low_stock'] == true,
      description: json['description']?.toString(),
      highlights: json['highlights']?.toString(),
      ingredients: json['ingredients']?.toString(),
      legalInfo: json['legalInfo']?.toString() ?? json['legal_info']?.toString(),
      badgeColor: json['badgeColor'] != null ? Color(json['badgeColor']) : kPrimaryMid,
      variants: json['variants'] != null
          ? (json['variants'] as List)
                .map((v) => ProductVariant.fromJson(v))
                .toList()
          : [],
      imageAsset: json['imageAsset']?.toString() ?? json['image_path']?.toString(),
      images: json['images'] != null
          ? List<String>.from(json['images'])
          : (json['imageAsset'] != null
                ? [json['imageAsset'] as String]
                : const []),
    );
  }
}

// ── Image helpers ────────────────────────────────────────

IconData getProductFallbackIcon(String name) {
  final n = name.toLowerCase();
  if (n.contains('milk')) {
    return Icons.water_drop_rounded;
  }
  if (n.contains('curd') || n.contains('yogurt')) {
    return Icons.soup_kitchen_rounded;
  }
  if (n.contains('kova') ||
      n.contains('sweets') ||
      n.contains('peda') ||
      n.contains('sweet')) {
    return Icons.cake_rounded;
  }
  if (n.contains('almond') ||
      n.contains('badam') ||
      n.contains('nut') ||
      n.contains('dry fruit')) {
    return Icons.grain_rounded;
  }
  if (n.contains('ghee')) {
    return Icons.opacity_rounded;
  }
  if (n.contains('butter') && !n.contains('milk')) {
    return Icons.breakfast_dining_rounded;
  }
  if (n.contains('paneer') || n.contains('cheese')) {
    return Icons.grid_view_rounded;
  }
  if (n.contains('chaas') || n.contains('buttermilk') || n.contains('drink')) {
    return Icons.local_cafe_rounded;
  }
  if (n.contains('oil')) {
    return Icons.water_drop_outlined;
  }
  if (n.contains('honey')) {
    return Icons.hive_rounded;
  }
  return Icons.shopping_bag_outlined;
}

(Color, Color) getFallbackColors(String name) {
  final n = name.toLowerCase();
  if (n.contains('milk')) {
    return (const Color(0xFFE8F5E9), const Color(0xFF1B5E20));
  }
  if (n.contains('curd') || n.contains('yogurt')) {
    return (const Color(0xFFE3F2FD), const Color(0xFF0D47A1));
  }
  if (n.contains('kova') ||
      n.contains('sweets') ||
      n.contains('peda') ||
      n.contains('sweet')) {
    return (const Color(0xFFF3E5F5), const Color(0xFF4A148C));
  }
  if (n.contains('almond') || n.contains('badam') || n.contains('nut')) {
    return (const Color(0xFFFFF3E0), const Color(0xFFE65100));
  }
  if (n.contains('ghee')) {
    return (const Color(0xFFFFFDE7), const Color(0xFFF57F17));
  }
  if (n.contains('butter')) {
    return (const Color(0xFFFFF8E1), const Color(0xFFFF6F00));
  }
  if (n.contains('paneer') || n.contains('cheese')) {
    return (const Color(0xFFE0F2F1), const Color(0xFF004D40));
  }
  if (n.contains('chaas') || n.contains('buttermilk')) {
    return (const Color(0xFFF1F8E9), const Color(0xFF33691E));
  }
  return (const Color(0xFFF5F5F5), const Color(0xFF16653A));
}

final Map<String, int> _failedUrlAttempts = {};
final Set<String> _failedImageUrls = {};

/// Renders the product image using the remote URL if available, falling back to an icon.
Widget buildProductImage(
  String name, {
  String? imageAsset,
  double? width,
  double? height,
  BoxFit fit = BoxFit.cover,
  Color? fallbackColor,
}) {
  String? asset = imageAsset;

  if (asset != null && asset.isNotEmpty) {
    if (asset.startsWith('assets/')) {
      final imageUrl = AppAssetService.getAssetUrl(asset);
      if (_failedImageUrls.contains(imageUrl)) {
        return _fallbackIconWidget(name, width, height, fallbackColor);
      }
      return CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        errorWidget: (context, url, error) {
          _failedImageUrls.add(url);
          return _fallbackIconWidget(name, width, height, fallbackColor);
        },
      );
    } else {
      String resolvedAsset = asset;
      // 1. Convert relative path (e.g. '/uploads/...' or 'uploads/...' or 'products/...' or 'categories/...') to absolute URL using the active baseUrl
      if (resolvedAsset.startsWith('/uploads/') ||
          resolvedAsset.startsWith('uploads/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(
          RegExp(r'/+$'),
          '',
        ); // strip trailing slash
        final cleanAsset = resolvedAsset.startsWith('/')
            ? resolvedAsset
            : '/$resolvedAsset';
        resolvedAsset = '$activeBase$cleanAsset';
      } else if (resolvedAsset.startsWith('products/') ||
          resolvedAsset.startsWith('categories/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(RegExp(r'/+$'), '');
        resolvedAsset = '$activeBase/uploads/$resolvedAsset';
      } else if (resolvedAsset.startsWith('/products/') ||
          resolvedAsset.startsWith('/categories/')) {
        final activeBase = ApiEndpoints.baseUrl.replaceAll(RegExp(r'/+$'), '');
        resolvedAsset = '$activeBase/uploads$resolvedAsset';
      }

      if (resolvedAsset.startsWith('http://') ||
          resolvedAsset.startsWith('https://')) {
        // 2. Normalize secure connection protocols for localhost/private IPs
        if (resolvedAsset.startsWith('https://192.168.') ||
            resolvedAsset.startsWith('https://localhost') ||
            resolvedAsset.startsWith('https://127.0.0.1') ||
            resolvedAsset.startsWith('https://10.0.2.2')) {
          resolvedAsset = resolvedAsset.replaceFirst('https://', 'http://');
        }

        // 3. Dynamically rewrite local development/private network IP address hosts to match the active baseUrl.
        try {
          final activeBase = ApiEndpoints.baseUrl;
          final uri = Uri.parse(resolvedAsset);
          if ((uri.host.startsWith('192.168.') ||
                  uri.host == 'localhost' ||
                  uri.host == '127.0.0.1' ||
                  uri.host == '10.0.2.2') &&
              !activeBase.contains(uri.host)) {
            final activeUri = Uri.parse(activeBase);
            resolvedAsset = uri
                .replace(
                  scheme: activeUri.scheme,
                  host: activeUri.host,
                  port: activeUri.port,
                )
                .toString();
          }
        } catch (_) {
          // Fallback if URL parsing fails
        }

        // Stop retrying / polling if image URL failed 3 times or is marked failed
        if ((_failedUrlAttempts[resolvedAsset] ?? 0) >= 3 || _failedImageUrls.contains(resolvedAsset)) {
          return _fallbackIconWidget(name, width, height, fallbackColor);
        }

        return CachedNetworkImage(
          imageUrl: resolvedAsset,
          width: width,
          height: height,
          fit: fit,
          placeholder: (context, url) =>
              _fallbackIconWidget(name, width, height, fallbackColor),
          errorWidget: (context, url, err) {
            final attempts = (_failedUrlAttempts[url] ?? 0) + 1;
            _failedUrlAttempts[url] = attempts;
            if (attempts >= 3) {
              _failedImageUrls.add(url);
            }
            return _fallbackIconWidget(name, width, height, fallbackColor);
          },
        );
      }
    }
  }

  return _fallbackIconWidget(name, width, height, fallbackColor);
}

Widget _fallbackIconWidget(
  String name,
  double? width,
  double? height,
  Color? fallbackColor,
) {
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

Product getProductById(
  String id, {
  String? name,
  String? variantName,
  double? price,
  double? subscriptionPrice,
  String? imageAsset,
  bool isSubscribable = true,
  bool isOneTime = true,
}) {
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
