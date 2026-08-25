import 'package:isar_db/isar_db.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';

part 'user_model.g.dart';

@collection
class UserModel {
  Id id = Isar.autoIncrement;

  final String userId;

  final String email;

  final bool mustChangePassword;

  final String? token;

  final String? refreshToken;

  final DateTime? cachedAt;

  UserModel({
    required this.userId,
    required this.email,
    this.mustChangePassword = false,
    this.token,
    this.refreshToken,
    this.cachedAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      email: json['email'] ?? '',
      mustChangePassword: json['must_change_password'] ?? json['mustChangePassword'] ?? false,
      token: json['accessToken'] ?? json['token'],
      refreshToken: json['refreshToken'],
      cachedAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'email': email,
      'must_change_password': mustChangePassword,
      'token': token,
      'refreshToken': refreshToken,
      'cachedAt': cachedAt?.toIso8601String(),
    };
  }

  User toEntity() {
    return User(
      userId: userId,
      email: email,
      mustChangePassword: mustChangePassword,
      token: token,
      cachedAt: cachedAt,
    );
  }

  factory UserModel.fromEntity(User user) {
    return UserModel(
      userId: user.userId,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      token: user.token,
      cachedAt: user.cachedAt,
    );
  }
}
