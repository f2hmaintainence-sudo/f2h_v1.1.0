class Transaction {
  final String id, desc, date;
  final double amount;
  final bool isCredit;
  const Transaction({required this.id, required this.desc,
    required this.date, required this.amount, required this.isCredit});
}
final mockTx = [
  const Transaction(id:'t1', desc:'Order — Cow Milk × 2', date:'Today', amount:64, isCredit:false),
  const Transaction(id:'t2', desc:'Order — Paneer × 1', date:'Today', amount:80, isCredit:false),
  const Transaction(id:'t3', desc:'Wallet Topup via UPI', date:'Yesterday', amount:500, isCredit:true),
  const Transaction(id:'t4', desc:'Order — Cow Milk × 2', date:'Yesterday', amount:64, isCredit:false),
  const Transaction(id:'t5', desc:'Referral Bonus — Ravi K.', date:'07 Apr', amount:100, isCredit:true),
  const Transaction(id:'t6', desc:'Order — Cow Milk × 2', date:'07 Apr', amount:64, isCredit:false),
  const Transaction(id:'t7', desc:'Wallet Topup via UPI', date:'05 Apr', amount:300, isCredit:true),
];

class CustomerWalletTransaction {
  final int id;
  final String? transactionId;
  final String customerId;
  final String transactionType;
  final double amount;
  final double balanceAfter;
  final String? referenceType;
  final String? referenceId;
  final String? remarks;
  final String? createdBy;
  final DateTime? createdAt;

  CustomerWalletTransaction({
    required this.id,
    this.transactionId,
    required this.customerId,
    required this.transactionType,
    required this.amount,
    required this.balanceAfter,
    this.referenceType,
    this.referenceId,
    this.remarks,
    this.createdBy,
    this.createdAt,
  });

  factory CustomerWalletTransaction.fromJson(
    Map<String, dynamic> json,
  ) {
    return CustomerWalletTransaction(
      id: int.tryParse(json['id'].toString()) ?? 0,
      transactionId: json['transaction_id']?.toString() ??
          json['transactionId']?.toString() ??
          json['tx_id']?.toString(),
      customerId: json['customer_id']?.toString() ?? '',
      transactionType:
          (json['transaction_type'] ?? json['direction'])
                  ?.toString() ??
              '',
      amount: double.tryParse(
            json['amount']?.toString() ?? '0',
          ) ??
          0,
      balanceAfter: double.tryParse(
            json['balance_after']?.toString() ?? '0',
          ) ??
          0,
      referenceType:
          json['reference_type']?.toString() ?? json['referenceType']?.toString(),
      referenceId:
          json['reference_id']?.toString() ??
          json['related_order_id']?.toString() ??
          json['order_id']?.toString(),
      remarks:
          (json['remarks'] ?? json['reason'])?.toString(),
      createdBy:
          (json['created_by'] ?? json['initiated_by'])
              ?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(
              json['created_at'].toString(),
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'transaction_id': transactionId,
      'customer_id': customerId,
      'transaction_type': transactionType,
      'direction': transactionType,
      'amount': amount,
      'balance_after': balanceAfter,
      'reference_type': referenceType,
      'reference_id': referenceId,
      'remarks': remarks,
      'reason': remarks,
      'created_by': createdBy,
      'initiated_by': createdBy,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
