class DeliveryPartnerAddressInfo {
  final String addressId;
  final String addressType;
  final String addressLine;
  final String area;
  final String deliveryStatus;
  final String? deliveredAt;
  final int sequenceNo;

  const DeliveryPartnerAddressInfo({
    required this.addressId,
    this.addressType = 'home',
    this.addressLine = '',
    this.area = '',
    this.deliveryStatus = 'pending',
    this.deliveredAt,
    this.sequenceNo = 0,
  });

  factory DeliveryPartnerAddressInfo.fromJson(Map<String, dynamic> json) {
    return DeliveryPartnerAddressInfo(
      addressId: json['address_id']?.toString() ?? '',
      addressType: json['address_type']?.toString() ?? 'home',
      addressLine: json['address_line']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      deliveryStatus: json['delivery_status']?.toString() ?? 'pending',
      deliveredAt: json['delivered_at']?.toString(),
      sequenceNo: int.tryParse(json['sequence_no']?.toString() ?? '0') ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'address_id': addressId,
      'address_type': addressType,
      'address_line': addressLine,
      'area': area,
      'delivery_status': deliveryStatus,
      'delivered_at': deliveredAt,
      'sequence_no': sequenceNo,
    };
  }
}

class TodayDeliveryPartner {
  final String partnerId;
  final String partnerName;
  final String phone;
  final String? profilePhoto;
  final String deliverySlot;
  final String slotLabel;
  final bool isCurrentSlot;
  final String runStatus;
  final String deliveryStatus;
  final String runDate;
  final double? latitude;
  final double? longitude;
  final String? lastLocationAt;
  final List<DeliveryPartnerAddressInfo> addresses;

  const TodayDeliveryPartner({
    required this.partnerId,
    required this.partnerName,
    required this.phone,
    this.profilePhoto,
    this.deliverySlot = 'morning',
    this.slotLabel = 'Morning Delivery',
    this.isCurrentSlot = true,
    this.runStatus = 'planned',
    this.deliveryStatus = 'pending',
    this.runDate = '',
    this.latitude,
    this.longitude,
    this.lastLocationAt,
    this.addresses = const [],
  });

  factory TodayDeliveryPartner.fromJson(Map<String, dynamic> json) {
    final rawAddresses = json['addresses'] as List? ?? [];
    return TodayDeliveryPartner(
      partnerId: json['partner_id']?.toString() ?? '',
      partnerName: json['partner_name']?.toString() ?? 'Delivery Partner',
      phone: json['phone']?.toString() ?? '',
      profilePhoto: json['profile_photo']?.toString(),
      deliverySlot: json['delivery_slot']?.toString() ?? 'morning',
      slotLabel: json['slot_label']?.toString() ??
          (json['delivery_slot']?.toString() == 'evening'
              ? 'Evening Delivery'
              : 'Morning Delivery'),
      isCurrentSlot: json['is_current_slot'] == true ||
          json['is_current_slot']?.toString() == 'true',
      runStatus: json['run_status']?.toString() ?? 'planned',
      deliveryStatus: json['delivery_status']?.toString() ?? 'pending',
      runDate: json['run_date']?.toString() ?? '',
      latitude: double.tryParse(json['latitude']?.toString() ?? json['lat']?.toString() ?? ''),
      longitude: double.tryParse(json['longitude']?.toString() ?? json['lng']?.toString() ?? ''),
      lastLocationAt: json['last_location_at']?.toString(),
      addresses: rawAddresses
          .map((a) =>
              DeliveryPartnerAddressInfo.fromJson(Map<String, dynamic>.from(a as Map)))
          .toList(),
    );
  }

  TodayDeliveryPartner copyWith({
    String? partnerId,
    String? partnerName,
    String? phone,
    String? profilePhoto,
    String? deliverySlot,
    String? slotLabel,
    bool? isCurrentSlot,
    String? runStatus,
    String? deliveryStatus,
    String? runDate,
    double? latitude,
    double? longitude,
    String? lastLocationAt,
    List<DeliveryPartnerAddressInfo>? addresses,
  }) {
    return TodayDeliveryPartner(
      partnerId: partnerId ?? this.partnerId,
      partnerName: partnerName ?? this.partnerName,
      phone: phone ?? this.phone,
      profilePhoto: profilePhoto ?? this.profilePhoto,
      deliverySlot: deliverySlot ?? this.deliverySlot,
      slotLabel: slotLabel ?? this.slotLabel,
      isCurrentSlot: isCurrentSlot ?? this.isCurrentSlot,
      runStatus: runStatus ?? this.runStatus,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
      runDate: runDate ?? this.runDate,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      lastLocationAt: lastLocationAt ?? this.lastLocationAt,
      addresses: addresses ?? this.addresses,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'partner_id': partnerId,
      'partner_name': partnerName,
      'phone': phone,
      'profile_photo': profilePhoto,
      'delivery_slot': deliverySlot,
      'slot_label': slotLabel,
      'is_current_slot': isCurrentSlot,
      'run_status': runStatus,
      'delivery_status': deliveryStatus,
      'run_date': runDate,
      'latitude': latitude,
      'longitude': longitude,
      'last_location_at': lastLocationAt,
      'addresses': addresses.map((a) => a.toJson()).toList(),
    };
  }
}
