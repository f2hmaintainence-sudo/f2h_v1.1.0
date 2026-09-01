import 'package:f2h_delivery/core/api/api_endpoints.dart';
class DocumentModel {
  final int? id;
  final String documentType; // aadhaar, pan, driving_license, police_verification, other
  final String? documentNumber;
  final String? frontImage;
  final String? backImage;
  final String? issueDate;
  final String? expiryDate;
  final String verificationStatus; // pending, verified, rejected
  final String? verifiedBy;
  final String? verifiedAt;
  final String? rejectionReason;
  final bool isPrimary;

  DocumentModel({
    this.id,
    required this.documentType,
    this.documentNumber,
    this.frontImage,
    this.backImage,
    this.issueDate,
    this.expiryDate,
    required this.verificationStatus,
    this.verifiedBy,
    this.verifiedAt,
    this.rejectionReason,
    required this.isPrimary,
  });
  static String? _imageUrl(dynamic value) {
    if (value == null) return null;

    var path = value.toString().trim();
    if (path.isEmpty || path == 'null') return null;

    // Already a full URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    // Relative path from backend root
    return '${ApiEndpoints.host}/$path';
  }

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
      documentType: json['document_type']?.toString() ?? '',
      documentNumber: json['document_number']?.toString(),
      frontImage: _imageUrl(json['front_image'] ?? json['document_url'] ?? json['aadhaar_url']),
      backImage: _imageUrl(json['back_image'] ?? json['id_proof_url']),
      issueDate: json['issue_date']?.toString(),
      expiryDate: json['expiry_date']?.toString(),
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
      'document_type': documentType,
      if (documentNumber != null) 'document_number': documentNumber,
      if (frontImage != null) 'front_image': frontImage,
      if (backImage != null) 'back_image': backImage,
      if (issueDate != null) 'issue_date': issueDate,
      if (expiryDate != null) 'expiry_date': expiryDate,
      'verification_status': verificationStatus,
      if (verifiedBy != null) 'verified_by': verifiedBy,
      if (verifiedAt != null) 'verified_at': verifiedAt,
      if (rejectionReason != null) 'rejection_reason': rejectionReason,
      'is_primary': isPrimary,
    };
  }

  bool get isExpiringSoon {
    if (expiryDate == null || expiryDate!.isEmpty) return false;
    try {
      final expiry = DateTime.parse(expiryDate!);
      final difference = expiry.difference(DateTime.now()).inDays;
      return difference >= 0 && difference <= 30;
    } catch (_) {
      return false;
    }
  }

  bool get isExpired {
    if (expiryDate == null || expiryDate!.isEmpty) return false;
    try {
      final expiry = DateTime.parse(expiryDate!);
      return expiry.isBefore(DateTime.now());
    } catch (_) {
      return false;
    }
  }
}
