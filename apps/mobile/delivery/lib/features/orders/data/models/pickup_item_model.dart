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

class PickupItem {
  final String id;
  final String dispatchId;
  final String productVariantId;
  final String productName;
  final double quantity;
  final String unit;
  final double unitValue;
  final bool isReturnable;
  final double loadedQty;

  PickupItem({
    required this.id,
    required this.dispatchId,
    required this.productVariantId,
    required this.productName,
    required this.quantity,
    required this.unit,
    required this.unitValue,
    required this.isReturnable,
    required this.loadedQty,
  });

  factory PickupItem.fromJson(Map<String, dynamic> json) {
    return PickupItem(
      id: json['id']?.toString() ?? '',
      dispatchId: json['dispatch_id']?.toString() ?? '',
      productVariantId: json['product_variant_id']?.toString() ?? '',
      productName: json['product_name'] ?? 'Unknown Product',
      quantity: _toDouble(json['quantity']),
      unit: json['unit'] ?? 'PCS',
      unitValue: _toDouble(json['unit_value'], 1.0),
      isReturnable: json['is_returnable'] ?? false,
      loadedQty: _toDouble(json['loaded_qty']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_variant_id': productVariantId,
      'confirmed_qty': quantity,
    };
  }
}

class PickupResponse {
  final bool status;
  final String deliveryPartnerId;
  final String deliveryPartnerName;
  final String date;
  final String? runId;
  final String? runStatus;
  final String? slot;
  final bool pickupConfirmed;
  final List<PickupItem> items;
  final List<BaggingInstructionStop> baggingInstructions;
  final String? message;

  PickupResponse({
    required this.status,
    required this.deliveryPartnerId,
    required this.deliveryPartnerName,
    required this.date,
    this.runId,
    this.runStatus,
    this.slot,
    required this.pickupConfirmed,
    required this.items,
    required this.baggingInstructions,
    this.message,
  });


  factory PickupResponse.fromJson(Map<String, dynamic> json) {
    // Some backends wrap the real payload under a 'data' key
    final Map<String, dynamic> payload =
        (json['data'] is Map<String, dynamic>) ? json['data'] as Map<String, dynamic> : json;

    // delivery_partner may be null or absent
    final dynamic deliveryPartnerRaw = payload['delivery_partner'];
    final Map<String, dynamic> deliveryPartner =
        (deliveryPartnerRaw is Map<String, dynamic>) ? deliveryPartnerRaw : {};

    // items may be a List or absent
    final dynamic itemsRaw = payload['items'];
    final List<dynamic> itemsList = (itemsRaw is List) ? itemsRaw : [];

    // bagging_instructions may be absent
    final dynamic baggingRaw = payload['bagging_instructions'];
    final List<dynamic> baggingList = (baggingRaw is List) ? baggingRaw : [];

    print('[PickupResponse] status=${payload['status']}  runId=${payload['run_id']}  items=${itemsList.length}  pickupConfirmed=${payload['pickup_confirmed']}');

    return PickupResponse(
      status: payload['status'] == true || payload['status'] == 1,
      deliveryPartnerId: deliveryPartner['id']?.toString() ?? '',
      deliveryPartnerName: deliveryPartner['name']?.toString() ?? '',
      date: payload['date']?.toString() ?? '',
      runId: payload['run_id']?.toString(),
      runStatus: payload['run_status']?.toString(),
      slot: payload['slot']?.toString(),
      pickupConfirmed: payload['pickup_confirmed'] == true || payload['pickup_confirmed'] == 1,
      items: itemsList
          .whereType<Map>()
          .map((item) => PickupItem.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      baggingInstructions: baggingList
          .whereType<Map>()
          .map((stop) => BaggingInstructionStop.fromJson(Map<String, dynamic>.from(stop)))
          .toList(),
      message: payload['message']?.toString(),
    );
  }
}

class BaggingInstructionStop {
  final int sequenceNo;
  final String customerName;
  final String address;
  final List<BaggingInstructionItem> items;

  BaggingInstructionStop({
    required this.sequenceNo,
    required this.customerName,
    required this.address,
    required this.items,
  });

  factory BaggingInstructionStop.fromJson(Map<String, dynamic> json) {
    final itemsList = json['items'] as List? ?? [];
    return BaggingInstructionStop(
      sequenceNo: _toInt(json['sequence_no']),
      customerName: json['customer_name']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      items: itemsList.map((item) => BaggingInstructionItem.fromJson(item)).toList(),
    );
  }
}

class BaggingInstructionItem {
  final String productName;
  final double quantity;
  final String unit;

  BaggingInstructionItem({
    required this.productName,
    required this.quantity,
    required this.unit,
  });

  factory BaggingInstructionItem.fromJson(Map<String, dynamic> json) {
    return BaggingInstructionItem(
      productName: json['product_name']?.toString() ?? '',
      quantity: _toDouble(json['quantity']),
      unit: json['unit']?.toString() ?? '',
    );
  }
}
