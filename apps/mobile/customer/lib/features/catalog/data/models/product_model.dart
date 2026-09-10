import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
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
  /// Whether THIS pack is sold out. Each sibling pill carries its own stock
  /// state — the parent card's flag describes a different variant entirely.
  final bool isOutOfStock;
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
    this.isOutOfStock = false,
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

  int get discountPercent {
    if (originalPrice > price && originalPrice > 0) {
      return (((originalPrice - price) / originalPrice) * 100).round();
    }
    return 0;
  }

  int get maxStock {
    if (isOutOfStock) return 0;
    if (availableQuantity != null && availableQuantity! >= 0) {
      return availableQuantity!.toInt();
    }
    return 999;
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
      'isOutOfStock': isOutOfStock,
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

    final vName = json['variant_name']?.toString() ?? json['variantName']?.toString();
    return ProductVariant(
      id: json['id']?.toString() ?? json['variant_id']?.toString() ?? '',
      label: (vName != null && vName.trim().isNotEmpty && vName.toLowerCase() != 'standard')
          ? vName.trim()
          : (json['label']?.toString() ?? json['variant_name']?.toString() ?? 'Standard'),
      unitValue:
          json['unit_value']?.toString() ?? json['unitValue']?.toString(),
      unitType: json['unit_type']?.toString() ?? json['unitType']?.toString(),
      price: priceVal,
      originalPrice: origPriceVal,
      subscriptionPrice: subPriceVal,
      availableQuantity: double.tryParse(json['available_quantity']?.toString() ?? json['availableQuantity']?.toString() ?? ''),
      lowStockThreshold: double.tryParse(json['low_stock_threshold']?.toString() ?? json['lowStockThreshold']?.toString() ?? ''),
      isLowStock: json['is_low_stock'] == true || json['isLowStock'] == true,
      isOutOfStock: json['is_out_of_stock'] == true || json['isOutOfStock'] == true,
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
  final String? variantName;
  final String? productName;
  final String? categoryId;
  final String? productId;
  final String? unitValue;
  final String? unitType;
  final double price, originalPrice, rating;
  final double? subscriptionPrice;
  final double? availableQuantity;
  final double? lowStockThreshold;
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
    this.variantName,
    this.productName,
    required this.vendor,
    required this.unit,
    this.unitValue,
    this.unitType,
    required this.category,
    this.categoryId,
    this.productId,
    required this.emoji,
    required this.price,
    required this.originalPrice,
    this.subscriptionPrice,
    this.availableQuantity,
    this.lowStockThreshold,
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

  Product copyWith({
    String? id,
    String? name,
    String? variantName,
    String? productName,
    String? vendor,
    String? unit,
    String? unitValue,
    String? unitType,
    String? category,
    String? categoryId,
    String? productId,
    String? emoji,
    double? price,
    double? originalPrice,
    double? subscriptionPrice,
    double? availableQuantity,
    double? lowStockThreshold,
    double? rating,
    int? reviews,
    bool? isOrganic,
    bool? isSubscribable,
    bool? isOneTime,
    bool? isOutOfStock,
    bool? isLowStock,
    String? description,
    String? highlights,
    String? ingredients,
    String? legalInfo,
    String? badge,
    Color? badgeColor,
    List<ProductVariant>? variants,
    String? imageAsset,
    List<String>? images,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      variantName: variantName ?? this.variantName,
      productName: productName ?? this.productName,
      vendor: vendor ?? this.vendor,
      unit: unit ?? this.unit,
      unitValue: unitValue ?? this.unitValue,
      unitType: unitType ?? this.unitType,
      category: category ?? this.category,
      categoryId: categoryId ?? this.categoryId,
      productId: productId ?? this.productId,
      emoji: emoji ?? this.emoji,
      price: price ?? this.price,
      originalPrice: originalPrice ?? this.originalPrice,
      subscriptionPrice: subscriptionPrice ?? this.subscriptionPrice,
      availableQuantity: availableQuantity ?? this.availableQuantity,
      lowStockThreshold: lowStockThreshold ?? this.lowStockThreshold,
      rating: rating ?? this.rating,
      reviews: reviews ?? this.reviews,
      isOrganic: isOrganic ?? this.isOrganic,
      isSubscribable: isSubscribable ?? this.isSubscribable,
      isOneTime: isOneTime ?? this.isOneTime,
      isOutOfStock: isOutOfStock ?? this.isOutOfStock,
      isLowStock: isLowStock ?? this.isLowStock,
      description: description ?? this.description,
      highlights: highlights ?? this.highlights,
      ingredients: ingredients ?? this.ingredients,
      legalInfo: legalInfo ?? this.legalInfo,
      badge: badge ?? this.badge,
      badgeColor: badgeColor ?? this.badgeColor,
      variants: variants ?? this.variants,
      imageAsset: imageAsset ?? this.imageAsset,
      images: images ?? this.images,
    );
  }

  /// Returns the variant name at all places
  String get displayName {
    if (variantName != null &&
        variantName!.trim().isNotEmpty &&
        variantName!.trim().toLowerCase() != 'standard') {
      return variantName!.trim();
    }
    if (variants.isNotEmpty) {
      final match = variants.where(
        (v) => v.id == id || (unit.isNotEmpty && v.label == unit),
      );
      if (match.isNotEmpty) {
        final v = match.first;
        if (v.label.trim().isNotEmpty &&
            v.label.trim().toLowerCase() != 'standard') {
          return v.label.trim();
        }
      }
    }
    final raw = name.trim();
    if (raw.isNotEmpty) return raw;
    if (productName != null && productName!.trim().isNotEmpty) {
      return productName!.trim();
    }
    return 'Product';
  }

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

  int get discountPercent {
    if (originalPrice > price && originalPrice > 0) {
      return (((originalPrice - price) / originalPrice) * 100).round();
    }
    return 0;
  }

  int get maxStock {
    if (isOutOfStock) return 0;
    if (availableQuantity != null && availableQuantity! >= 0) {
      return availableQuantity!.toInt();
    }
    if (variants.isNotEmpty) {
      final stocks = variants.map((v) => v.maxStock).toList();
      return stocks.isNotEmpty ? stocks.reduce((a, b) => a > b ? a : b) : 999;
    }
    return 999;
  }

  List<ProductVariant> get allVariants {
    if (variants.isNotEmpty) {
      final unique = <ProductVariant>[];
      for (final v in variants) {
        if (!unique.any((u) => u.id == v.id)) {
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
        availableQuantity: availableQuantity,
        lowStockThreshold: lowStockThreshold,
        // Carry the parent's stock state through: this synthesized variant IS
        // the product, so reporting it as in-stock would re-enable Add on a
        // sold-out product that simply has no variant rows.
        isLowStock: isLowStock,
        isOutOfStock: isOutOfStock,
      ),
    ];
  }

  bool get hasSubscription {
    if (isSubscribable) return true;
    if (subscriptionPrice != null && subscriptionPrice! > 0) return true;
    return allVariants.any((v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'variant_name': variantName,
      'product_name': productName,
      'vendor': vendor,
      'unit': unit,
      'unit_value': unitValue,
      'unit_type': unitType,
      'category': category,
      'category_id': categoryId,
      'product_id': productId,
      'emoji': emoji,
      'badge': badge,
      'price': price,
      'originalPrice': originalPrice,
      'subscriptionPrice': subscriptionPrice,
      'availableQuantity': availableQuantity,
      'lowStockThreshold': lowStockThreshold,
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

    final variantNameRaw = json['variant_name']?.toString() ?? json['variantName']?.toString();
    final nameRaw = json['name']?.toString();
    final productNameRaw = json['product_name']?.toString() ?? json['productName']?.toString();
    final resolvedName = (variantNameRaw != null &&
            variantNameRaw.trim().isNotEmpty &&
            variantNameRaw.trim().toLowerCase() != 'standard')
        ? variantNameRaw.trim()
        : ((nameRaw != null && nameRaw.trim().isNotEmpty)
            ? nameRaw.trim()
            : (productNameRaw ?? 'Product'));

    return Product(
      id: json['id']?.toString() ?? json['variant_id']?.toString() ?? json['product_id']?.toString() ?? '',
      name: resolvedName,
      variantName: variantNameRaw,
      productName: productNameRaw,
      vendor: json['vendor']?.toString() ?? 'F2H',
      unit: json['unit']?.toString() ?? '',
      unitValue:
          json['unit_value']?.toString() ?? json['unitValue']?.toString(),
      unitType: json['unit_type']?.toString() ?? json['unitType']?.toString(),
      category: json['category']?.toString() ?? json['category_name']?.toString() ?? '',
      categoryId: json['category_id']?.toString() ?? json['categoryId']?.toString(),
      productId: json['product_id']?.toString() ?? json['productId']?.toString(),
      emoji: json['emoji']?.toString() ?? '',
      badge: json['badge']?.toString() ?? '',
      price: priceVal,
      originalPrice: origPriceVal,
      subscriptionPrice: subPriceVal,
      availableQuantity: double.tryParse(json['available_quantity']?.toString() ?? json['availableQuantity']?.toString() ?? ''),
      lowStockThreshold: double.tryParse(json['low_stock_threshold']?.toString() ?? json['lowStockThreshold']?.toString() ?? ''),
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
    return Icons.opacity_rounded;
  }
  if (n.contains('honey')) {
    return Icons.hive_rounded;
  }
  if (n.contains('fruit') || n.contains('apple') || n.contains('veg')) {
    return Icons.eco_rounded;
  }
  return Icons.shopping_bag_rounded;
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

/// Renders the product image using the remote URL if available, falling back to an icon.
Widget buildProductImage(
  String name, {
  String? imageAsset,
  double? width,
  double? height,
  BoxFit fit = BoxFit.cover,
  Color? fallbackColor,
  bool transparentBg = false,
}) {
  String? asset = imageAsset;

  if (asset != null && asset.trim().isNotEmpty) {
    asset = asset.trim();
    if (asset.startsWith('assets/')) {
      final imageUrl = AppAssetService.getAssetUrl(asset);
      if (kIsWeb) {
        return Image.network(
          imageUrl,
          width: width,
          height: height,
          fit: fit,
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg);
          },
          errorBuilder: (context, error, stackTrace) =>
              _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
        );
      }
      return CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        placeholder: (context, url) =>
            _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
        errorWidget: (context, url, error) =>
            _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
      );
    } else {
      String resolvedAsset = asset;
      // 1. Convert relative path (e.g. '/uploads/...' or 'uploads/...' or 'products/...' or 'categories/...' or 'variants/...') to absolute URL using the active host
      final activeHost = ApiEndpoints.host.replaceAll(RegExp(r'/+$'), '');
      if (resolvedAsset.startsWith('/uploads/') || resolvedAsset.startsWith('uploads/')) {
        final cleanAsset = resolvedAsset.startsWith('/') ? resolvedAsset : '/$resolvedAsset';
        resolvedAsset = '$activeHost$cleanAsset';
      } else if (resolvedAsset.startsWith('products/') ||
          resolvedAsset.startsWith('categories/') ||
          resolvedAsset.startsWith('variants/')) {
        resolvedAsset = '$activeHost/uploads/$resolvedAsset';
      } else if (resolvedAsset.startsWith('/products/') ||
          resolvedAsset.startsWith('/categories/') ||
          resolvedAsset.startsWith('/variants/')) {
        resolvedAsset = '$activeHost/uploads$resolvedAsset';
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

        // 3. Dynamically rewrite local development/private network IP address hosts to match the active host.
        try {
          final uri = Uri.parse(resolvedAsset);
          if ((uri.host.startsWith('192.168.') ||
                  uri.host == 'localhost' ||
                  uri.host == '127.0.0.1' ||
                  uri.host == '10.0.2.2') &&
              !activeHost.contains(uri.host)) {
            final activeUri = Uri.parse(activeHost);
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

        if (kIsWeb) {
          return Image.network(
            resolvedAsset,
            width: width,
            height: height,
            fit: fit,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg);
            },
            errorBuilder: (context, error, stackTrace) =>
                _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
          );
        }

        return CachedNetworkImage(
          imageUrl: resolvedAsset,
          width: width,
          height: height,
          fit: fit,
          placeholder: (context, url) =>
              _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
          errorWidget: (context, url, err) =>
              _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg),
        );
      }
    }
  }

  return _fallbackIconWidget(name, width, height, fallbackColor, transparentBg: transparentBg);
}

Widget _fallbackIconWidget(
  String name,
  double? width,
  double? height,
  Color? fallbackColor, {
  bool transparentBg = false,
}) {
  final (bg, defaultIconColor) = getFallbackColors(name);
  return Container(
    width: width,
    height: height,
    color: transparentBg ? Colors.transparent : bg,
    child: Center(
      child: Icon(
        getProductFallbackIcon(name),
        color: fallbackColor ?? defaultIconColor,
        size: width != null ? (width * 0.45).clamp(16.0, 36.0) : 24,
      ),
    ),
  );
}

String formatUnitName(String raw) {
  if (raw.isEmpty) return '';
  final trimmed = raw.trim();

  // If snake_case like fresh_cow_milk_1ltr or 1_ltr or 500_ml
  if (trimmed.contains('_')) {
    final parts = trimmed.split('_');
    final last = parts.last.toLowerCase();
    final match = RegExp(r'^(\d+)\s*([a-z]+)?$').firstMatch(last);
    if (match != null) {
      final qty = match.group(1);
      final u = (match.group(2) ?? '').toLowerCase();
      final formattedU = u == 'ltr' || u == 'l' ? 'Ltr' : (u == 'ml' ? 'ml' : (u == 'kg' ? 'kg' : (u == 'g' ? 'g' : u.toUpperCase())));
      return formattedU.isNotEmpty ? '$qty $formattedU' : (qty ?? trimmed);
    }
  }

  // Handle 1ltr, 500ml, 250g, 1kg
  final match = RegExp(r'^(\d+)\s*([a-zA-Z]+)$').firstMatch(trimmed);
  if (match != null) {
    final qty = match.group(1);
    final u = match.group(2)!.toLowerCase();
    final formattedU = u == 'ltr' || u == 'l' ? 'Ltr' : (u == 'ml' ? 'ml' : (u == 'kg' ? 'kg' : (u == 'g' ? 'g' : u)));
    return '$qty $formattedU';
  }

  return trimmed;
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
  // Callers that can resolve the real catalog row should pass these; the
  // defaults only mean "unknown", and an unknown must never re-enable Add.
  bool isOutOfStock = false,
  bool isLowStock = false,
}) {
  final cleanUnit = variantName != null ? formatUnitName(variantName) : 'Unit';
  return Product(
    id: id,
    name: name?.replaceAll('_', ' ') ?? 'Product',
    vendor: 'Farm to Home',
    unit: cleanUnit,
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
    isOutOfStock: isOutOfStock,
    isLowStock: isLowStock,
    badge: 'Fresh',
    badgeColor: const Color(0xFF1B4332),
    imageAsset: imageAsset,
    variants: [],
  );
}
