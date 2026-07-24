import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/sync_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/get_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';

import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/core/session/customer_session_cache.dart';

class CartBloc extends Bloc<CartEvent, CartState> {
  final SyncCartUseCase syncCartUseCase;
  final GetCartUseCase getCartUseCase;
  List<CartItemEntity> _currentItems = [];
  List<CartItemEntity> get currentItems => _currentItems;

  CartBloc({
    required this.syncCartUseCase,
    required this.getCartUseCase,
  }) : super(CartInitialState()) {
    on<AddToCartEvent>(_onAddToCart);
    on<RemoveFromCartEvent>(_onRemoveFromCart);
    on<SyncCartEvent>(_onSyncCart);
    on<DeleteCartItemEvent>(_onDeleteCartItem);
    on<LoadCartEvent>(_onLoadCart);
    on<ClearCartEvent>(_onClearCart);
  }

  Future<void> _onAddToCart(AddToCartEvent event, Emitter<CartState> emit) async {
    if (state is! CartLoadedState) {
      emit(CartLoadingState());
    }
    try {
      final index = _currentItems.indexWhere((item) =>
          item.productId == event.item.productId &&
          item.variantId == event.item.variantId &&
          item.purchaseType == event.item.purchaseType);

      if (index >= 0) {
        final existing = _currentItems[index];
        if (event.item.purchaseType == 'onetime') {
          _currentItems[index] = existing.copyWith(
            quantity: (existing.quantity ?? 0) + (event.item.quantity ?? 1),
            deliveryDate: existing.deliveryDate ?? event.item.deliveryDate,
            deliverySlot: existing.deliverySlot ?? event.item.deliverySlot,
          );
        } else {
          _currentItems[index] = event.item.copyWith(
            imageAsset: existing.imageAsset ?? event.item.imageAsset,
          );
        }
      } else {
        // Find if it exists under a different purchase type to convert it
        int otherQty = 1;
        final otherIndex = _currentItems.indexWhere((item) =>
            item.productId == event.item.productId &&
            item.variantId == event.item.variantId);
        
        String? existingImageAsset = event.item.imageAsset;
        if (otherIndex >= 0) {
          final otherItem = _currentItems[otherIndex];
          existingImageAsset ??= otherItem.imageAsset;
          if (otherItem.purchaseType == 'subscription') {
            otherQty = (otherItem.schedules ?? []).fold(0, (sum, s) => sum + (s.mQuantity ?? 0) + (s.eQuantity ?? 0));
            if (otherQty <= 0) otherQty = 1;
          } else {
            otherQty = otherItem.quantity ?? 1;
          }
          _currentItems.removeWhere((item) =>
              item.productId == event.item.productId &&
              item.variantId == event.item.variantId);
        }

        if (event.item.purchaseType == 'onetime') {
          _currentItems.add(CartItemEntity(
            productId: event.item.productId,
            variantId: event.item.variantId,
            productName: event.item.productName,
            variantName: event.item.variantName,
            unitPrice: event.item.unitPrice,
            purchaseType: 'onetime',
            quantity: otherIndex >= 0 ? otherQty : (event.item.quantity ?? 1),
            deliveryDate: event.item.deliveryDate ?? DateTime.now().add(const Duration(days: 1)).toString().split(' ')[0],
            deliverySlot: event.item.deliverySlot ?? 'Morning',
            imageAsset: existingImageAsset,
            isSubscribable: event.item.isSubscribable,
            isOneTime: event.item.isOneTime,
            subscriptionPrice: event.item.subscriptionPrice,
          ));
        } else {
          final schedules = event.item.schedules ?? [
            SubscriptionSchedule(day: 0, mQuantity: 1, eQuantity: 0),
          ];
          _currentItems.add(CartItemEntity(
            productId: event.item.productId,
            variantId: event.item.variantId,
            productName: event.item.productName,
            variantName: event.item.variantName,
            unitPrice: event.item.unitPrice,
            purchaseType: 'subscription',
            schedules: schedules,
            imageAsset: existingImageAsset,
            isSubscribable: event.item.isSubscribable,
            isOneTime: event.item.isOneTime,
            subscriptionPrice: event.item.subscriptionPrice,
          ));
        }
      }

      _currentItems = _sanitizeCartItems(_currentItems);

      // --- OPTIMISTIC EMIT ---
      final currentCalcs1 = state is CartLoadedState ? (state as CartLoadedState).calculations : CartCalculationsEntity(subtotal: 0, deliveryFee: 0, taxes: 0, grandTotal: 0);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: currentCalcs1));

