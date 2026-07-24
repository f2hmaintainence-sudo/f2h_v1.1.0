import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/core/services/notification_service.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;
  final NotificationService notificationService;

  AuthBloc({required this.authRepository, required this.notificationService}) : super(AuthInitial()) {
    on<LoginRequested>(_onLoginRequested);
    on<SignupRequested>(_onSignupRequested);
    on<GoogleSignInRequested>(_onGoogleSignInRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<AuthCheckRequested>(_onAuthCheckRequested);
  }

  Future<void> _onLoginRequested(LoginRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final String? fcmToken = await notificationService.getToken();
      final user = await authRepository.login(event.identifier, event.password, fcmToken: fcmToken);
      emit(Authenticated(user: user));
    } catch (e) {
      emit(AuthFailure(error: extractErrorMessage(e, fallback: 'Login failed. Please try again.')));
    }
  }

  Future<void> _onSignupRequested(SignupRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final String? fcmToken = await notificationService.getToken();
      final user = await authRepository.register(
        event.user_name,
        event.email,
        event.password,
        phone: event.phone,
        verificationToken: event.verificationToken,
        referralCode: event.referralCode,
        fcmToken: fcmToken,
      );
      emit(Authenticated(user: user));
    } catch (e) {
      emit(AuthFailure(error: extractErrorMessage(e, fallback: 'Signup failed. Please try again.')));
    }
  }

  Future<void> _onGoogleSignInRequested(GoogleSignInRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final String? fcmToken = await notificationService.getToken();
      final user = await authRepository.signInWithGoogle(fcmToken: fcmToken);
      emit(Authenticated(user: user));
    } catch (e) {
      emit(AuthFailure(error: extractErrorMessage(e, fallback: 'Google sign-in failed. Please try again.')));
    }
  }

  Future<void> _onLogoutRequested(LogoutRequested event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      await authRepository.logout();
      emit(const Unauthenticated());
    } catch (e) {
      emit(AuthFailure(error: extractErrorMessage(e, fallback: 'Logout failed. Please try again.')));
    }
  }

  Future<void> _onAuthCheckRequested(AuthCheckRequested event, Emitter<AuthState> emit) async {
    final isAuthenticated = await authRepository.checkAuthStatus();
    if (isAuthenticated) {
      final user = await authRepository.getCachedUser();
      emit(Authenticated(user: user ?? User(userId: 'session', email: '')));
    } else {
      emit(const Unauthenticated());
    }
  }
}
