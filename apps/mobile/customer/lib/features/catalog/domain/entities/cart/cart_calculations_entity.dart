class CartCalculationsEntity {
  final double subtotal;
  final double deliveryFee;
  final double taxes;
  final double grandTotal;

  const CartCalculationsEntity({
    required this.subtotal,
    required this.deliveryFee,
    required this.taxes,
    required this.grandTotal,
  });
}
