import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/utils/extensions.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:f2h_customer/features/catalog/data/datasources/catalog_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

class CatalogRepositoryImpl implements CatalogRepository {
  final CatalogRemoteDataSource remoteDataSource;
  CatalogRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<Product>> getProducts() async {
    final prefs = await SharedPreferences.getInstance();
    
    // 1. Try to load from cache
    try {
      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Bumped cache key to cached_products_v4 to force reload product list containing new subscriptionPrice field
      final cachedData = prefs.getString('cached_products_v4');
      if (cachedData != null) {
        final List<dynamic> decoded = jsonDecode(cachedData);
        final cachedProducts = decoded.map((json) => Product.fromJson(json)).toList();
        
        if (cachedProducts.isNotEmpty) {
          // Trigger background refresh silently
          _refreshProductsSilently(prefs);
          return cachedProducts;
        }
      }
    } catch (e) {
      print('Error parsing local cached products: $e');
    }

    // 2. Fallback to remote if cache empty
    return await _fetchAndCacheProducts(prefs);
  }

  Future<void> _refreshProductsSilently(SharedPreferences prefs) async {
    try {
      await _fetchAndCacheProducts(prefs);
    } catch (_) {} // Ignore background fetch errors
  }

  Future<List<Product>> _fetchAndCacheProducts(SharedPreferences prefs) async {
    try {
      final rawList = await remoteDataSource.getProductVariants();
      final products = _mapRawProducts(rawList);
      
      if (products.isNotEmpty) {
        final encoded = jsonEncode(products.map((p) => p.toJson()).toList());
        // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
        await prefs.setString('cached_products_v4', encoded);
      }
      
      return products;
    } catch (e) {
      print('Error parsing remote products: $e');
      return [];
    }
  }

  @override
  Future<List<Product>> getProductsByCategoryId(String categoryId) async {
    try {
      final rawList = await remoteDataSource.getProductsByCategoryId(categoryId);
      return _mapRawProducts(rawList);
    } catch (e) {
      print('Error parsing category products: $e');
      return [];
    }
  }

