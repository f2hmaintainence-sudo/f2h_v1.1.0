import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';
import 'package:f2h_delivery/core/api/api_error.dart';

abstract class ProfileRemoteDataSource {
  Future<ProfileModel> fetchPersonalInfo();
  Future<void> updatePersonalInfo(Map<String, dynamic> data);
  Future<String> uploadProfilePhoto(dynamic fileOrBytes, {String? filename});

  Future<List<DocumentModel>> fetchDocuments();
  Future<void> addDocument(
    Map<String, dynamic> data, {
    File? frontFile,
    File? backFile,
  });
  Future<void> updateDocument(
    String id,
    Map<String, dynamic> data, {
    File? frontFile,
    File? backFile,
  });
  Future<void> deleteDocument(String id);

  Future<List<VehicleModel>> fetchVehicles();
  Future<void> addVehicle(
    Map<String, dynamic> data, {
    File? rcFrontFile,
    File? rcBackFile,
    File? insuranceFile,
  });
  Future<void> updateVehicle(
    String id,
    Map<String, dynamic> data, {
    File? rcFrontFile,
    File? rcBackFile,
    File? insuranceFile,
  });
  Future<void> deleteVehicle(String id);

  Future<List<BankAccountModel>> fetchBankAccounts();
  Future<void> addBankAccount(Map<String, dynamic> data, {File? chequeFile});
  Future<void> updateBankAccount(
    String id,
    Map<String, dynamic> data, {
    File? chequeFile,
  });
  Future<void> deleteBankAccount(String id);

