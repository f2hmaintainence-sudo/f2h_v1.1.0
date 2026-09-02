import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:f2h_customer/features/catalog/data/datasources/catalog_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

class CatalogRepositoryImpl implements CatalogRepository {
  final CatalogRemoteDataSource remoteDataSource;
  CatalogRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<Product>> getProducts({String? branchId}) async {
    final prefs = await SharedPreferences.getInstance();

    // Cache key is branch-specific so each branch's stock is stored separately
    final cacheKey = branchId != null && branchId.isNotEmpty
        ? 'cached_products_v15_$branchId'
        : 'cached_products_v15';

    // 1. Try to load from cache
    try {
      // Bumped to v15: cached entries from v14 have no per-variant stock flag,
      // and decoding them would silently mark sold-out packs as available.
      final cachedData = prefs.getString(cacheKey);
      if (cachedData != null) {
        final List<dynamic> decoded = jsonDecode(cachedData);
        final cachedProducts = decoded
            .map((json) => Product.fromJson(json))
            .toList();

        if (cachedProducts.isNotEmpty) {
          // Trigger background refresh silently
          _refreshProductsSilently(prefs, branchId: branchId, cacheKey: cacheKey);
          return cachedProducts;
        }
      }
    } catch (e) {
      print('Error parsing local cached products: $e');
    }

    // 2. Fallback to remote if cache empty
    return await _fetchAndCacheProducts(prefs, branchId: branchId, cacheKey: cacheKey);
  }

  Future<void> _refreshProductsSilently(SharedPreferences prefs, {String? branchId, String? cacheKey}) async {
    try {
      await _fetchAndCacheProducts(prefs, branchId: branchId, cacheKey: cacheKey);
    } catch (_) {} // Ignore background fetch errors
  }

  Future<List<Product>> _fetchAndCacheProducts(SharedPreferences prefs, {String? branchId, String? cacheKey}) async {
    try {
      final rawList = await remoteDataSource.getProductVariants(branchId: branchId);
      final products = _mapRawProducts(rawList);

      if (products.isNotEmpty) {
        final key = cacheKey ?? 'cached_products_v15';
        final encoded = jsonEncode(products.map((p) => p.toJson()).toList());
        await prefs.setString(key, encoded);
      }

      return products;
    } catch (e) {
      print('Error parsing remote products: $e');
      return [];
    }
  }

  @override
  Future<List<Product>> getProductsByCategoryId(String categoryId, {String? branchId}) async {
    try {
      final rawList = await remoteDataSource.getProductsByCategoryId(
        categoryId,
        branchId: branchId,
      );
      return _mapRawProducts(rawList);
    } catch (e) {
      print('Error parsing category products: $e');
      return [];
    }
  }

