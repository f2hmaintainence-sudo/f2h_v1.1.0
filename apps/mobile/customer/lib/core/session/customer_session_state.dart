import 'package:equatable/equatable.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';
import 'package:f2h_customer/features/catalog/data/models/today_delivery_partner_model.dart';

enum CustomerSessionStatus {
  initial,
  loading,
  ready,
  cached,
  unauthenticated,
  failure,
}

class CustomerSessionState extends Equatable {
  final CustomerSessionStatus status;
  final ProfileModel? profile;
  final List<AddressModel> addresses;
  final Map<String, dynamic> wallet;
  final Map<String, dynamic> subscriptionSummary;
  final List<dynamic> branches;
  final int notificationsCount;
  final Map<String, dynamic> deliveryRules;
  final Map<String, dynamic> slotTimings;
  final List<TodayDeliveryPartner> todayDeliveryPartners;
  final String? error;

  const CustomerSessionState({
    required this.status,
    this.profile,
    this.addresses = const [],
    this.wallet = const {},
    this.subscriptionSummary = const {},
    this.branches = const [],
    this.notificationsCount = 0,
    this.deliveryRules = const {},
    this.slotTimings = const {},
    this.todayDeliveryPartners = const [],
    this.error,
  });

  const CustomerSessionState.initial()
      : this(status: CustomerSessionStatus.initial);

  bool get hasUsableData => profile != null;

  CustomerSessionState copyWith({
    CustomerSessionStatus? status,
    ProfileModel? profile,
    List<AddressModel>? addresses,
    Map<String, dynamic>? wallet,
    Map<String, dynamic>? subscriptionSummary,
    List<dynamic>? branches,
    int? notificationsCount,
    Map<String, dynamic>? deliveryRules,
    Map<String, dynamic>? slotTimings,
    List<TodayDeliveryPartner>? todayDeliveryPartners,
    String? error,
  }) {
    return CustomerSessionState(
      status: status ?? this.status,
      profile: profile ?? this.profile,
      addresses: addresses ?? this.addresses,
      wallet: wallet ?? this.wallet,
      subscriptionSummary: subscriptionSummary ?? this.subscriptionSummary,
      branches: branches ?? this.branches,
      notificationsCount: notificationsCount ?? this.notificationsCount,
      deliveryRules: deliveryRules ?? this.deliveryRules,
      slotTimings: slotTimings ?? this.slotTimings,
      todayDeliveryPartners:
          todayDeliveryPartners ?? this.todayDeliveryPartners,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        status,
        profile,
        addresses,
        wallet,
        subscriptionSummary,
        branches,
        notificationsCount,
        deliveryRules,
        slotTimings,
        todayDeliveryPartners,
        error,
      ];
}
