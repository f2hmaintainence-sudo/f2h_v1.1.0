import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';

class UserModel extends User {
  const UserModel({
    required super.userId,
    required super.email,
    super.mustChangePassword,
    super.token,
    super.refreshToken,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      email: json['email'] ?? '',
      mustChangePassword: json['must_change_password'] ?? json['mustChangePassword'] ?? false,
      token: json['accessToken'] ?? json['token'],
      refreshToken: json['refreshToken'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'email': email,
      'must_change_password': mustChangePassword,
      'token': token,
      'refreshToken': refreshToken,
    };
  }
}
