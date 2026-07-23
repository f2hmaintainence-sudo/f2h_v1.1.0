class ContainerBalanceModel {
  final int id;
  final String customerId;
  final String packagingTypeId;
  final int issuedQuantity;
  final int returnedQuantity;
  final int damagedQuantity;
  final int lostQuantity;
  final int balanceQuantity;
  final DateTime? updatedAt;
  final String packageName;
  final double packageCapacity;
  final String packageUnit;

  ContainerBalanceModel({
    required this.id,
    required this.customerId,
    required this.packagingTypeId,
    required this.issuedQuantity,
    required this.returnedQuantity,
    required this.damagedQuantity,
    required this.lostQuantity,
    required this.balanceQuantity,
    this.updatedAt,
    required this.packageName,
    required this.packageCapacity,
    required this.packageUnit,
  });

  factory ContainerBalanceModel.fromJson(Map<String, dynamic> json) {
    return ContainerBalanceModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      customerId: json['customer_id']?.toString() ?? '',
      packagingTypeId: json['packaging_type_id']?.toString() ?? '',
      issuedQuantity: int.tryParse(json['issued_quantity'].toString()) ?? 0,
      returnedQuantity: int.tryParse(json['returned_quantity'].toString()) ?? 0,
      damagedQuantity: int.tryParse(json['damaged_quantity'].toString()) ?? 0,
      lostQuantity: int.tryParse(json['lost_quantity'].toString()) ?? 0,
      balanceQuantity: int.tryParse(json['balance_quantity'].toString()) ?? 0,
      updatedAt: json['updated_at'] != null ? DateTime.tryParse(json['updated_at'].toString()) : null,
      packageName: json['package_name']?.toString() ?? 'Container',
      packageCapacity: double.tryParse(json['package_capacity']?.toString() ?? '0') ?? 0.0,
      packageUnit: json['package_unit']?.toString() ?? '',
    );
  }
}

class ContainerTransactionModel {
  final int id;
  final String customerId;
  final String packagingTypeId;
  final String referenceType;
  final String? referenceId;
  final String transactionType;
  final int quantity;
  final String? remarks;
  final DateTime? transactionDate;
  final String? createdBy;
  final DateTime? createdAt;
  final String packageName;

  ContainerTransactionModel({
    required this.id,
    required this.customerId,
    required this.packagingTypeId,
    required this.referenceType,
    this.referenceId,
    required this.transactionType,
    required this.quantity,
    this.remarks,
    this.transactionDate,
    this.createdBy,
    this.createdAt,
    required this.packageName,
  });

  factory ContainerTransactionModel.fromJson(Map<String, dynamic> json) {
    return ContainerTransactionModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      customerId: json['customer_id']?.toString() ?? '',
      packagingTypeId: json['packaging_type_id']?.toString() ?? '',
      referenceType: json['reference_type']?.toString() ?? '',
      referenceId: json['reference_id']?.toString(),
      transactionType: json['transaction_type']?.toString() ?? '',
      quantity: int.tryParse(json['quantity'].toString()) ?? 0,
      remarks: json['remarks']?.toString(),
      transactionDate: json['transaction_date'] != null ? DateTime.tryParse(json['transaction_date'].toString()) : null,
      createdBy: json['created_by']?.toString(),
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
      packageName: json['package_name']?.toString() ?? 'Container',
    );
  }
}
