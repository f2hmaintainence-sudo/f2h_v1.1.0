import 'package:f2h_delivery/auth/data/models/user_model.dart';
export 'auth_local_datasource_mobile.dart' if (dart.library.html) 'auth_local_datasource_web.dart';

abstract class AuthLocalDataSource {
  Future<void> cacheUser(UserModel user);
  Future<UserModel?> getCachedUser();
  Future<void> clearCache();
}