  Future<Map<String, dynamic>> fetchPreferences();
  Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> prefs);

  Future<Map<String, dynamic>> fetchActivity();

  Future<Map<String, dynamic>> fetchAttendance(int year, int month);
  Future<Map<String, dynamic>> fetchAttendanceDayDetails(String date);
  Future<Map<String, dynamic>> fetchLeaderboard(int year, int month);

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  );
  Future<void> logoutAllDevices();

  Future<List<Map<String, dynamic>>> fetchLeaveRequests();
  Future<void> createLeaveRequest(Map<String, dynamic> data);
  Future<void> cancelLeaveRequest(String id);
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  final DioClient dioClient;

  ProfileRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<ProfileModel> fetchPersonalInfo() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profilePersonal);
      return ProfileModel.fromJson(response.data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch personal info');
    }
  }

  @override
  Future<void> updatePersonalInfo(Map<String, dynamic> data) async {
    try {
      await dioClient.dio.patch(ApiEndpoints.profilePersonal, data: data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to update personal info');
    }
  }

  @override
  Future<String> uploadProfilePhoto(dynamic fileOrBytes, {String? filename}) async {
    try {
      MultipartFile multipartFile;
      if (fileOrBytes is Uint8List) {
        multipartFile = MultipartFile.fromBytes(
          fileOrBytes,
          filename: filename ?? 'profile_${DateTime.now().millisecondsSinceEpoch}.png',
        );
      } else if (fileOrBytes is File) {
        multipartFile = await MultipartFile.fromFile(
          fileOrBytes.path,
          filename: filename ?? fileOrBytes.path.split('/').last,
        );
      } else if (fileOrBytes is List<int>) {
        multipartFile = MultipartFile.fromBytes(
          fileOrBytes,
          filename: filename ?? 'profile_${DateTime.now().millisecondsSinceEpoch}.png',
        );
      } else {
        throw Exception('Invalid file data provided');
      }

      final formData = FormData.fromMap({
        'file': multipartFile,
      });
      final response = await dioClient.dio.post(
        ApiEndpoints.profilePhoto,
        data: formData,
      );
      return response.data['url'] ?? '';
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to upload profile photo');
    }
  }

  @override
  Future<List<DocumentModel>> fetchDocuments() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profileDocs);
      final List list = response.data as List;
      return list.map((json) => DocumentModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch documents');
    }
  }

  @override
  Future<void> addDocument(
    Map<String, dynamic> data, {
    File? frontFile,
    File? backFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (frontFile != null) {
        map['front_image'] = await MultipartFile.fromFile(
          frontFile.path,
          filename: frontFile.path.split('/').last,
        );
      }
      if (backFile != null) {
        map['back_image'] = await MultipartFile.fromFile(
          backFile.path,
          filename: backFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.post(ApiEndpoints.profileDocs, data: formData);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to add document');
    }
  }

  @override
  Future<void> updateDocument(
    String id,
    Map<String, dynamic> data, {
    File? frontFile,
    File? backFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (frontFile != null) {
        map['front_image'] = await MultipartFile.fromFile(
          frontFile.path,
          filename: frontFile.path.split('/').last,
        );
      }
      if (backFile != null) {
        map['back_image'] = await MultipartFile.fromFile(
          backFile.path,
          filename: backFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.patch(
        ApiEndpoints.profileDocItem(id),
        data: formData,
      );
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to update document');
    }
  }

  @override
  Future<void> deleteDocument(String id) async {
    try {
      await dioClient.dio.delete(ApiEndpoints.profileDocItem(id));
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to delete document');
    }
  }

  @override
  Future<List<VehicleModel>> fetchVehicles() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profileVehicles);
      final List list = response.data as List;
      return list.map((json) => VehicleModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch vehicles');
    }
  }

  @override
  Future<void> addVehicle(
    Map<String, dynamic> data, {
    File? rcFrontFile,
    File? rcBackFile,
    File? insuranceFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (rcFrontFile != null) {
        map['rc_front_image'] = await MultipartFile.fromFile(
          rcFrontFile.path,
          filename: rcFrontFile.path.split('/').last,
        );
      }
      if (rcBackFile != null) {
        map['rc_back_image'] = await MultipartFile.fromFile(
          rcBackFile.path,
          filename: rcBackFile.path.split('/').last,
        );
      }
      if (insuranceFile != null) {
        map['insurance_image'] = await MultipartFile.fromFile(
          insuranceFile.path,
          filename: insuranceFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.post(ApiEndpoints.profileVehicles, data: formData);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to add vehicle');
    }
  }

  @override
  Future<void> updateVehicle(
    String id,
    Map<String, dynamic> data, {
    File? rcFrontFile,
    File? rcBackFile,
    File? insuranceFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (rcFrontFile != null) {
        map['rc_front_image'] = await MultipartFile.fromFile(
          rcFrontFile.path,
          filename: rcFrontFile.path.split('/').last,
        );
      }
      if (rcBackFile != null) {
        map['rc_back_image'] = await MultipartFile.fromFile(
          rcBackFile.path,
          filename: rcBackFile.path.split('/').last,
        );
      }
      if (insuranceFile != null) {
        map['insurance_image'] = await MultipartFile.fromFile(
          insuranceFile.path,
          filename: insuranceFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.patch(
        ApiEndpoints.profileVehicleItem(id),
        data: formData,
      );
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to update vehicle');
    }
  }

  @override
  Future<void> deleteVehicle(String id) async {
    try {
      await dioClient.dio.delete(ApiEndpoints.profileVehicleItem(id));
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to delete vehicle');
    }
  }

  @override
  Future<List<BankAccountModel>> fetchBankAccounts() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profileBank);
      final List list = response.data as List;
      return list.map((json) => BankAccountModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch bank accounts');
    }
  }

  @override
  Future<void> addBankAccount(
    Map<String, dynamic> data, {
    File? chequeFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (chequeFile != null) {
        map['cancelled_cheque_image'] = await MultipartFile.fromFile(
          chequeFile.path,
          filename: chequeFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.post(ApiEndpoints.profileBank, data: formData);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to add bank account');
    }
  }

  @override
  Future<void> updateBankAccount(
    String id,
    Map<String, dynamic> data, {
    File? chequeFile,
  }) async {
    try {
      final Map<String, dynamic> map = {...data};
      if (chequeFile != null) {
        map['cancelled_cheque_image'] = await MultipartFile.fromFile(
          chequeFile.path,
          filename: chequeFile.path.split('/').last,
        );
      }
      final formData = FormData.fromMap(map);
      await dioClient.dio.patch(
        ApiEndpoints.profileBankItem(id),
        data: formData,
      );
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to update bank account');
    }
  }

  @override
  Future<void> deleteBankAccount(String id) async {
    try {
      await dioClient.dio.delete(ApiEndpoints.profileBankItem(id));
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to delete bank account');
    }
  }

  @override
  Future<Map<String, dynamic>> fetchPreferences() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profilePrefs);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch preferences');
    }
  }

  @override
  Future<Map<String, dynamic>> updatePreferences(
    Map<String, dynamic> prefs,
  ) async {
    try {
      final response = await dioClient.dio.patch(
        ApiEndpoints.profilePrefs,
        data: prefs,
      );
      return response.data['preferences'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to update preferences');
    }
  }

  @override
  Future<Map<String, dynamic>> fetchActivity() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profileActivity);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch activity');
    }
  }

  @override
  Future<void> changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    try {
      await dioClient.dio.post(
        ApiEndpoints.profileChangePass,
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
          'confirm_password': confirmPassword,
        },
      );
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to change password');
    }
  }

  @override
  Future<void> logoutAllDevices() async {
    try {
      await dioClient.dio.post(ApiEndpoints.profileLogoutAll);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to logout from all devices');
    }
  }

  @override
  Future<Map<String, dynamic>> fetchAttendance(int year, int month) async {
    try {
      final response = await dioClient.dio.get(
        ApiEndpoints.profileAttendance,
        queryParameters: {'year': year, 'month': month},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch attendance');
    }
  }

  @override
  Future<Map<String, dynamic>> fetchAttendanceDayDetails(String date) async {
    try {
      final response = await dioClient.dio.get(
        ApiEndpoints.profileAttendanceDayDetails,
        queryParameters: {'date': date},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch attendance details');
    }
  }

  @override
  Future<Map<String, dynamic>> fetchLeaderboard(int year, int month) async {
    try {
      final response = await dioClient.dio.get(
        ApiEndpoints.profileLeaderboard,
        queryParameters: {'year': year, 'month': month},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch leaderboard');
    }
  }

  @override
  Future<List<Map<String, dynamic>>> fetchLeaveRequests() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.profileLeaveRequests);
      final data = response.data;
      if (data is List) {
        return data.cast<Map<String, dynamic>>();
      }
      return [];
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to fetch leave requests');
    }
  }

  @override
  Future<void> createLeaveRequest(Map<String, dynamic> data) async {
    try {
      await dioClient.dio.post(ApiEndpoints.profileLeaveRequests, data: data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to submit leave request');
    }
  }

  @override
  Future<void> cancelLeaveRequest(String id) async {
    try {
      await dioClient.dio.delete(ApiEndpoints.profileLeaveRequestItem(id));
    } on DioException catch (e) {
      throw apiErrorMessage(e, 'Failed to cancel leave request');
    }
  }
}
