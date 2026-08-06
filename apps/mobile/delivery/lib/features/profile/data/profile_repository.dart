import 'dart:io';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/data/datasources/profile_remote_datasource.dart';

class ProfileRepository {
  final ProfileRemoteDataSource remoteDataSource;

  ProfileRepository(this.remoteDataSource);

  Future<ProfileModel> fetchProfile() async {
    return remoteDataSource.fetchPersonalInfo();
  }

  Future<void> updatePersonalInfo(Map<String, dynamic> data) async {
    return remoteDataSource.updatePersonalInfo(data);
  }

  Future<String> uploadProfilePhoto(File file) async {
    return remoteDataSource.uploadProfilePhoto(file);
  }

  Future<List<DocumentModel>> fetchDocuments() async {
    return remoteDataSource.fetchDocuments();
  }

  Future<void> addDocument(Map<String, dynamic> data, {File? frontFile, File? backFile}) async {
    return remoteDataSource.addDocument(data, frontFile: frontFile, backFile: backFile);
  }

  Future<void> updateDocument(String id, Map<String, dynamic> data, {File? frontFile, File? backFile}) async {
    return remoteDataSource.updateDocument(id, data, frontFile: frontFile, backFile: backFile);
  }

  Future<void> deleteDocument(String id) async {
    return remoteDataSource.deleteDocument(id);
  }

  Future<List<VehicleModel>> fetchVehicles() async {
    return remoteDataSource.fetchVehicles();
  }

  Future<void> addVehicle(Map<String, dynamic> data, {File? rcFrontFile, File? rcBackFile, File? insuranceFile}) async {
    return remoteDataSource.addVehicle(data, rcFrontFile: rcFrontFile, rcBackFile: rcBackFile, insuranceFile: insuranceFile);
  }

  Future<void> updateVehicle(String id, Map<String, dynamic> data, {File? rcFrontFile, File? rcBackFile, File? insuranceFile}) async {
    return remoteDataSource.updateVehicle(id, data, rcFrontFile: rcFrontFile, rcBackFile: rcBackFile, insuranceFile: insuranceFile);
  }

  Future<void> deleteVehicle(String id) async {
    return remoteDataSource.deleteVehicle(id);
  }

  Future<List<BankAccountModel>> fetchBankAccounts() async {
    return remoteDataSource.fetchBankAccounts();
  }

  Future<void> addBankAccount(Map<String, dynamic> data, {File? chequeFile}) async {
    return remoteDataSource.addBankAccount(data, chequeFile: chequeFile);
  }

  Future<void> updateBankAccount(String id, Map<String, dynamic> data, {File? chequeFile}) async {
    return remoteDataSource.updateBankAccount(id, data, chequeFile: chequeFile);
  }

  Future<void> deleteBankAccount(String id) async {
    return remoteDataSource.deleteBankAccount(id);
  }

  Future<Map<String, dynamic>> fetchPreferences() async {
    return remoteDataSource.fetchPreferences();
  }

  Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> prefs) async {
    return remoteDataSource.updatePreferences(prefs);
  }

  Future<Map<String, dynamic>> fetchActivity() async {
    return remoteDataSource.fetchActivity();
  }

  Future<void> changePassword(String currentPassword, String newPassword, String confirmPassword) async {
    return remoteDataSource.changePassword(currentPassword, newPassword, confirmPassword);
  }

  Future<void> logoutAllDevices() async {
    return remoteDataSource.logoutAllDevices();
  }

  Future<Map<String, dynamic>> fetchAttendance(int year, int month) async {
    return remoteDataSource.fetchAttendance(year, month);
  }

  Future<Map<String, dynamic>> fetchAttendanceDayDetails(String date) async {
    return remoteDataSource.fetchAttendanceDayDetails(date);
  }

  Future<Map<String, dynamic>> fetchLeaderboard(int year, int month) async {
    return remoteDataSource.fetchLeaderboard(year, month);
  }

  Future<List<Map<String, dynamic>>> fetchLeaveRequests() async {
    return remoteDataSource.fetchLeaveRequests();
  }

  Future<void> createLeaveRequest(Map<String, dynamic> data) async {
    return remoteDataSource.createLeaveRequest(data);
  }

  Future<void> cancelLeaveRequest(String id) async {
    return remoteDataSource.cancelLeaveRequest(id);
  }
}
