import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ProfileRepository repository;

  ProfileBloc(this.repository) : super(ProfileInitial()) {
    on<FetchProfileEvent>((event, emit) async {
      // 1. Try to load cached data first
      ProfileModel? cachedProfile;
      List<DocumentModel> cachedDocuments = const [];
      List<VehicleModel> cachedVehicles = const [];
      List<BankAccountModel> cachedBankAccounts = const [];
      bool hasCache = false;

      try {
        final prefs = await SharedPreferences.getInstance();
        final cachedProfileStr = prefs.getString('cached_profile');
        if (cachedProfileStr != null) {
          cachedProfile = ProfileModel.fromJson(jsonDecode(cachedProfileStr));
          
          final docsStr = prefs.getString('cached_documents');
          if (docsStr != null) {
            cachedDocuments = (jsonDecode(docsStr) as List).map((e) => DocumentModel.fromJson(e)).toList();
          }

          final vehStr = prefs.getString('cached_vehicles');
          if (vehStr != null) {
            cachedVehicles = (jsonDecode(vehStr) as List).map((e) => VehicleModel.fromJson(e)).toList();
          }

          final bankStr = prefs.getString('cached_bank_accounts');
          if (bankStr != null) {
            cachedBankAccounts = (jsonDecode(bankStr) as List).map((e) => BankAccountModel.fromJson(e)).toList();
          }
          hasCache = true;
        }
      } catch (e) {
        print('[ProfileBloc] FetchProfileEvent: Error reading initial cache: $e');
      }

      // If cache exists, show it immediately (so no spinner/loader is shown)
      if (hasCache && cachedProfile != null) {
        print('[ProfileBloc] FetchProfileEvent: Cache found! Showing cached data first.');
        emit(ProfileLoaded(
          profile: cachedProfile,
          documents: cachedDocuments,
          vehicles: cachedVehicles,
          bankAccounts: cachedBankAccounts,
          isOffline: true, // Mark as offline/cached first
        ));
      } else {
        // No cache found, show loading spinner while fetching
        print('[ProfileBloc] FetchProfileEvent: No cache found. Showing spinner.');
        emit(ProfileLoading());
      }

      // 2. Fetch fresh data from network in background
      try {
        print('[ProfileBloc] FetchProfileEvent: Fetching personal info from network...');
        final profile = await repository.fetchProfile();
        print('[ProfileBloc] FetchProfileEvent: Network personal info success!');
        
        List<DocumentModel> documents = const [];
        try { documents = await repository.fetchDocuments(); } catch (_) {}
        
        List<VehicleModel> vehicles = const [];
        try { vehicles = await repository.fetchVehicles(); } catch (_) {}
        
        List<BankAccountModel> bankAccounts = const [];
        try { bankAccounts = await repository.fetchBankAccounts(); } catch (_) {}
        
        Map<String, dynamic> preferences = const {};
        try { preferences = await repository.fetchPreferences(); } catch (_) {}
        
        Map<String, dynamic> activity = const {};
        try { activity = await repository.fetchActivity(); } catch (_) {}

        // Cache the newly loaded data
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('cached_profile', jsonEncode(profile.toJson()));
          await prefs.setString('cached_documents', jsonEncode(documents.map((e) => e.toJson()).toList()));
          await prefs.setString('cached_vehicles', jsonEncode(vehicles.map((e) => e.toJson()).toList()));
          await prefs.setString('cached_bank_accounts', jsonEncode(bankAccounts.map((e) => e.toJson()).toList()));
          print('[ProfileBloc] FetchProfileEvent: Caching updated network data complete');
        } catch (e) {
          print('[ProfileBloc] FetchProfileEvent: Caching network data failed: $e');
        }

        // Emit updated online state
        print('[ProfileBloc] FetchProfileEvent: Emitting fresh network ProfileLoaded');
        emit(ProfileLoaded(
          profile: profile,
          documents: documents,
          vehicles: vehicles,
          bankAccounts: bankAccounts,
          preferences: preferences,
          activity: activity,
          isOffline: false,
        ));
      } catch (e) {
        print('[ProfileBloc] FetchProfileEvent: Network request failed: $e');
        // If we didn't have cached data to show initially, fallback to empty profile screen
        if (!hasCache) {
          print('[ProfileBloc] FetchProfileEvent: No cache was available. Emitting empty profile screen.');
          emit(ProfileLoaded(
            profile: ProfileModel.empty(),
            documents: const [],
            vehicles: const [],
            bankAccounts: const [],
            isOffline: true,
          ));
        } else {
          // Keep showing the cached data we already emitted. Optionally update the banner.
          print('[ProfileBloc] FetchProfileEvent: Retaining already shown cache.');
        }
      }
    });

    on<UpdatePersonalInfoEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.updatePersonalInfo(event.data);
          final updatedProfile = await repository.fetchProfile();
          emit(currentState.copyWith(
            profile: updatedProfile,
            successMessage: 'Personal details updated successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UploadProfilePhotoEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final photoUrl = await repository.uploadProfilePhoto(event.file);
          final updatedProfile = currentState.profile.copyWith(profilePhotoUrl: photoUrl);
          emit(currentState.copyWith(
            profile: updatedProfile,
            successMessage: 'Profile photo uploaded successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<ClearProfileMessageEvent>((event, emit) {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(currentState.copyWith(successMessage: null));
      }
    });

    on<FetchDocumentsEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final documents = await repository.fetchDocuments();
          emit(currentState.copyWith(documents: documents));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<AddDocumentEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.addDocument(event.data, frontFile: event.frontFile, backFile: event.backFile);
          final documents = await repository.fetchDocuments();
          emit(currentState.copyWith(
            documents: documents,
            successMessage: 'Document uploaded for verification successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UpdateDocumentEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.updateDocument(event.id, event.data, frontFile: event.frontFile, backFile: event.backFile);
          final documents = await repository.fetchDocuments();
          emit(currentState.copyWith(
            documents: documents,
            successMessage: 'Document updated successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<DeleteDocumentEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.deleteDocument(event.id);
          final documents = await repository.fetchDocuments();
          emit(currentState.copyWith(
            documents: documents,
            successMessage: 'Document removed successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<FetchVehiclesEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final vehicles = await repository.fetchVehicles();
          emit(currentState.copyWith(vehicles: vehicles));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<AddVehicleEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.addVehicle(event.data,
              rcFrontFile: event.rcFrontFile, rcBackFile: event.rcBackFile, insuranceFile: event.insuranceFile);
          final vehicles = await repository.fetchVehicles();
          emit(currentState.copyWith(
            vehicles: vehicles,
            successMessage: 'Vehicle registered for verification successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UpdateVehicleEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.updateVehicle(event.id, event.data,
              rcFrontFile: event.rcFrontFile, rcBackFile: event.rcBackFile, insuranceFile: event.insuranceFile);
          final vehicles = await repository.fetchVehicles();
          emit(currentState.copyWith(
            vehicles: vehicles,
            successMessage: 'Vehicle details updated successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<DeleteVehicleEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.deleteVehicle(event.id);
          final vehicles = await repository.fetchVehicles();
          emit(currentState.copyWith(
            vehicles: vehicles,
            successMessage: 'Vehicle removed successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<FetchBankAccountsEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final bankAccounts = await repository.fetchBankAccounts();
          emit(currentState.copyWith(bankAccounts: bankAccounts));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<AddBankAccountEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.addBankAccount(event.data, chequeFile: event.chequeFile);
          final bankAccounts = await repository.fetchBankAccounts();
          emit(currentState.copyWith(
            bankAccounts: bankAccounts,
            successMessage: 'Bank account added successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UpdateBankAccountEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.updateBankAccount(event.id, event.data, chequeFile: event.chequeFile);
          final bankAccounts = await repository.fetchBankAccounts();
          emit(currentState.copyWith(
            bankAccounts: bankAccounts,
            successMessage: 'Bank details updated successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<DeleteBankAccountEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.deleteBankAccount(event.id);
          final bankAccounts = await repository.fetchBankAccounts();
          emit(currentState.copyWith(
            bankAccounts: bankAccounts,
            successMessage: 'Bank account removed successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<FetchPreferencesEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final preferences = await repository.fetchPreferences();
          emit(currentState.copyWith(preferences: preferences));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UpdatePreferencesEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final updatedPrefs = await repository.updatePreferences(event.prefs);
          emit(currentState.copyWith(
            preferences: updatedPrefs,
            successMessage: 'Preferences updated successfully',
          ));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<FetchActivityEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          final activity = await repository.fetchActivity();
          emit(currentState.copyWith(activity: activity));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<ChangePasswordEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.changePassword(event.currentPassword, event.newPassword, event.confirmPassword);
          emit(currentState.copyWith(successMessage: 'Password changed successfully'));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<LogoutAllDevicesEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.logoutAllDevices();
          emit(currentState.copyWith(successMessage: 'Successfully logged out from all other devices'));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<FetchLeaveRequestsEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        try {
          final leaveRequests = await repository.fetchLeaveRequests();
          emit(currentState.copyWith(leaveRequests: leaveRequests));
        } catch (e) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<SubmitLeaveRequestEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.createLeaveRequest({
            'leave_date': event.leaveDate,
            if (event.endDate != null) 'end_date': event.endDate,
            'leave_type': event.leaveType,
            if (event.halfDayShift != null) 'half_day_shift': event.halfDayShift,
            if (event.reason != null && event.reason!.isNotEmpty) 'reason': event.reason,
          });
          final leaveRequests = await repository.fetchLeaveRequests();
          emit(currentState.copyWith(
            leaveRequests: leaveRequests,
            successMessage: 'Leave request submitted successfully',
          ));
        } catch (e) {
          emit(currentState.copyWith(errorMessage: e.toString()));
        }
      }
    });

    on<CancelLeaveRequestEvent>((event, emit) async {
      final currentState = state;
      if (currentState is ProfileLoaded) {
        emit(ProfileLoading());
        try {
          await repository.cancelLeaveRequest(event.id);
          final leaveRequests = await repository.fetchLeaveRequests();
          emit(currentState.copyWith(
            leaveRequests: leaveRequests,
            successMessage: 'Leave request cancelled',
          ));
        } catch (e) {
          emit(currentState.copyWith(errorMessage: e.toString()));
        }
      }
    });
  }
}
