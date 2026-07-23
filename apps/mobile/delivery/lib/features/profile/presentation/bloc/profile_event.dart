import 'dart:io';

abstract class ProfileEvent {}

class FetchProfileEvent extends ProfileEvent {}

class UpdatePersonalInfoEvent extends ProfileEvent {
  final Map<String, dynamic> data;
  UpdatePersonalInfoEvent(this.data);
}

class UploadProfilePhotoEvent extends ProfileEvent {
  final File file;
  UploadProfilePhotoEvent(this.file);
}

class FetchDocumentsEvent extends ProfileEvent {}

class AddDocumentEvent extends ProfileEvent {
  final Map<String, dynamic> data;
  final File? frontFile;
  final File? backFile;
  AddDocumentEvent(this.data, {this.frontFile, this.backFile});
}

class UpdateDocumentEvent extends ProfileEvent {
  final String id;
  final Map<String, dynamic> data;
  final File? frontFile;
  final File? backFile;
  UpdateDocumentEvent(this.id, this.data, {this.frontFile, this.backFile});
}

class DeleteDocumentEvent extends ProfileEvent {
  final String id;
  DeleteDocumentEvent(this.id);
}

class FetchVehiclesEvent extends ProfileEvent {}

class AddVehicleEvent extends ProfileEvent {
  final Map<String, dynamic> data;
  final File? rcFrontFile;
  final File? rcBackFile;
  final File? insuranceFile;
  AddVehicleEvent(this.data, {this.rcFrontFile, this.rcBackFile, this.insuranceFile});
}

class UpdateVehicleEvent extends ProfileEvent {
  final String id;
  final Map<String, dynamic> data;
  final File? rcFrontFile;
  final File? rcBackFile;
  final File? insuranceFile;
  UpdateVehicleEvent(this.id, this.data, {this.rcFrontFile, this.rcBackFile, this.insuranceFile});
}

class DeleteVehicleEvent extends ProfileEvent {
  final String id;
  DeleteVehicleEvent(this.id);
}

class FetchBankAccountsEvent extends ProfileEvent {}

class AddBankAccountEvent extends ProfileEvent {
  final Map<String, dynamic> data;
  final File? chequeFile;
  AddBankAccountEvent(this.data, {this.chequeFile});
}

class UpdateBankAccountEvent extends ProfileEvent {
  final String id;
  final Map<String, dynamic> data;
  final File? chequeFile;
  UpdateBankAccountEvent(this.id, this.data, {this.chequeFile});
}

class DeleteBankAccountEvent extends ProfileEvent {
  final String id;
  DeleteBankAccountEvent(this.id);
}

class FetchPreferencesEvent extends ProfileEvent {}

class UpdatePreferencesEvent extends ProfileEvent {
  final Map<String, dynamic> prefs;
  UpdatePreferencesEvent(this.prefs);
}

class FetchActivityEvent extends ProfileEvent {}

class ChangePasswordEvent extends ProfileEvent {
  final String currentPassword;
  final String newPassword;
  final String confirmPassword;
  ChangePasswordEvent({
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
  });
}

class LogoutAllDevicesEvent extends ProfileEvent {}

class FetchLeaveRequestsEvent extends ProfileEvent {}

class SubmitLeaveRequestEvent extends ProfileEvent {
  final String leaveDate;
  final String? endDate;
  final String leaveType;
  final String? halfDayShift;
  final String? reason;
  SubmitLeaveRequestEvent({
    required this.leaveDate,
    this.endDate,
    required this.leaveType,
    this.halfDayShift,
    this.reason,
  });
}

class CancelLeaveRequestEvent extends ProfileEvent {
  final String id;
  CancelLeaveRequestEvent(this.id);
}
