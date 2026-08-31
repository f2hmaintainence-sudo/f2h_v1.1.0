import 'package:dio/dio.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';
import 'package:f2h_customer/features/catalog/data/models/today_delivery_partner_model.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';

class CustomerBootstrapApi {
  final DioClient dioClient;

  CustomerBootstrapApi({required this.dioClient});

  Future<CustomerSessionState> fetch() async {
    final response = await dioClient.dio.get(ApiEndpoints.customerBootstrap);
    final data = Map<String, dynamic>.from(response.data as Map);
    final profile = ProfileModel.fromJson(
      Map<String, dynamic>.from(data['profile'] as Map? ?? {}),
    );
    final addresses = (data['addresses'] as List? ?? [])
        .map((e) => AddressModel.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    final todayPartners = (data['today_delivery_partners'] as List? ?? [])
        .map((e) =>
            TodayDeliveryPartner.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();

    return CustomerSessionState(
      status: CustomerSessionStatus.ready,
      profile: profile,
      addresses: addresses,
      wallet: Map<String, dynamic>.from(data['wallet'] as Map? ?? {}),
      subscriptionSummary: Map<String, dynamic>.from(
        data['subscription_summary'] as Map? ?? {},
      ),
      branches: data['branches'] as List? ?? [],
      notificationsCount: int.tryParse(
            data['notifications_count']?.toString() ?? '',
          ) ??
          0,
      deliveryRules: Map<String, dynamic>.from(
        data['delivery_rules'] as Map? ?? {},
      ),
      slotTimings: Map<String, dynamic>.from(
        data['slot_timings'] as Map? ?? {},
      ),
      todayDeliveryPartners: todayPartners,
    );
  }

  Future<List<TodayDeliveryPartner>> fetchTodayDeliveryPartners() async {
    try {
      final response =
          await dioClient.dio.get(ApiEndpoints.todayDeliveryPartners);
      final data = Map<String, dynamic>.from(response.data as Map);
      return (data['delivery_partners'] as List? ?? [])
          .map((e) =>
              TodayDeliveryPartner.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> updateProfile(Map<String, dynamic> payload) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.patch('${ApiEndpoints.customerBootstrap}/profile', data: payload);
  }

  Future<void> addAddress(Map<String, dynamic> payload) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.post('${ApiEndpoints.customerBootstrap}/address', data: payload);
  }

  Future<void> updateAddress(String addressId, Map<String, dynamic> payload) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.patch('${ApiEndpoints.customerBootstrap}/address/$addressId', data: payload);
  }

  Future<void> deleteAddress(String addressId) async {
    await dioClient.fetchCsrfToken();
    await dioClient.dio.delete('${ApiEndpoints.customerBootstrap}/address/$addressId');
  }

  static bool isUnauthorized(Object error) {
    return error is DioException && error.response?.statusCode == 401;
  }

  static bool isNetworkFailure(Object error) {
    return error is DioException && error.response == null;
  }
}
