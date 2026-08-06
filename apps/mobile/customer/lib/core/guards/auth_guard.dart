import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';

extension AuthGuardExtension on BuildContext {
  /// Checks if the user is authenticated.
  /// - If authenticated, immediately executes [action].
  /// - If not, redirects to the [LoginScreen], waits for the session and cart
  ///   to be loaded, and then executes [action].
  Future<void> runWithAuth(VoidCallback action) async {
    final authState = read<AuthBloc>().state;
    final sessionState = read<CustomerSessionCubit>().state;
    
    if (authState is Authenticated || sessionState.profile != null) {
      action();
    } else {
      // User is not authenticated. Push LoginScreen with popOnSuccess set to true.
      final loginSuccess = await Navigator.push<bool>(
        this,
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => const LoginScreen(popOnSuccess: true),
        ),
      );

      // If login succeeded, wait for session bootstrap and cart load to complete sequentially
      if (loginSuccess == true && mounted) {
        // 1. Ensure session bootstrap is triggered and wait for it to finish loading
        final sessionCubit = read<CustomerSessionCubit>();
        if (sessionCubit.state.status != CustomerSessionStatus.ready &&
            sessionCubit.state.status != CustomerSessionStatus.loading) {
          sessionCubit.bootstrap();
        }
        if (sessionCubit.state.status != CustomerSessionStatus.ready &&
            sessionCubit.state.status != CustomerSessionStatus.cached) {
          await sessionCubit.stream.firstWhere((state) =>
              state.status == CustomerSessionStatus.ready ||
              state.status == CustomerSessionStatus.cached);
        }

        // 2. Wait for CartBloc to finish loading the backend-saved cart items
        final cartBloc = read<CartBloc>();
        if (cartBloc.state is! CartLoadedState) {
          await cartBloc.stream.firstWhere((state) => state is CartLoadedState || state is CartErrorState);
        }

        // 3. Execute the action (e.g. adding the item to the fully loaded cart)
        if (mounted) {
          action();
        }
      }
    }
  }
}
