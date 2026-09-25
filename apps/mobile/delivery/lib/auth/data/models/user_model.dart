import 'package:f2h_delivery/auth/domain/entities/user_entity.dart';

class UserModel extends User {
  const UserModel({
    required super.userId,
    required super.email,
    super.phone,
    super.mustChangePassword,
    super.isNewUser,
    super.token,
    super.refreshToken,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      email: json['email']?.toString() ?? json['phone']?.toString() ?? '',
      phone: json['phone']?.toString(),
      mustChangePassword: json['must_change_password'] ?? json['mustChangePassword'] ?? false,
      isNewUser: json['is_new_user'] == true,
      token: json['accessToken'] ?? json['token'],
      refreshToken: json['refreshToken'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'email': email,
      'phone': phone,
      'must_change_password': mustChangePassword,
      'is_new_user': isNewUser,
      'token': token,
      'refreshToken': refreshToken,
    };
  }
}
