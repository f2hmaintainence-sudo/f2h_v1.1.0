class AddressModel {
  final String? addressId;
  final String customerId;
  final String addressType;
  final String contactName;
  final String contactMobile;

  final String flatNo;
  final String floorNo;
  final String buildingName;

  final String landmark;
  final String street;
  final String area;

  final String city;
  final String state;
  final String pincode;

  final double latitude;
  final double longitude;

  final String deliveryNote;

  final bool isDefault;

  final String zoneId;
  final String routeId;
  final String branchId;

  final String status;
  final String? branchName;
  final bool branchIsActive;
  final bool isServiceable;
  final String? unserviceableReason;

  AddressModel({
    this.addressId,
    required this.customerId,
    required this.addressType,
    required this.contactName,
    required this.contactMobile,
    required this.flatNo,
    required this.floorNo,
    required this.buildingName,
    required this.landmark,
    required this.street,
    required this.area,
    required this.city,
    required this.state,
    required this.pincode,
    required this.latitude,
    required this.longitude,
    required this.deliveryNote,
    required this.isDefault,
    required this.zoneId,
    required this.routeId,
    required this.branchId,
    required this.status,
    this.branchName,
    this.branchIsActive = true,
    this.isServiceable = true,
    this.unserviceableReason,
  });

  // Compatibility getters for Address class interfaces
  String? get id => addressId;
  String get uniqueId => (addressId != null && addressId!.isNotEmpty)
      ? addressId!
      : '${flatNo}_${buildingName}_${area}_${pincode}_$contactMobile';
  String get name => contactName;
  String get mobileNumber => contactMobile;
  String get houseNumber => flatNo.isNotEmpty ? '$flatNo ${floorNo.isNotEmpty ? 'Floor $floorNo' : ''} $buildingName'.trim() : buildingName;
  String get label => addressType;
  String get detail => [
        if (flatNo.isNotEmpty) flatNo,
        if (floorNo.isNotEmpty) 'Floor $floorNo',
        if (buildingName.isNotEmpty) buildingName,
        if (street.isNotEmpty) street,
        if (area.isNotEmpty) area,
        if (city.isNotEmpty) city,
        if (state.isNotEmpty) state,
        if (pincode.isNotEmpty) pincode,
      ].join(', ');

  static bool _isTruthy(dynamic value) {
    final normalized = value?.toString().trim().toLowerCase();
    return normalized == 'true' ||
        normalized == '1' ||
        normalized == 'yes';
  }

  // Map-like operator for backward compatibility with checkout & profile screens
  dynamic operator [](String key) {
    switch (key) {

      case 'id': return id;
      case 'addressId': return addressId;
      case 'address_id':
      case 'action_id':
        return addressId;

      case 'name': return name;
      case 'mobileNumber': return mobileNumber;
      case 'houseNumber': return houseNumber;
      case 'street': return street;
      case 'landmark': return landmark;
      case 'area': return area;
      case 'city': return city;
      case 'state': return state;
      case 'pincode': return pincode;
      case 'latitude': return latitude;
      case 'longitude': return longitude;
      case 'addressType': return addressType;
      case 'isDefault': return isDefault;
      case 'label': return label;
      case 'detail': return detail;
      case 'branch_name': return branchName;
      case 'branch_is_active': return branchIsActive;
      case 'is_serviceable': return isServiceable;
      case 'unserviceable_reason': return unserviceableReason;
      default: return null;
    }
  }

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    final rawBranchActive = json['branch_is_active'];
    final bool branchIsActive = rawBranchActive == null
        ? (json['branch_status'] != null ? json['branch_status'].toString().toUpperCase() == 'ACTIVE' : true)
        : _isTruthy(rawBranchActive);

    final rawServiceable = json['is_serviceable'];
    final String branchId = json['branch_id']?.toString() ?? '';
    final bool isServiceable = rawServiceable != null
        ? _isTruthy(rawServiceable)
        : (branchId.isNotEmpty ? branchIsActive : true);

    return AddressModel(
      addressId: (json['address_id'] ?? json['addressId'] ?? json['action_id'] ?? json['id'])?.toString(),
      customerId: json['customer_id']?.toString() ?? '',
      addressType: json['address_type']?.toString() ?? '',
      contactName: json['contact_name']?.toString() ?? '',
      contactMobile: json['contact_mobile']?.toString() ?? '',
      flatNo: json['flat_no']?.toString() ?? '',
      floorNo: json['floor_no']?.toString() ?? '',
      buildingName: json['building_name']?.toString() ?? '',
      landmark: json['landmark']?.toString() ?? '',
      street: json['street']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      pincode: json['pincode']?.toString() ?? '',
      latitude: double.tryParse(json['latitude']?.toString() ?? '') ?? 0.0,
      longitude: double.tryParse(json['longitude']?.toString() ?? '') ?? 0.0,
      deliveryNote: json['delivery_note']?.toString() ?? '',
      isDefault: _isTruthy(json['is_default']),
      zoneId: json['zone_id']?.toString() ?? '',
      routeId: json['route_id']?.toString() ?? '',
      branchId: branchId,
      status: (json['customer_status'] ?? json['status'])?.toString() ?? '',
      branchName: json['branch_name']?.toString(),
      branchIsActive: branchIsActive,
      isServiceable: isServiceable,
      unserviceableReason: json['unserviceable_reason']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'address_id': addressId,
      'customer_id': customerId,
      'address_type': addressType,
      'contact_name': contactName,
      'contact_mobile': contactMobile,
      'flat_no': flatNo,
      'floor_no': floorNo,
      'building_name': buildingName,
      'landmark': landmark,
      'street': street,
      'area': area,
      'city': city,
      'state': state,
      'pincode': pincode,
      'latitude': latitude,
      'longitude': longitude,
      'delivery_note': deliveryNote,
      'is_default': isDefault ? true : false,
      'zone_id': zoneId,
      'route_id': routeId,
      'branch_id': branchId,
      'status': status,
      'branch_name': branchName,
      'branch_is_active': branchIsActive,
      'is_serviceable': isServiceable,
      'unserviceable_reason': unserviceableReason,
    };
  }

  AddressModel copyWith({
    String? addressId,
    String? customerId,
    String? addressType,
    String? contactName,
    String? contactMobile,
    String? flatNo,
    String? floorNo,
    String? buildingName,
    String? landmark,
    String? street,
    String? area,
    String? city,
    String? state,
    String? pincode,
    double? latitude,
    double? longitude,
    String? deliveryNote,
    bool? isDefault,
    String? zoneId,
    String? routeId,
    String? branchId,
    String? status,
    String? branchName,
    bool? branchIsActive,
    bool? isServiceable,
    String? unserviceableReason,
  }) {
    return AddressModel(
      addressId: addressId ?? this.addressId,
      customerId: customerId ?? this.customerId,
      addressType: addressType ?? this.addressType,
      contactName: contactName ?? this.contactName,
      contactMobile: contactMobile ?? this.contactMobile,
      flatNo: flatNo ?? this.flatNo,
      floorNo: floorNo ?? this.floorNo,
      buildingName: buildingName ?? this.buildingName,
      landmark: landmark ?? this.landmark,
      street: street ?? this.street,
      area: area ?? this.area,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      deliveryNote: deliveryNote ?? this.deliveryNote,
      isDefault: isDefault ?? this.isDefault,
      zoneId: zoneId ?? this.zoneId,
      routeId: routeId ?? this.routeId,
      branchId: branchId ?? this.branchId,
      status: status ?? this.status,
      branchName: branchName ?? this.branchName,
      branchIsActive: branchIsActive ?? this.branchIsActive,
      isServiceable: isServiceable ?? this.isServiceable,
      unserviceableReason: unserviceableReason ?? this.unserviceableReason,
    );
  }
}