  List<Product> _mapRawProducts(List<dynamic> rawList) {
    // Group items by product_name to consolidate variants
    final Map<String, List<dynamic>> grouped = {};
    for (final item in rawList) {
      final productName = item['product_name']?.toString() ?? 'Product';
      grouped.putIfAbsent(productName, () => []).add(item);
    }

    final products = <Product>[];

    for (final entry in grouped.entries) {
      final productName = entry.key;
      final groupItems = entry.value;

      final baseItem = groupItems.first;
      final sku = baseItem['sku']?.toString() ?? 'SKU';
      final category = baseItem['category']?.toString() ?? '';
      final emoji = baseItem['emoji']?.toString() ?? '';
      final badge = baseItem['badge']?.toString() ?? '';
      final vendor = sku.contains('_') ? sku.split('_')[0] : (baseItem['vendor']?.toString() ?? 'F2H');
      final rating = double.tryParse(baseItem['rating']?.toString() ?? '') ?? 0.0;
      final reviews = int.tryParse(baseItem['reviews']?.toString() ?? '') ?? 0;
      final isOrganic = _readBool(baseItem['is_organic'], fallback: false);
      final isSubscribable = _readBool(baseItem['is_subscribable'], fallback: true);
      
      final description = baseItem['description']?.toString();
      final highlights = baseItem['highlights']?.toString();
      final ingredients = baseItem['ingredients']?.toString();
      final legalInfo = baseItem['legal_info']?.toString();

      final isProductOutOfStock = _readBool(baseItem['is_out_of_stock'], fallback: false);

      final imageAsset = baseItem['image_path']?.toString();

      final imagesList = groupItems
          .map((item) => item['image_path']?.toString())
          .where((path) => path != null && path.isNotEmpty)
          .cast<String>()
          .toSet()
          .toList();

      if (imageAsset != null && imageAsset.isNotEmpty && !imagesList.contains(imageAsset)) {
        imagesList.insert(0, imageAsset);
      }

      if (productName.toLowerCase().contains('milk')) {
        const backsideImg = 'uploads/products/milk_back.png';
        if (!imagesList.contains(backsideImg)) {
          imagesList.add(backsideImg);
        }
      }

      bool productHasLowStock = isProductOutOfStock;

      final variants = <ProductVariant>[];
      for (final item in groupItems) {
        final variantId = item['variant_id']?.toString() ?? '';
        final variantName = item['variant_name']?.toString() ?? '';
        
        final unitValue = item['unit_value']?.toString() ?? '';
        final unitType = item['unit_type']?.toString() ?? '';
        
        final doubleVal = double.tryParse(unitValue);
        final cleanUnitValue = doubleVal != null
            ? (doubleVal == doubleVal.toInt() ? doubleVal.toInt().toString() : doubleVal.toString())
            : unitValue;
        String unitLabel = '';
        if (cleanUnitValue.isNotEmpty) {
          if (unitType.toLowerCase() == 'ml' && doubleVal == 1000.0) {
            unitLabel = '1 Ltr';
          } else {
            unitLabel = '$cleanUnitValue ${unitType.trim()}'.trim();
          }
        }

        String label = variantName.trim();
        if (label.isEmpty || 
            label.toLowerCase() == 'standard' || 
            label.toLowerCase() == productName.toLowerCase() ||
            label.toLowerCase() == 'cow milk' ||
            label.toLowerCase() == 'milk') {
          label = unitLabel.isNotEmpty ? unitLabel : 'Standard';
        } else {
          final hasDigits = RegExp(r'\d').hasMatch(label);
          if (!hasDigits && unitLabel.isNotEmpty) {
            label = unitLabel;
          }
        }
            
        final price = double.tryParse(item['price']?.toString() ?? '') ?? 0.0;
        final subscriptionPrice = double.tryParse(item['subscription_price']?.toString() ?? '');
        final originalPrice = double.tryParse(item['original_price']?.toString() ?? '') ?? price;

        final availQty = item['available_quantity'] != null ? double.tryParse(item['available_quantity'].toString()) : null;
        final lowThreshold = item['low_stock_threshold'] != null ? double.tryParse(item['low_stock_threshold'].toString()) : 10.0;

        bool isVariantLowStock = false;
        if (isProductOutOfStock) {
          if (_readBool(item['is_low_stock'], fallback: false) ||
              availQty == null ||
              lowThreshold == null ||
              availQty < lowThreshold ||
              availQty <= 0) {
            isVariantLowStock = true;
          }
        }

        if (isVariantLowStock) {
          productHasLowStock = true;
        }
            
        variants.add(ProductVariant(
          id: variantId,
          label: label,
          price: price,
          originalPrice: originalPrice,
          subscriptionPrice: subscriptionPrice,
          availableQuantity: availQty,
          lowStockThreshold: lowThreshold,
          isLowStock: isVariantLowStock,
        ));
      }

      final rawIsOneTime = _readBool(baseItem['is_one_time'], fallback: true);
      final finalIsOneTime = productHasLowStock ? false : rawIsOneTime;

      // Base properties use the first variant's details
      final defaultVariant = variants.first;
      final defaultItem = groupItems.first;
      final productId = defaultItem['product_id']?.toString() ?? defaultItem['variant_id']?.toString() ?? productName;

      products.add(Product(
        id: productId, // Set to product_id or variant_id of the first item
        name: productName.toTitleCase(), // Use the base product name
        vendor: vendor,
        unit: defaultVariant.label,
        category: category,
        emoji: emoji,
        price: defaultVariant.price,
        originalPrice: defaultVariant.originalPrice,
        subscriptionPrice: defaultVariant.subscriptionPrice,
        rating: rating,
        reviews: reviews,
        isOrganic: isOrganic,
        isSubscribable: isSubscribable,
        isOneTime: finalIsOneTime,
        isOutOfStock: isProductOutOfStock,
        isLowStock: productHasLowStock,
        description: description,
        highlights: highlights,
        ingredients: ingredients,
        legalInfo: legalInfo,
        badge: badge,
        badgeColor: kPrimaryMid,
        imageAsset: imageAsset,
        images: imagesList,
        variants: variants, // Supply all variants so variant ID is preserved
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
      final cachedData = prefs.getString('cached_categories');
      if (cachedData != null) {
        final List<dynamic> decoded = jsonDecode(cachedData);
        final cachedCategories = decoded.map((item) => item as Map<String, dynamic>).toList();
        
        if (cachedCategories.isNotEmpty) {
          // Trigger background refresh silently
          _refreshCategoriesSilently(prefs);
          return cachedCategories;
        }
      };
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

  Future<List<Map<String, dynamic>>> _fetchAndCacheCategories(SharedPreferences prefs) async {
    try {
      final rawList = await remoteDataSource.getCategories();
      final categories = rawList.map((item) => item as Map<String, dynamic>).toList();
      
      if (categories.isNotEmpty) {
        await prefs.setString('cached_categories', jsonEncode(categories));
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
