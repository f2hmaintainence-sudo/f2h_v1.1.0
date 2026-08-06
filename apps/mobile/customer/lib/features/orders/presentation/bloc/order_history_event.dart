import 'package:equatable/equatable.dart';

abstract class OrderHistoryEvent extends Equatable {
  const OrderHistoryEvent();
  @override
  List<Object?> get props => [];
}

class LoadOrderHistory extends OrderHistoryEvent {}

class CancelOrderRequested extends OrderHistoryEvent {
  final String orderId;
  const CancelOrderRequested({required this.orderId});
  @override
  List<Object?> get props => [orderId];
}

class RateOrderRequested extends OrderHistoryEvent {
  final String orderId;
  final String? productId; // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  final int rating;
  final String feedback;
  const RateOrderRequested({
    required this.orderId,
    this.productId,
    required this.rating,
    required this.feedback,
  });
  @override
  List<Object?> get props => [orderId, productId, rating, feedback];
}
