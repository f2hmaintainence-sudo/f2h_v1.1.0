import 'package:f2h_customer/features/profile/domain/repositories/profile_repository.dart';
import 'package:f2h_customer/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  final ProfileRemoteDataSource remoteDataSource;
  ProfileRepositoryImpl({required this.remoteDataSource});

  @override
  Future<ProfileModel> getProfile() {
    return remoteDataSource.getProfile();
  }

  @override
  Future<List<dynamic>> getWalletTransactions() {
    return remoteDataSource.getWalletTransactions();
  }
}
