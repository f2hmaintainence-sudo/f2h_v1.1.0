import 'package:f2h_customer/features/profile/data/models/profile_model.dart';

abstract class ProfileRepository {
  Future<ProfileModel> getProfile();
  Future<List<dynamic>> getWalletTransactions();
}
