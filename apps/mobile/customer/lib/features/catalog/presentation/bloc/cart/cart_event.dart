import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';

abstract class CartEvent {}

// Triggered when adding or incrementing an item in the cart
class AddToCartEvent extends CartEvent {
  final CartItemEntity item;
  AddToCartEvent(this.item);
}

// Triggered when decrementing or removing an item from the cart
class RemoveFromCartEvent extends CartEvent {
  final CartItemEntity item;
  RemoveFromCartEvent(this.item);
}

// Triggered to sync the entire list at once (like on app launch)
class SyncCartEvent extends CartEvent {
  final List<CartItemEntity> items;
  SyncCartEvent(this.items);
}

// Triggered when deleting an item completely from the cart
class DeleteCartItemEvent extends CartEvent {
  final CartItemEntity item;
  DeleteCartItemEvent(this.item);
}

// Triggered to load the cart from the backend on app boot or login
class LoadCartEvent extends CartEvent {
  final String userId;
  LoadCartEvent(this.userId);
}

// Triggered when the user logs out to clear local cart state
class ClearCartEvent extends CartEvent {}
