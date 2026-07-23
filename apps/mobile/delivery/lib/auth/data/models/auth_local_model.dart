import 'package:isar/isar.dart';

part 'auth_local_model.g.dart';

@collection
class AuthLocalModel {
  Id id = Isar.autoIncrement;

  String userId = '';
  String email = '';
  bool mustChangePassword = false;
  String? token;
  DateTime? cachedAt;

  AuthLocalModel();
}
