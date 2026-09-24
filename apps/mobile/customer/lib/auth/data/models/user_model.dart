import 'package:isar_community/isar.dart';
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

  @ignore
  final bool isNewUser;

  @ignore
  final bool needsAddress;

  UserModel({
    required this.userId,
    required this.email,
    this.mustChangePassword = false,
    this.token,
    this.refreshToken,
    this.cachedAt,
    this.isNewUser = false,
    this.needsAddress = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final isNew = json['is_new_user'] == true || json['isNewUser'] == true;
    final hasAddr = json['has_address'] == true || json['hasAddress'] == true;
    final needsAddr = json['needs_address'] == true ||
        json['needsAddress'] == true ||
        isNew ||
        (json.containsKey('has_address') && !hasAddr);

    return UserModel(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      email: json['email'] ?? '',
      mustChangePassword: json['must_change_password'] ?? json['mustChangePassword'] ?? false,
      token: json['accessToken'] ?? json['token'] ?? json['access_token'],
      refreshToken: json['refreshToken'] ?? json['refresh_token'],
      cachedAt: DateTime.now(),
      isNewUser: isNew,
      needsAddress: needsAddr,
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
      'is_new_user': isNewUser,
      'needs_address': needsAddress,
    };
  }

  User toEntity() {
    return User(
      userId: userId,
      email: email,
      mustChangePassword: mustChangePassword,
      token: token,
      cachedAt: cachedAt,
      isNewUser: isNewUser,
      needsAddress: needsAddress,
    );
  }

  factory UserModel.fromEntity(User user) {
    return UserModel(
      userId: user.userId,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      token: user.token,
      cachedAt: user.cachedAt,
      isNewUser: user.isNewUser,
      needsAddress: user.needsAddress,
    );
  }
}
