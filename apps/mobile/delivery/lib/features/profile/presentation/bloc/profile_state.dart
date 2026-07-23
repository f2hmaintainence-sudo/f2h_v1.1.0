import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';

abstract class ProfileState {}

class ProfileInitial extends ProfileState {}

class ProfileLoading extends ProfileState {}

class ProfileLoaded extends ProfileState {
  final ProfileModel profile;
  final List<DocumentModel> documents;
  final List<VehicleModel> vehicles;
  final List<BankAccountModel> bankAccounts;
  final Map<String, dynamic> preferences;
  final Map<String, dynamic> activity;
  final String? successMessage;
  final String? errorMessage;
  final bool isOffline;
  final List<Map<String, dynamic>> leaveRequests;

  ProfileLoaded({
    required this.profile,
    this.documents = const [],
    this.vehicles = const [],
    this.bankAccounts = const [],
    this.preferences = const {},
    this.activity = const {},
    this.successMessage,
    this.errorMessage,
    this.isOffline = false,
    this.leaveRequests = const [],
  });

  ProfileLoaded copyWith({
    ProfileModel? profile,
    List<DocumentModel>? documents,
    List<VehicleModel>? vehicles,
    List<BankAccountModel>? bankAccounts,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? activity,
    String? successMessage,
    String? errorMessage,
    bool? isOffline,
    List<Map<String, dynamic>>? leaveRequests,
  }) {
    return ProfileLoaded(
      profile: profile ?? this.profile,
      documents: documents ?? this.documents,
      vehicles: vehicles ?? this.vehicles,
      bankAccounts: bankAccounts ?? this.bankAccounts,
      preferences: preferences ?? this.preferences,
      activity: activity ?? this.activity,
      successMessage: successMessage,
      errorMessage: errorMessage,
      isOffline: isOffline ?? this.isOffline,
      leaveRequests: leaveRequests ?? this.leaveRequests,
    );
  }
}

class ProfileError extends ProfileState {
  final String message;
  ProfileError(this.message);
}
