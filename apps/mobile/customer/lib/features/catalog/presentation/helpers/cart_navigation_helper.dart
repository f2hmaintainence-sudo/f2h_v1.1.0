import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/address/presentation/widgets/address_selector_drawer.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';

class CartNavHelper {
  /// Opens [CartScreen], requiring sign in and asking for a delivery address first if none is set.
  static Future<void> openCart(BuildContext context) async {
    final sessionCubit = context.read<CustomerSessionCubit>();
    final sessionState = sessionCubit.state;
    final authState = context.read<AuthBloc>().state;
    final isLoggedIn =
        authState is Authenticated || sessionState.profile != null;

    if (!isLoggedIn) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => const LoginScreen(popOnSuccess: true),
        ),
      );
      return;
    }

    // If customer has no saved address, prompt address selection first
    if (sessionState.addresses.isEmpty) {
      final chosen = await AddressSelectorDrawer.show(context);
      if (!context.mounted) return;
      await sessionCubit.refreshSilently();
      if (sessionCubit.state.addresses.isEmpty && chosen == null) {
        F2HToast.info(
          context,
          'Please select or add a delivery address to view your cart & proceed.',
          title: 'Address Required',
        );
        return;
      }
    }

    if (context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const CartScreen()),
      );
    }
  }
}
