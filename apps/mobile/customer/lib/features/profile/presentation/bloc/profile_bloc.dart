import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/profile/domain/repositories/profile_repository.dart';
import 'package:f2h_customer/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_customer/features/profile/presentation/bloc/profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ProfileRepository profileRepository;

  ProfileBloc({required this.profileRepository}) : super(ProfileInitial()) {
    on<LoadProfile>(_onLoadProfile);
  }

  Future<void> _onLoadProfile(LoadProfile event, Emitter<ProfileState> emit) async {
    emit(ProfileLoading());
    try {
      final profile = await profileRepository.getProfile();
      final txs = await profileRepository.getWalletTransactions();
      emit(ProfileLoaded(profile, transactions: txs));
    } catch (e) {
      emit(ProfileError(extractErrorMessage(e)));
    }
  }
}
