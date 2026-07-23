import 'package:f2h_delivery/core/api/api_endpoints.dart';
class ProfileModel {
  final String deliveryPartnerId;
  final String fullName;
  final String phone;
  final String email;
  final String vehicleType;
  final String vehicleNumber;
  final String? bankAccountNumber;
  final String? bankName;
  final String? bankIfsc;
  final String? accountHolderName;
  final bool isVerified;
  final bool isActive;
  final String? joinedDate;
  final int? sectorIndex;
  final String? branchName;
  final double? dailySalary;

  // New fields
  final String? dateOfBirth;
  final String? gender;
  final String? residentialAddress;
  final String? emergencyContact;
  final String? emergencyContactNumber;
  final String? profilePhotoUrl;
  final String? idProofUrl;
  final String? aadhaarUrl;
  final double? averageRating;
  final int? totalRuns;
  final int? totalDeliveries;
  final String? lastLoginAt;

  ProfileModel({
    required this.deliveryPartnerId,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.vehicleType,
    required this.vehicleNumber,
    this.bankAccountNumber,
    this.bankName,
    this.bankIfsc,
    this.accountHolderName,
    required this.isVerified,
    required this.isActive,
    this.joinedDate,
    this.sectorIndex,
    this.branchName,
    this.dailySalary,
    this.dateOfBirth,
    this.gender,
    this.residentialAddress,
    this.emergencyContact,
    this.emergencyContactNumber,
    this.profilePhotoUrl,
    this.idProofUrl,
    this.aadhaarUrl,
    this.averageRating,
    this.totalRuns,
    this.totalDeliveries,
    this.lastLoginAt,
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
  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      deliveryPartnerId: json['delivery_partner_id']?.toString() ?? json['user_id']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? json['user_name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? json['user_email']?.toString() ?? '',
      vehicleType: json['vehicle_type']?.toString() ?? '',
      vehicleNumber: json['vehicle_number']?.toString() ?? '',
      bankAccountNumber: json['bank_account_number']?.toString(),
      bankName: json['bank_name']?.toString(),
      bankIfsc: json['bank_ifsc']?.toString(),
      accountHolderName: json['account_holder_name']?.toString(),
      isVerified: json['is_verified'] == true || json['is_verified'] == 1 || json['is_verified'] == 'true',
      isActive: json['is_active'] == 1 || json['is_active'] == true || json['is_active']?.toString().toLowerCase() == 'true',
      joinedDate: json['joined_date']?.toString(),
      sectorIndex: json['sector_index'] != null ? int.tryParse(json['sector_index'].toString()) : null,
      branchName: json['branch_name']?.toString(),
      dailySalary: json['daily_salary'] != null ? double.tryParse(json['daily_salary'].toString()) : null,
      dateOfBirth: json['date_of_birth']?.toString(),
      gender: json['gender']?.toString(),
      residentialAddress: json['residential_address']?.toString(),
      emergencyContact: json['emergency_contact']?.toString(),
      emergencyContactNumber: json['emergency_contact_number']?.toString(),
      profilePhotoUrl: _imageUrl(json['profile_photo_url']?.toString()),
      idProofUrl: _imageUrl(json['id_proof_url']?.toString()),
      aadhaarUrl: _imageUrl(json['aadhaar_url']?.toString()),
      averageRating: json['average_rating'] != null ? double.tryParse(json['average_rating'].toString()) : null,
      totalRuns: json['total_runs'] != null ? int.tryParse(json['total_runs'].toString()) : null,
      totalDeliveries: json['total_deliveries'] != null ? int.tryParse(json['total_deliveries'].toString()) : null,
      lastLoginAt: json['last_login_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'delivery_partner_id': deliveryPartnerId,
      'full_name': fullName,
      'phone': phone,
      'email': email,
      'vehicle_type': vehicleType,
      'vehicle_number': vehicleNumber,
      if (bankAccountNumber != null) 'bank_account_number': bankAccountNumber,
      if (bankName != null) 'bank_name': bankName,
      if (bankIfsc != null) 'bank_ifsc': bankIfsc,
      if (accountHolderName != null) 'account_holder_name': accountHolderName,
      'is_verified': isVerified,
      'is_active': isActive,
      if (joinedDate != null) 'joined_date': joinedDate,
      if (sectorIndex != null) 'sector_index': sectorIndex,
      if (branchName != null) 'branch_name': branchName,
      if (dailySalary != null) 'daily_salary': dailySalary,
      if (dateOfBirth != null) 'date_of_birth': dateOfBirth,
      if (gender != null) 'gender': gender,
      if (residentialAddress != null) 'residential_address': residentialAddress,
      if (emergencyContact != null) 'emergency_contact': emergencyContact,
      if (emergencyContactNumber != null) 'emergency_contact_number': emergencyContactNumber,
      if (profilePhotoUrl != null) 'profile_photo_url': profilePhotoUrl,
      if (idProofUrl != null) 'id_proof_url': idProofUrl,
      if (aadhaarUrl != null) 'aadhaar_url': aadhaarUrl,
      if (averageRating != null) 'average_rating': averageRating,
      if (totalRuns != null) 'total_runs': totalRuns,
      if (totalDeliveries != null) 'total_deliveries': totalDeliveries,
      if (lastLoginAt != null) 'last_login_at': lastLoginAt,
    };
  }

  ProfileModel copyWith({
    String? deliveryPartnerId,
    String? fullName,
    String? phone,
    String? email,
    String? vehicleType,
    String? vehicleNumber,
    String? bankAccountNumber,
    String? bankName,
    String? bankIfsc,
    String? accountHolderName,
    bool? isVerified,
    bool? isActive,
    String? joinedDate,
    int? sectorIndex,
    String? branchName,
    double? dailySalary,
    String? dateOfBirth,
    String? gender,
    String? residentialAddress,
    String? emergencyContact,
    String? emergencyContactNumber,
    String? profilePhotoUrl,
    String? idProofUrl,
    String? aadhaarUrl,
    double? averageRating,
    int? totalRuns,
    int? totalDeliveries,
    String? lastLoginAt,
  }) {
    return ProfileModel(
      deliveryPartnerId: deliveryPartnerId ?? this.deliveryPartnerId,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      bankAccountNumber: bankAccountNumber ?? this.bankAccountNumber,
      bankName: bankName ?? this.bankName,
      bankIfsc: bankIfsc ?? this.bankIfsc,
      accountHolderName: accountHolderName ?? this.accountHolderName,
      isVerified: isVerified ?? this.isVerified,
      isActive: isActive ?? this.isActive,
      joinedDate: joinedDate ?? this.joinedDate,
      sectorIndex: sectorIndex ?? this.sectorIndex,
      branchName: branchName ?? this.branchName,
      dailySalary: dailySalary ?? this.dailySalary,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      gender: gender ?? this.gender,
      residentialAddress: residentialAddress ?? this.residentialAddress,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      emergencyContactNumber: emergencyContactNumber ?? this.emergencyContactNumber,
      profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
      idProofUrl: idProofUrl ?? this.idProofUrl,
      aadhaarUrl: aadhaarUrl ?? this.aadhaarUrl,
      averageRating: averageRating ?? this.averageRating,
      totalRuns: totalRuns ?? this.totalRuns,
      totalDeliveries: totalDeliveries ?? this.totalDeliveries,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
    );
  }
}
