import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';

class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      // Dynamically resolve local datasource to avoid circular dependencies
      final localDataSource = sl<AuthLocalDataSource>();
      final user = await localDataSource.getCachedUser();
      final token = user?.token;
      
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    } catch (e) {
      // Silently fall back if local DB is not ready yet
    }
    return super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // If the server returns 401 (token expired or invalid), clear the stale
    // local cache and trigger a logout so the user is sent back to the login
    // screen automatically — without needing to clear app data manually.
    if (err.response?.statusCode == 401) {
      try {
        final localDataSource = sl<AuthLocalDataSource>();
        await localDataSource.clearCache();
      } catch (_) {}

      try {
        // Fire a logout event on the existing AuthBloc instance so the
        // AppShell listener navigates to the LoginScreen.
        sl<AuthBloc>().add(LogoutRequested());
      } catch (_) {}
    }
    return super.onError(err, handler);
  }
}
