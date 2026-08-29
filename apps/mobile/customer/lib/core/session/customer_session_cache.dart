import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';

class CustomerSessionCache {
  static const _profileKey = 'customer_session_profile';
  static const _addressesKey = 'customer_session_addresses';
  static const _walletKey = 'customer_session_wallet'; 
  static const _deliveryRulesKey = 'customer_session_delivery_rules';

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

    return CustomerSessionState(
      status: CustomerSessionStatus.cached,
      profile: profile,
      addresses: addresses,
      wallet: wallet,
      deliveryRules: deliveryRules,
    );
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_profileKey);
    await prefs.remove(_addressesKey);
    await prefs.remove(_walletKey);
    await prefs.remove(_deliveryRulesKey);
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
    };
  }
}
