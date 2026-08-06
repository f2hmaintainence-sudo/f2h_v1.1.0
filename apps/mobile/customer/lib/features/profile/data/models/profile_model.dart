class ProfileModel {
  final String customerId;
  final String userId;
  final String name;
  final String firstName;
  final String lastName;
  final String gender;
  final String email;
  final String mobile;
  final String dob;
  final double walletBalance;
  final String zoneId;
  final String routeId;
  final String branchId;
  final String status;
  final bool isPostpaidEnabled;
  final double postpaidCreditLimit;
  final bool isMember;
  final String? subscriptionNumber;
  final String? referralCode;
  final String? referralStatus;

  ProfileModel({
    required this.customerId,
    required this.userId,
    required this.name,
    required this.firstName,
    required this.lastName,
    required this.gender,
    required this.email,
    required this.mobile,
    required this.dob,
    required this.walletBalance,
    required this.zoneId,
    required this.routeId,
    required this.branchId,
    required this.status,
    this.isPostpaidEnabled = false,
    this.postpaidCreditLimit = 0.0,
    this.isMember = false,
    this.subscriptionNumber,
    this.referralCode,
    this.referralStatus,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    final subNum = json['subscription_number']?.toString();
    final hasSubscription = subNum != null &&
        subNum.isNotEmpty &&
        subNum.toLowerCase() != 'null';

    final rawFirstName = json['first_name']?.toString().trim() ?? '';
    final rawLastName = json['last_name']?.toString().trim() ?? '';
    final rawUserName = json['user_name']?.toString().trim() ?? json['name']?.toString().trim() ?? '';

    String computedName = '$rawFirstName $rawLastName'.trim();
    if (computedName.isEmpty) {
      computedName = rawUserName;
    }
    if (computedName.isEmpty && json['email'] != null && json['email'].toString().contains('@')) {
      computedName = json['email'].toString().split('@')[0];
    }
    if (computedName.isEmpty) {
      computedName = (json['mobile'] ?? json['phone'])?.toString().trim() ?? '';
    }

    return ProfileModel(
      customerId: json['customer_id']?.toString() ?? '',
      userId: json['customer_id']?.toString() ?? '',
      name: computedName,
      firstName: rawFirstName.isNotEmpty ? rawFirstName : computedName,
      lastName: rawLastName,
      gender: json['gender']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      mobile: (json['mobile'] ?? json['phone'])?.toString() ?? '',
      dob: json['dob']?.toString() ?? '',
      walletBalance: double.tryParse(json['wallet_balance']?.toString() ?? '') ?? 0.0,
      zoneId: json['zone_id']?.toString() ?? '',
      routeId: json['route_id']?.toString() ?? '',
      branchId: json['branch_id']?.toString() ?? '',
      status: (json['customer_status'] ?? json['status'])?.toString() ?? '',
      isPostpaidEnabled: json['is_postpaid_enabled'] == true || json['is_postpaid_enabled']?.toString() == 'true',
      postpaidCreditLimit: double.tryParse(json['postpaid_credit_limit']?.toString() ?? '') ?? 0.0,
      isMember: hasSubscription,
      subscriptionNumber: subNum == 'null' ? null : subNum,
      referralCode: json['referral_code']?.toString(),
      referralStatus: json['referral_status']?.toString(),
    );
  }

  ProfileModel copyWith({
    String? customerId,
    String? userId,
    String? name,
    String? firstName,
    String? lastName,
    String? gender,
    String? email,
    String? mobile,
    String? dob,
    double? walletBalance,
    String? zoneId,
    String? routeId,
    String? branchId,
    String? status,
    bool? isPostpaidEnabled,
    double? postpaidCreditLimit,
    bool? isMember,
    String? subscriptionNumber,
    String? referralCode,
    String? referralStatus,
  }) {
    return ProfileModel(
      customerId: customerId ?? this.customerId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      gender: gender ?? this.gender,
      email: email ?? this.email,
      mobile: mobile ?? this.mobile,
      dob: dob ?? this.dob,
      walletBalance: walletBalance ?? this.walletBalance,
      zoneId: zoneId ?? this.zoneId,
      routeId: routeId ?? this.routeId,
      branchId: branchId ?? this.branchId,
      status: status ?? this.status,
      isPostpaidEnabled: isPostpaidEnabled ?? this.isPostpaidEnabled,
      postpaidCreditLimit: postpaidCreditLimit ?? this.postpaidCreditLimit,
      isMember: isMember ?? this.isMember,
      subscriptionNumber: subscriptionNumber ?? this.subscriptionNumber,
      referralCode: referralCode ?? this.referralCode,
      referralStatus: referralStatus ?? this.referralStatus,
    );
  }
}