  List<Product> _mapRawProducts(List<dynamic> rawList) {
    // 1. Group items by product_id to build sibling variants for each product
    final Map<String, List<dynamic>> groupedByProduct = {};
    for (final item in rawList) {
      final pid = item['product_id']?.toString() ?? item['variant_id']?.toString() ?? '';
      if (pid.isNotEmpty) {
        groupedByProduct.putIfAbsent(pid, () => []).add(item);
      }
    }

    // Map sibling variants for each product_id
    final Map<String, List<ProductVariant>> productVariantsMap = {};
    for (final entry in groupedByProduct.entries) {
      final pid = entry.key;
      final groupItems = entry.value;
      final vars = <ProductVariant>[];
      for (final item in groupItems) {
        final variantId = item['variant_id']?.toString() ?? '';
        if (variantId.isEmpty) continue;
        if (vars.any((v) => v.id == variantId)) continue; // Avoid duplicate variant chips
        final variantName = item['variant_name']?.toString() ?? '';
        final unitValue = item['unit_value']?.toString() ?? '';
        final unitType = item['unit_type']?.toString() ?? '';
        final price = double.tryParse(item['final_price']?.toString() ?? '') ??
            double.tryParse(item['finalPrice']?.toString() ?? '') ??
            double.tryParse(item['price']?.toString() ?? '') ??
            0.0;
        final origPrice = double.tryParse(item['original_price']?.toString() ?? '') ??
            double.tryParse(item['originalPrice']?.toString() ?? '') ??
            price;
        final pNameLower = (item['product_name']?.toString() ?? '').toLowerCase();
        final vNameLower = variantName.toLowerCase();
        final isCurdOrNonSub = pNameLower.contains('curd') || vNameLower.contains('curd') || pNameLower.contains('paneer') || vNameLower.contains('paneer');
        final rawSubPrice = double.tryParse(item['final_subscription_price']?.toString() ?? '') ??
            double.tryParse(item['finalSubscriptionPrice']?.toString() ?? '') ??
            double.tryParse(item['finalSubPrice']?.toString() ?? '') ??
            double.tryParse(item['special_price']?.toString() ?? '') ??
            double.tryParse(item['subscription_price']?.toString() ?? '') ??
            double.tryParse(item['subscriptionPrice']?.toString() ?? '');
        final subscriptionPrice = isCurdOrNonSub ? null : rawSubPrice;

        final availQty = item['available_quantity'] != null ? double.tryParse(item['available_quantity'].toString()) : null;
        final lowThreshold = item['low_stock_threshold'] != null ? double.tryParse(item['low_stock_threshold'].toString()) : 10.0;

        final isVariantOutOfStock = _readBool(item['is_out_of_stock'], fallback: false);
        bool isVariantLowStock = false;
        if (!isVariantOutOfStock) {
          if (_readBool(item['is_low_stock'], fallback: false) ||
              (availQty != null && lowThreshold != null && availQty < lowThreshold && availQty > 0)) {
            isVariantLowStock = true;
          }
        }
        final variantImagePath = item['image_path']?.toString();
        final rawVarImgs = item['images'] ?? item['variant_images'];
        List<String> parsedVarImgs = [];
        if (rawVarImgs is List) {
          parsedVarImgs = rawVarImgs.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
        }
        if (parsedVarImgs.isEmpty && variantImagePath != null && variantImagePath.isNotEmpty) {
          parsedVarImgs = [variantImagePath];
        }

        vars.add(ProductVariant(
          id: variantId,
          label: variantName.trim().isNotEmpty ? variantName.trim() : 'Standard',
          unitValue: unitValue.isNotEmpty ? unitValue : null,
          unitType: unitType.isNotEmpty ? unitType : null,
          price: price,
          originalPrice: origPrice,
          subscriptionPrice: subscriptionPrice,
          availableQuantity: availQty,
          lowStockThreshold: lowThreshold,
          isLowStock: isVariantLowStock,
          isOutOfStock: isVariantOutOfStock,
          imagePath: variantImagePath,
          images: parsedVarImgs,
        ));
      }
      productVariantsMap[pid] = vars;
    }

    // 2. Map EACH active raw variant item directly to a Product object (representing a Variant)
    final products = <Product>[];
    for (final item in rawList) {
      final variantId = item['variant_id']?.toString() ?? '';
      if (variantId.isEmpty) continue; // Skip items with no variant_id
      if (products.any((p) => p.id == variantId)) continue; // Avoid duplicate product cards

      final productId = item['product_id']?.toString() ?? variantId;
      final rawProdName = item['product_name']?.toString()?.trim() ?? '';
      final rawVarName = item['variant_name']?.toString()?.trim() ?? '';
      final variantName = rawProdName.isNotEmpty
          ? rawProdName
          : (rawVarName.isNotEmpty ? rawVarName : 'Variant');
      final unitValue = item['unit_value']?.toString() ?? '';
      final unitType = item['unit_type']?.toString() ?? '';

      final sku = item['sku']?.toString() ?? 'SKU';
      final category = item['category']?.toString() ?? '';
      final emoji = item['emoji']?.toString() ?? '';
      final badge = item['badge']?.toString() ?? '';
      final vendor = sku.contains('_') ? sku.split('_')[0] : (item['vendor']?.toString() ?? 'F2H');
      final rating = double.tryParse(item['rating']?.toString() ?? '') ?? 0.0;
      final reviews = int.tryParse(item['reviews']?.toString() ?? '') ?? 0;
      final isOrganic = _readBool(item['is_organic'], fallback: false);
      final pNameLower = (item['product_name']?.toString() ?? '').toLowerCase();
      final vNameLower = variantName.toLowerCase();
      final catLower = category.toLowerCase();
      final isCurdOrNonSub = pNameLower.contains('curd') || vNameLower.contains('curd') || catLower.contains('curd') || pNameLower.contains('paneer') || vNameLower.contains('paneer');

      final rawIsSub = _readBool(item['is_subscribable'], fallback: false);
      final isSubscribable = !isCurdOrNonSub && (rawIsSub || (item['subscription_price'] != null && item['is_subscribable'] != false));

      final description = item['description']?.toString();
      final highlights = item['highlights']?.toString();
      final ingredients = item['ingredients']?.toString();
      final legalInfo = item['legal_info']?.toString();

      final isProductOutOfStock = _readBool(item['is_out_of_stock'], fallback: false);
      final imageAsset = item['image_path']?.toString();
      final rawProdImgs = item['images'] ?? item['variant_images'];
      List<String> parsedProdImgs = [];
      if (rawProdImgs is List) {
        parsedProdImgs = rawProdImgs.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
      }
      if (parsedProdImgs.isEmpty && imageAsset != null && imageAsset.isNotEmpty) {
        parsedProdImgs = [imageAsset];
      }

      final price = double.tryParse(item['final_price']?.toString() ?? '') ??
          double.tryParse(item['finalPrice']?.toString() ?? '') ??
          double.tryParse(item['price']?.toString() ?? '') ??
          0.0;
      final rawSubPrice = double.tryParse(item['final_subscription_price']?.toString() ?? '') ??
          double.tryParse(item['finalSubscriptionPrice']?.toString() ?? '') ??
          double.tryParse(item['finalSubPrice']?.toString() ?? '') ??
          double.tryParse(item['special_price']?.toString() ?? '') ??
          double.tryParse(item['subscription_price']?.toString() ?? '') ??
          double.tryParse(item['subscriptionPrice']?.toString() ?? '');
      final subscriptionPrice = isSubscribable ? rawSubPrice : null;
      final originalPrice = double.tryParse(item['original_price']?.toString() ?? '') ??
          double.tryParse(item['originalPrice']?.toString() ?? '') ??
          price;

      final siblingVariants = productVariantsMap[productId] ?? [];

      products.add(Product(
        id: variantId, // Product card represents THIS variant!
        name: variantName.trim(), // Variant Name ONLY
        vendor: vendor,
        unit: '',
        unitValue: unitValue.isNotEmpty ? unitValue : null,
        unitType: unitType.isNotEmpty ? unitType : null,
        category: category,
        emoji: emoji,
        price: price,
        originalPrice: originalPrice,
        subscriptionPrice: subscriptionPrice,
        rating: rating,
        reviews: reviews,
        isOrganic: isOrganic,
        isSubscribable: isSubscribable,
        isOneTime: _readBool(item['is_one_time'], fallback: true),
        isOutOfStock: isProductOutOfStock,
        isLowStock: _readBool(item['is_low_stock'], fallback: false),
        description: description,
        highlights: highlights,
        ingredients: ingredients,
        legalInfo: legalInfo,
        badge: badge,
        badgeColor: kPrimaryMid,
        imageAsset: imageAsset,
        images: parsedProdImgs,
        variants: siblingVariants,
      ));
    }

    return products;
  }

