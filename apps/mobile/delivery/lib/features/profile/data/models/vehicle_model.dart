import 'package:f2h_delivery/core/api/api_endpoints.dart';
class VehicleModel {
  final int? id;
  final String vehicleType; // bike, scooter, cycle, van, auto, etc
  final String registrationNumber;
  final String? brand;
  final String? model;
  final String? color;
  final String? rcNumber;
  final String? rcFrontImage;
  final String? rcBackImage;
  final String? insuranceNumber;
  final String? insuranceImage;
  final String? insuranceExpiry;
  final String verificationStatus; // pending, verified, rejected
  final String? verifiedBy;
  final String? verifiedAt;
  final bool isPrimary;

  VehicleModel({
    this.id,
    required this.vehicleType,
    required this.registrationNumber,
    this.brand,
    this.model,
    this.color,
    this.rcNumber,
    this.rcFrontImage,
    this.rcBackImage,
    this.insuranceNumber,
    this.insuranceImage,
    this.insuranceExpiry,
    required this.verificationStatus,
    this.verifiedBy,
    this.verifiedAt,
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
  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
      vehicleType: json['vehicle_type']?.toString() ?? 'bike',
      registrationNumber: json['registration_number']?.toString() ?? '',
      brand: json['brand']?.toString(),
      model: json['model']?.toString(),
      color: json['color']?.toString(),
      rcNumber: json['rc_number']?.toString(),
      rcFrontImage: _imageUrl(json['rc_front_image']),
      rcBackImage: _imageUrl(json['rc_back_image']),
      insuranceNumber: json['insurance_number']?.toString(),
      insuranceImage: _imageUrl(json['insurance_image']),
      insuranceExpiry: json['insurance_expiry']?.toString(),
      verificationStatus: json['verification_status']?.toString() ?? 'pending',
      verifiedBy: json['verified_by']?.toString(),
      verifiedAt: json['verified_at']?.toString(),
      isPrimary: json['is_primary'] == true || json['is_primary'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'vehicle_type': vehicleType,
      'registration_number': registrationNumber,
      if (brand != null) 'brand': brand,
      if (model != null) 'model': model,
      if (color != null) 'color': color,
      if (rcNumber != null) 'rc_number': rcNumber,
      if (rcFrontImage != null) 'rc_front_image': rcFrontImage,
      if (rcBackImage != null) 'rc_back_image': rcBackImage,
      if (insuranceNumber != null) 'insurance_number': insuranceNumber,
      if (insuranceImage != null) 'insurance_image': insuranceImage,
      if (insuranceExpiry != null) 'insurance_expiry': insuranceExpiry,
      'verification_status': verificationStatus,
      if (verifiedBy != null) 'verified_by': verifiedBy,
      if (verifiedAt != null) 'verified_at': verifiedAt,
      'is_primary': isPrimary,
    };
  }

  bool get isInsuranceExpiringSoon {
    if (insuranceExpiry == null || insuranceExpiry!.isEmpty) return false;
    try {
      final expiry = DateTime.parse(insuranceExpiry!);
      final difference = expiry.difference(DateTime.now()).inDays;
      return difference >= 0 && difference <= 30;
    } catch (_) {
      return false;
    }
  }

  bool get isInsuranceExpired {
    if (insuranceExpiry == null || insuranceExpiry!.isEmpty) return false;
    try {
      final expiry = DateTime.parse(insuranceExpiry!);
      return expiry.isBefore(DateTime.now());
    } catch (_) {
      return false;
    }
  }
}
