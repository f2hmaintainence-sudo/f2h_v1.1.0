import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';
import 'package:f2h_customer/features/catalog/data/models/today_delivery_partner_model.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';

class CustomerSessionCache {
  static const _profileKey = 'customer_session_profile';
  static const _addressesKey = 'customer_session_addresses';
  static const _walletKey = 'customer_session_wallet'; 
  static const _deliveryRulesKey = 'customer_session_delivery_rules';
  static const _slotTimingsKey = 'customer_session_slot_timings';
  static const _todayDeliveryPartnersKey = 'customer_session_today_delivery_partners';

  Future<void> save(CustomerSessionState session) async {
    final prefs = await SharedPreferences.getInstance();
    final profile = session.profile;

    if (profile != null) {
      await prefs.setString(_profileKey, jsonEncode(_profileToJson(profile)));
    }

    await prefs.setString(
      _addressesKey,
      jsonEncode(session.addresses.map((a) => a.toJson()).toList()),
    );
    await prefs.setString(_walletKey, jsonEncode(session.wallet));
    await prefs.setString(_deliveryRulesKey, jsonEncode(session.deliveryRules));
    await prefs.setString(_slotTimingsKey, jsonEncode(session.slotTimings));
    await prefs.setString(
      _todayDeliveryPartnersKey,
      jsonEncode(session.todayDeliveryPartners.map((p) => p.toJson()).toList()),
    );
  }

  Future<CustomerSessionState?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final profileJson = prefs.getString(_profileKey);

    if (profileJson == null || profileJson.isEmpty) {
      return null;
    }

    final profile = ProfileModel.fromJson(
      jsonDecode(profileJson) as Map<String, dynamic>,
    );

    final addressesJson = prefs.getString(_addressesKey);
    final addresses = addressesJson == null
        ? <AddressModel>[]
        : (jsonDecode(addressesJson) as List)
            .map((e) => AddressModel.fromJson(e as Map<String, dynamic>))
            .toList();

    final walletJson = prefs.getString(_walletKey);
    final wallet = walletJson == null
        ? <String, dynamic>{'balance': profile.walletBalance}
        : Map<String, dynamic>.from(jsonDecode(walletJson) as Map);

    final deliveryRulesJson = prefs.getString(_deliveryRulesKey);
    final deliveryRules = deliveryRulesJson == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(deliveryRulesJson) as Map);

    final slotTimingsJson = prefs.getString(_slotTimingsKey);
    final slotTimings = slotTimingsJson == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(slotTimingsJson) as Map);

    final todayPartnersJson = prefs.getString(_todayDeliveryPartnersKey);
    final todayPartners = todayPartnersJson == null
        ? <TodayDeliveryPartner>[]
        : (jsonDecode(todayPartnersJson) as List)
            .map((e) =>
                TodayDeliveryPartner.fromJson(e as Map<String, dynamic>))
            .toList();

    return CustomerSessionState(
      status: CustomerSessionStatus.cached,
      profile: profile,
      addresses: addresses,
      wallet: wallet,
      deliveryRules: deliveryRules,
      slotTimings: slotTimings,
      todayDeliveryPartners: todayPartners,
    );
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_profileKey);
    await prefs.remove(_addressesKey);
    await prefs.remove(_walletKey);
    await prefs.remove(_deliveryRulesKey);
    await prefs.remove(_slotTimingsKey);
    await prefs.remove(_todayDeliveryPartnersKey);
  }

  Map<String, dynamic> _profileToJson(ProfileModel profile) {
    return {
      'customer_id': profile.customerId,
      'id': profile.userId,
      'name': profile.name,
      'first_name': profile.firstName,
      'last_name': profile.lastName,
      'gender': profile.gender,
      'email': profile.email,
      'mobile': profile.mobile,
      'dob': profile.dob,
      'wallet_balance': profile.walletBalance,
      'zone_id': profile.zoneId,
      'route_id': profile.routeId,
      'branch_id': profile.branchId,
      'customer_status': profile.status,
      'is_postpaid_enabled': profile.isPostpaidEnabled,
      'postpaid_credit_limit': profile.postpaidCreditLimit,
      'subscription_number': profile.subscriptionNumber,
      'referral_code': profile.referralCode,
      'referral_status': profile.referralStatus,
      'first_order_completed': profile.firstOrderCompleted,
    };
  }
}
