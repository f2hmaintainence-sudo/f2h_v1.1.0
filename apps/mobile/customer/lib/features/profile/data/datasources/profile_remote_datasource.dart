import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';

abstract class ProfileRemoteDataSource {
  Future<ProfileModel> getProfile();
  Future<List<dynamic>> getWalletTransactions();
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  final DioClient dioClient;
  ProfileRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<ProfileModel> getProfile() async {
    final response = await dioClient.dio.get(ApiEndpoints.customerBootstrap);
    if (response.data != null && response.data['profile'] != null) {
      return ProfileModel.fromJson(Map<String, dynamic>.from(response.data['profile'] as Map));
    }
    throw Exception('Failed to load profile data');
  }

  @override
  Future<List<dynamic>> getWalletTransactions() async {
    final response = await dioClient.dio.get(ApiEndpoints.walletTransactions);
    if (response.data != null && response.data['data'] != null) {
      return response.data['data'] as List<dynamic>;
    }
    return [];
  }
}
