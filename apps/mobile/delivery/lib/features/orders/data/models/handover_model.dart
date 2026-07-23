double _toDouble(dynamic value, [double defaultValue = 0.0]) {
  if (value == null) return defaultValue;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? defaultValue;
  return defaultValue;
}

int _toInt(dynamic value, [int defaultValue = 0]) {
  if (value == null) return defaultValue;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? defaultValue;
  return defaultValue;
}

class HandoverResult {
  final bool success;
  final String message;
  final String status;
  final int emptyBottlesReturned;
  final List<HandoverItem> returnedItems;

  HandoverResult({
    required this.success,
    required this.message,
    required this.status,
    required this.emptyBottlesReturned,
    required this.returnedItems,
  });

  factory HandoverResult.fromJson(Map<String, dynamic> json) {
    final returnedList = json['returned_items'] as List? ?? [];
    return HandoverResult(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      status: json['status'] ?? '',
      emptyBottlesReturned: _toInt(json['empty_bottles_returned']),
      returnedItems: returnedList.map((item) => HandoverItem.fromJson(item)).toList(),
    );
  }
}

class HandoverItem {
  final String productVariantId;
  final String productName;
  final double quantity;
  final String unit;

  HandoverItem({
    required this.productVariantId,
    required this.productName,
    required this.quantity,
    required this.unit,
  });

  factory HandoverItem.fromJson(Map<String, dynamic> json) {
    return HandoverItem(
      productVariantId: json['product_variant_id']?.toString() ?? '',
      productName: json['product_name']?.toString() ?? '',
      quantity: _toDouble(json['quantity']),
      unit: json['unit']?.toString() ?? '',
    );
  }
}
