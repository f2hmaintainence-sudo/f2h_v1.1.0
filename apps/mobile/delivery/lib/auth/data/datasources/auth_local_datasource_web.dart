import 'package:f2h_delivery/auth/data/models/user_model.dart';
import 'auth_local_datasource.dart';

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  UserModel? _memoryUser;

  AuthLocalDataSourceImpl({dynamic isar});

  @override
  Future<void> cacheUser(UserModel user) async {
    _memoryUser = user;
  }

  @override
  Future<UserModel?> getCachedUser() async {
    return _memoryUser;
  }

  @override
  Future<void> clearCache() async {
    _memoryUser = null;
  }
}
