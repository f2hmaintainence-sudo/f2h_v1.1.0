import 'package:f2h_delivery/core/api/api_endpoints.dart';
class BankAccountModel {
  final int? id;
  final String accountHolderName;
  final String bankName;
  final String accountNumber;
  final String ifscCode;
  final String? branchName;
  final String? upiId;
  final String? cancelledChequeImage;
  final String verificationStatus; // pending, verified, rejected
  final String? verifiedBy;
  final String? verifiedAt;
  final String? rejectionReason;
  final bool isPrimary;

  BankAccountModel({
    this.id,
    required this.accountHolderName,
    required this.bankName,
    required this.accountNumber,
    required this.ifscCode,
    this.branchName,
    this.upiId,
    this.cancelledChequeImage,
    required this.verificationStatus,
    this.verifiedBy,
    this.verifiedAt,
    this.rejectionReason,
    required this.isPrimary,
  });
  static String? _imageUrl(dynamic value) {
    if (value == null) return null;

    final path = value.toString();
    if (path.isEmpty) return null;

    // Already a full URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Relative path from backend
    return '${ApiEndpoints.baseUrl}/$path';
  }
  factory BankAccountModel.fromJson(Map<String, dynamic> json) {
    return BankAccountModel(
      id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
      accountHolderName: json['account_holder_name']?.toString() ?? '',
      bankName: json['bank_name']?.toString() ?? '',
      accountNumber: json['account_number']?.toString() ?? '',
      ifscCode: json['ifsc_code']?.toString() ?? '',
      branchName: json['branch_name']?.toString(),
      upiId: json['upi_id']?.toString(),
      cancelledChequeImage: _imageUrl(json['cancelled_cheque_image']),
      verificationStatus: json['verification_status']?.toString() ?? 'pending',
      verifiedBy: json['verified_by']?.toString(),
      verifiedAt: json['verified_at']?.toString(),
      rejectionReason: json['rejection_reason']?.toString(),
      isPrimary: json['is_primary'] == true || json['is_primary'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'account_holder_name': accountHolderName,
      'bank_name': bankName,
      'account_number': accountNumber,
      'ifsc_code': ifscCode,
      if (branchName != null) 'branch_name': branchName,
      if (upiId != null) 'upi_id': upiId,
      if (cancelledChequeImage != null) 'cancelled_cheque_image': cancelledChequeImage,
      'verification_status': verificationStatus,
      if (verifiedBy != null) 'verified_by': verifiedBy,
      if (verifiedAt != null) 'verified_at': verifiedAt,
      if (rejectionReason != null) 'rejection_reason': rejectionReason,
      'is_primary': isPrimary,
    };
  }

  String get maskedAccountNumber {
    if (accountNumber.length <= 4) return accountNumber;
    return '•••• •••• ${accountNumber.substring(accountNumber.length - 4)}';
  }
}