  bool _readBool(dynamic value, {required bool fallback}) {
    if (value == null) return fallback;
    if (value is bool) return value;
    final text = value.toString().toLowerCase();
    if (text == 'true' || text == '1') return true;
    if (text == 'false' || text == '0') return false;
    return fallback;
  }

  @override
  Future<List<Map<String, dynamic>>> getCategories() async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Try to load from cache
    try {
      final cachedData = prefs.getString('cached_categories_v2');
      if (cachedData != null) {
        final List<dynamic> decoded = jsonDecode(cachedData);
        final cachedCategories = decoded
            .map((item) => item as Map<String, dynamic>)
            .toList();

        if (cachedCategories.isNotEmpty) {
          // Trigger background refresh silently
          _refreshCategoriesSilently(prefs);
          return cachedCategories;
        }
      }
    } catch (e) {
      print('Error parsing local cached categories: $e');
    }

    // 2. Fallback to remote if cache empty
    return await _fetchAndCacheCategories(prefs);
  }

  Future<void> _refreshCategoriesSilently(SharedPreferences prefs) async {
    try {
      await _fetchAndCacheCategories(prefs);
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> _fetchAndCacheCategories(
    SharedPreferences prefs,
  ) async {
    try {
      final rawList = await remoteDataSource.getCategories();
      final categories = rawList
          .map((item) => item as Map<String, dynamic>)
          .toList();

      if (categories.isNotEmpty) {
        await prefs.setString('cached_categories_v2', jsonEncode(categories));
      }

      return categories;
    } catch (e) {
      print('Error parsing remote categories: $e');
      return [];
    }
  }

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  @override
  Future<List<Map<String, dynamic>>> getProductReviews(String productId) async {
    try {
      final raw = await remoteDataSource.getProductReviews(productId);
      return raw.map((r) => Map<String, dynamic>.from(r as Map)).toList();
    } catch (e) {
      print('Error fetching product reviews in repository: $e');
      return [];
    }
  }
}