      final cachedSession = await CustomerSessionCache().read();
      final customerId = cachedSession?.profile?.customerId;
      print('=== [CartBloc] AddToCartEvent, retrieved customerId: $customerId');

      final calculations = await syncCartUseCase(_currentItems, customerId: customerId);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: calculations));
    } catch (e) {
      emit(CartErrorState(extractErrorMessage(e)));
    }
  }

  Future<void> _onRemoveFromCart(RemoveFromCartEvent event, Emitter<CartState> emit) async {
    if (state is! CartLoadedState) {
      emit(CartLoadingState());
    }
    try {
      final index = _currentItems.indexWhere((item) =>
          item.productId == event.item.productId &&
          item.variantId == event.item.variantId &&
          item.purchaseType == event.item.purchaseType);

      if (index >= 0) {
        final existing = _currentItems[index];
        if (existing.purchaseType == 'onetime' && (existing.quantity ?? 0) > 1) {
          _currentItems[index] = existing.copyWith(
            quantity: existing.quantity! - 1,
          );
        } else {
          final pId = existing.productId;
          final vId = existing.variantId;
          _currentItems.removeWhere((item) =>
              item.productId == pId &&
              item.variantId == vId);
        }
      }

      // --- OPTIMISTIC EMIT ---
      final currentCalcs2 = state is CartLoadedState ? (state as CartLoadedState).calculations : CartCalculationsEntity(subtotal: 0, deliveryFee: 0, taxes: 0, grandTotal: 0);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: currentCalcs2));

      final cachedSession = await CustomerSessionCache().read();
      final customerId = cachedSession?.profile?.customerId;
      print('=== [CartBloc] RemoveFromCartEvent, retrieved customerId: $customerId');

      final calculations = await syncCartUseCase(_currentItems, customerId: customerId);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: calculations));
    } catch (e) {
      emit(CartErrorState(extractErrorMessage(e)));
    }
  }

  Future<void> _onSyncCart(SyncCartEvent event, Emitter<CartState> emit) async {
    if (state is! CartLoadedState) {
      emit(CartLoadingState());
    }
    try {
      final newItems = List<CartItemEntity>.from(event.items).map((newItem) {
        final existingIndex = _currentItems.indexWhere((existing) =>
            existing.productId == newItem.productId &&
            existing.variantId == newItem.variantId);
        if (existingIndex >= 0) {
          return newItem.copyWith(
            imageAsset: _currentItems[existingIndex].imageAsset ?? newItem.imageAsset,
          );
        }
        return newItem;
      }).toList();
      _currentItems = _sanitizeCartItems(newItems);

      // --- OPTIMISTIC EMIT ---
      final currentCalcs3 = state is CartLoadedState ? (state as CartLoadedState).calculations : CartCalculationsEntity(subtotal: 0, deliveryFee: 0, taxes: 0, grandTotal: 0);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: currentCalcs3));

      final cachedSession = await CustomerSessionCache().read();
      final customerId = cachedSession?.profile?.customerId;
      print('=== [CartBloc] SyncCartEvent, retrieved customerId: $customerId');

      final calculations = await syncCartUseCase(_currentItems, customerId: customerId);
      emit(CartLoadedState(items: _currentItems, calculations: calculations));
    } catch (e) {
      emit(CartErrorState(extractErrorMessage(e)));
    }
  }

  Future<void> _onDeleteCartItem(DeleteCartItemEvent event, Emitter<CartState> emit) async {
    if (state is! CartLoadedState) {
      emit(CartLoadingState());
    }
    try {
      _currentItems.removeWhere((item) =>
          item.productId == event.item.productId &&
          item.variantId == event.item.variantId);

      // --- OPTIMISTIC EMIT ---
      final currentCalcs4 = state is CartLoadedState ? (state as CartLoadedState).calculations : CartCalculationsEntity(subtotal: 0, deliveryFee: 0, taxes: 0, grandTotal: 0);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: currentCalcs4));

      final cachedSession = await CustomerSessionCache().read();
      final customerId = cachedSession?.profile?.customerId;
      print('=== [CartBloc] DeleteCartItemEvent, retrieved customerId: $customerId');

      final calculations = await syncCartUseCase(_currentItems, customerId: customerId);
      emit(CartLoadedState(items: List.from(_currentItems), calculations: calculations));
    } catch (e) {
      emit(CartErrorState(extractErrorMessage(e)));
    }
  }

  Future<void> _onLoadCart(LoadCartEvent event, Emitter<CartState> emit) async {
    emit(CartLoadingState());
    try {
      final result = await getCartUseCase(event.userId);
      print('=== [CartBloc] LoadCartEvent success. Fetched ${result.items.length} items. Details:');
      for (var i = 0; i < result.items.length; i++) {
        final item = result.items[i];
        print('  - Item $i: productId=${item.productId}, variantId=${item.variantId}, name=${item.productName}, price=${item.unitPrice}, quantity=${item.quantity}, purchaseType=${item.purchaseType}');
      }
      _currentItems = _sanitizeCartItems(List.from(result.items));

      // Map backend cart items to CartController local caches
      final Map<String, int> localItems = {};
      final Map<String, Product> localProducts = {};
      final Map<String, bool> localSubs = {};

      for (final item in result.items) {
        final isSub = item.purchaseType == 'subscription';
        final key = '${item.variantId}_${isSub ? "sub" : "once"}';

        final qty = isSub
            ? (item.schedules?.fold<int>(0, (sum, s) => sum + s.mQuantity + s.eQuantity) ?? 1)
            : (item.quantity ?? 1);
        localItems[key] = qty == 0 ? 1 : qty;
        localSubs[key] = isSub;

        localProducts[key] = Product(
          id: item.variantId,
          name: item.productName,
          vendor: 'Farm to Home',
          unit: item.variantName,
          category: 'General',
          emoji: '📦',
          price: item.unitPrice,
          originalPrice: item.unitPrice,
          rating: 4.5,
          reviews: 10,
          isOrganic: false,
          isSubscribable: item.isSubscribable,
          isOneTime: item.isOneTime,
          badge: 'Fresh',
          badgeColor: const Color(0xFF1B4332),
          imageAsset: item.imageAsset,
        );
      }

      emit(CartLoadedState(items: _currentItems, calculations: result.calculations));
    } catch (e) {
      print('=== [CartBloc] Error loading cart from backend: $e');
      final errMsg = extractErrorMessage(e);
      if (errMsg.toLowerCase().contains('unauthorized') || errMsg.contains('401')) {
        emit(CartLoadedState(items: _currentItems));
      } else {
        emit(CartErrorState(errMsg));
      }
    }
  }

  List<CartItemEntity> _sanitizeCartItems(List<CartItemEntity> items) {
    final Map<String, CartItemEntity> unique = {};
    for (final item in items) {
      final key = '${item.productId}_${item.variantId}';
      if (!unique.containsKey(key)) {
        unique[key] = item;
      } else {
        final existing = unique[key]!;
        if (item.purchaseType == 'subscription' && existing.purchaseType == 'onetime') {
          unique[key] = item;
        }
      }
    }
    return unique.values.toList();
  }

  void _onClearCart(ClearCartEvent event, Emitter<CartState> emit) {
    _currentItems = [];
    emit(CartInitialState());
  }
}
