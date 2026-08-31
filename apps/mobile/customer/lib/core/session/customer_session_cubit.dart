import 'dart:async';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/core/session/customer_bootstrap_api.dart';
import 'package:f2h_customer/core/session/customer_session_cache.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
export 'package:f2h_customer/core/session/customer_session_state.dart';

class CustomerSessionCubit extends Cubit<CustomerSessionState> {
  final CustomerBootstrapApi bootstrapApi;
  final CustomerSessionCache cache;

  CustomerSessionCubit({
    required this.bootstrapApi,
    required this.cache,
  }) : super(const CustomerSessionState.initial());

  Future<void> bootstrap() async {
    emit(state.copyWith(status: CustomerSessionStatus.loading));

    try {
      final session = await bootstrapApi.fetch().timeout(
        const Duration(seconds: 6),
      );
      await cache.save(session);
      emit(session);
    } catch (e) {
      if (CustomerBootstrapApi.isUnauthorized(e)) {
        await clear();
        emit(state.copyWith(
          status: CustomerSessionStatus.unauthenticated,
          error: 'Session expired',
        ));
        return;
      }

      final cached = await cache.read();
      if (cached != null) {
        emit(cached);
        unawaited(_retryBootstrapSilently());
        return;
      }

      emit(state.copyWith(
        status: CustomerSessionStatus.failure,
        error: extractErrorMessage(e),
      ));
    }
  }

  Future<void> refreshSilently() async {
    try {
      final session = await bootstrapApi.fetch();
      await cache.save(session);
      emit(session);
    } catch (_) {
      // Silent refresh intentionally keeps the current usable session.
    }
  }

  Future<void> updateProfile(Map<String, dynamic> payload) async {
    await bootstrapApi.updateProfile(payload);
    final session = await bootstrapApi.fetch();
    await cache.save(session);
    emit(session);
  }

  Future<void> refresh() async {
    final session = await bootstrapApi.fetch();
    await cache.save(session);
    emit(session);
  }

  Future<void> updateDefaultAddress(String addressId) async {
    await bootstrapApi.updateAddress(addressId, const {
      "is_default": true,
    });
    await refresh();
  }


  Future<void> clear({bool clearToken = true}) async {
    if (clearToken) {
      await TokenStorage.clear();
    }
    await cache.clear();
    emit(const CustomerSessionState.initial());
  }

  void rechargeWallet(double amount) {
    if (state.profile != null) {
      final updatedProfile = state.profile!.copyWith(
        walletBalance: state.profile!.walletBalance + amount,
      );
      emit(state.copyWith(profile: updatedProfile));
    }
  }

  void deductWallet(double amount) {
    if (state.profile != null) {
      final updatedProfile = state.profile!.copyWith(
        walletBalance: state.profile!.walletBalance - amount,
      );
      emit(state.copyWith(profile: updatedProfile));
    }
  }

  Future<void> _retryBootstrapSilently() async {
    await Future<void>.delayed(const Duration(seconds: 5));
    await refreshSilently();
  }


}

/// Admin-configured delivery slot windows and cutoffs for the current session.
///
/// Returns null when the session cubit is not in scope, which makes the slot
/// helpers fall back to their built-in defaults rather than throwing. Those
/// defaults are only a safety net — every ordering decision should be driven
/// by the values configured in the admin panel, so prefer passing this in.
Map<String, dynamic>? slotTimingsOf(BuildContext context) {
  try {
    final timings = context.read<CustomerSessionCubit>().state.slotTimings;
    return timings.isEmpty ? null : timings;
  } catch (_) {
    return null;
  }
}
