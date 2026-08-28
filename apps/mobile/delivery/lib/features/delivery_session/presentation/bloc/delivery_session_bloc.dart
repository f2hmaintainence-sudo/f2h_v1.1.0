import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/location_tracking_service.dart';

part 'delivery_session_event.dart';
part 'delivery_session_state.dart';

/// The single source of truth for the driver's active delivery session.
///
/// Replaces [MockDataService] for all data access in [DashboardScreen],
/// [OrdersScreen], [WarehouseHandoverScreen], and [ReportIssueScreen].
///
/// Registered as a [LazySingleton] in [injection.dart] and provided at the
/// app root in [app.dart].
class DeliverySessionBloc
    extends Bloc<DeliverySessionEvent, DeliverySessionState> {
  final OrdersRepository _ordersRepo;
  final ProfileRepository _profileRepo;

  DeliverySessionBloc({
    required OrdersRepository ordersRepo,
    required ProfileRepository profileRepo,
  })  : _ordersRepo = ordersRepo,
        _profileRepo = profileRepo,
        super(DeliverySessionInitial()) {
    on<LoadSessionEvent>(_onLoad);
    on<ReloadSessionEvent>(_onReload);
    on<ToggleOnlineEvent>(_onToggleOnline);
    on<UpdateStopStatusEvent>(_onUpdateStopStatus);
    on<StartRunEvent>(_onStartRun);
    on<ConfirmWarehousePickupEvent>(_onConfirmWarehousePickup);
    on<TriggerSosEvent>(_onTriggerSos);
    on<ClearSosEvent>(_onClearSos);
    on<ClearActiveRunEvent>(_onClearActiveRun);
    on<HandoverRunEvent>(_onHandoverRun);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  DeliverySessionLoaded _currentLoaded() {
    final s = state;
    if (s is DeliverySessionLoaded) return s;
    return DeliverySessionLoaded(
      driverName: 'User',
      isOnline: false,
      isVerified: false,
      accountStatus: 'active',
      isSosActive: false,
      currentRun: null,
      orders: [],
    );
  }

  Future<DeliverySessionLoaded> _fetchFresh() async {
    final current = _currentLoaded();

    String driverName = current.driverName;
    bool isOnline = current.isOnline;
    bool isVerified = current.isVerified;
    String accountStatus = current.accountStatus;
    DeliveryRun? currentRun;
    List<DeliveryOrderModel> orders = [];

    // Fetch profile and today's run in parallel.
    // fetchTodayOrders is only called as a fallback if fetchTodayRun returns null,
    // since GET /today internally delegates to GET /run/today — avoid the duplicate call.
    final futures = await Future.wait([
      _profileRepo.fetchProfile().then<dynamic>((val) => val).catchError((err) {
        print('[DeliverySessionBloc] profile fetch failed: $err');
        return err;
      }),
      _ordersRepo.fetchTodayRun().then<dynamic>((val) => val).catchError((err) {
        print('[DeliverySessionBloc] fetchTodayRun failed: $err');
        return err;
      }),
    ]);

    final profileRes = futures[0];
    final runRes = futures[1];

    bool profileFailed = false;
    dynamic profileError;
    if (profileRes is ProfileModel) {
      driverName = profileRes.fullName;
      isOnline = profileRes.isOnline;
      isVerified = profileRes.isVerified;
      accountStatus = profileRes.accountStatus ?? (profileRes.isActive ? 'active' : 'inactive');

      // Sync location tracking
      try {
        final trackingService = sl<LocationTrackingService>();
        if (isOnline) {
          trackingService.startTracking();
        } else {
          trackingService.stopTracking();
        }
      } catch (_) {}
    } else {
      profileFailed = true;
      profileError = profileRes;
    }

    bool ordersFailed = false;
    dynamic ordersError;
    if (runRes is DeliveryRun) {
      currentRun = runRes;
      orders = runRes.orders;
    } else if (runRes == null) {
      // No run found — try the fallback orders endpoint.
      try {
        final fallbackOrders = await _ordersRepo.fetchTodayOrders();
        orders = fallbackOrders;
      } catch (err) {
        print('[DeliverySessionBloc] fetchTodayOrders failed: $err');
        ordersFailed = true;
        ordersError = err;
        currentRun = current.currentRun;
        orders = current.orders;
      }
    } else {
      ordersFailed = true;
      ordersError = runRes;
      currentRun = current.currentRun;
      orders = current.orders;
    }

    if (state is! DeliverySessionLoaded) {
      if (profileFailed && ordersFailed) {
        throw Exception("Could not connect to server. Please check your internet connection.");
      } else if (profileFailed) {
        throw profileError is Exception ? profileError : Exception(profileError?.toString() ?? "Failed to load profile.");
      } else if (ordersFailed) {
        throw ordersError is Exception ? ordersError : Exception(ordersError?.toString() ?? "Failed to load orders.");
      }
    }

    return current.copyWith(
      driverName: driverName,
      isOnline: isOnline,
      isVerified: isVerified,
      accountStatus: accountStatus,
      currentRun: currentRun,
      orders: orders,
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  Future<void> _onLoad(
      LoadSessionEvent event, Emitter<DeliverySessionState> emit) async {
    emit(DeliverySessionLoading());
    try {
      emit(await _fetchFresh());
    } catch (e) {
      String msg = e.toString();
      if (msg.startsWith('Exception: ')) {
        msg = msg.substring('Exception: '.length);
      }
      emit(DeliverySessionError(msg));
    }
  }

  Future<void> _onReload(
      ReloadSessionEvent event, Emitter<DeliverySessionState> emit) async {
    // Reload without showing a full loading spinner — keep current state visible
    try {
      emit(await _fetchFresh());
    } catch (_) {
      // Swallow; user still sees last good state
    }
  }

  Future<void> _onToggleOnline(
      ToggleOnlineEvent event, Emitter<DeliverySessionState> emit) async {
    final current = _currentLoaded();
    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post(
        '/DeliveryPartner/auth/shift-toggle',
        data: {'is_online': event.val, 'is_active': event.val},
      );

      final trackingService = sl<LocationTrackingService>();
      if (event.val) {
        await trackingService.startTracking();
      } else {
        await trackingService.stopTracking();
      }

      emit(current.copyWith(isOnline: event.val));

      add(ReloadSessionEvent());
      if (event.callback != null) {
        event.callback!(null);
      }
    } catch (e) {
      if (event.callback != null) {
        String msg = 'Failed to update shift status.';
        try {
          final resData = (e as dynamic).response?.data;
          if (resData is Map && resData.containsKey('message')) {
            msg = resData['message'].toString();
          }
        } catch (_) {}
        event.callback!(msg);
      }
    }
  }

  Future<void> _onUpdateStopStatus(
      UpdateStopStatusEvent event, Emitter<DeliverySessionState> emit) async {
    final current = _currentLoaded();

    // Optimistic local update
    final index = current.orders.indexWhere((o) => o.orderId == event.orderId);
    if (index == -1) return;

    final existing = current.orders[index];
    final targetAddressId = existing.addressId;
    final targetCustomerId = existing.customerId;

    final updated = current.orders.asMap().map((i, o) {
      final matches =
          (o.addressId == targetAddressId && targetAddressId.isNotEmpty) ||
              (o.customerId == targetCustomerId && targetCustomerId.isNotEmpty);
      if (!matches) return MapEntry(i, o);
      return MapEntry(
          i,
          o.copyWith(
            status: event.newStatus,
            emptyBottlesCollected: event.emptyBottles,
            paymentMode: event.paymentMode ?? o.paymentMode,
            paymentStatus: event.paymentStatus ?? o.paymentStatus,
            deliveryImage: event.deliveryImage ?? o.deliveryImage,
          ));
    }).values.toList();

    emit(current.copyWith(orders: updated));

    try {
      bool success = false;

      if (existing.runId != null && existing.addressId.isNotEmpty) {
        double? lat;
        double? lng;
        try {
          final locationService = sl<LocationService>();
          final position = await locationService.getCurrentPosition();
          if (position != null) {
            lat = position.latitude;
            lng = position.longitude;
          }
        } catch (_) {}

        success = await _ordersRepo.markStopDelivered(
          runId: existing.runId!,
          addressId: existing.addressId,
          status: event.newStatus,
          orderId: existing.orderId,
          remarks: event.notes,
          emptyBottlesCollected: event.emptyBottles,
          returnedContainers: event.returnedContainers,
          damagedContainers: event.damagedContainers,
          lostContainers: event.lostContainers,
          paymentMode: event.paymentMode,
          paymentStatus: event.paymentStatus,
          deliveryImage: event.deliveryImage,
          latitude: lat,
          longitude: lng,
          containerReturns: event.containerReturns,
          containerDeliveries: event.containerDeliveries,
        );
      } else {
        success = await _ordersRepo.updateOrderStatus(
          event.orderId,
          event.newStatus,
          notes: event.notes,
          emptyBottlesCollected: event.emptyBottles,
          returnedContainers: event.returnedContainers,
          damagedContainers: event.damagedContainers,
          lostContainers: event.lostContainers,
          paymentMode: event.paymentMode,
          paymentStatus: event.paymentStatus,
          deliveryImage: event.deliveryImage,
          containerReturns: event.containerReturns,
          containerDeliveries: event.containerDeliveries,
        );
      }

      if (success) {
        // Fetch fresh data after a successful backend update
        final freshState = await _fetchFresh();
        emit(freshState);
        event.onSuccess?.call();
      }
    } catch (e) {
      // Roll back to original state on error and surface the message to the caller
      emit(current);
      event.onError?.call(e.toString());
    }
  }

  /// Confirms the items loaded at the warehouse, then starts the run so the
  /// stops become navigable. Reuses the same repository call the run-start
  /// button uses, so both entry points leave the session in one state.
  Future<void> _onConfirmWarehousePickup(
      ConfirmWarehousePickupEvent event, Emitter<DeliverySessionState> emit) async {
    final current = _currentLoaded();
    final runId = current.currentRun?.runId;
    if (runId == null || runId.isEmpty) {
      event.onError?.call('No active run to confirm.');
      return;
    }
    try {
      // The items must carry product_variant_id, which the modal's display
      // model does not have — so they are read from the pickup endpoint, the
      // same source the pickup-selection screen uses.
      final pickup = await _ordersRepo.getPickupItems();
      final success = await _ordersRepo.confirmPickup(
        runId: runId,
        items: pickup.items,
      );
      if (!success) {
        event.onError?.call('Warehouse pickup could not be confirmed.');
        return;
      }
      // The API already moves the run to in_progress; reload so the session
      // reflects that rather than dispatching a second start.
      add(ReloadSessionEvent());
      event.onSuccess?.call();
    } catch (e) {
      event.onError?.call(e.toString());
    }
  }

  Future<void> _onStartRun(
      StartRunEvent event, Emitter<DeliverySessionState> emit) async {
    final current = _currentLoaded();
    try {
      final success = await _ordersRepo.startRun(event.runId);
      if (success) {
        final updatedRun = current.currentRun != null &&
                current.currentRun!.runId == event.runId
            ? DeliveryRun(
                runId: current.currentRun!.runId,
                status: 'in_progress',
                slot: current.currentRun!.slot,
                runDate: current.currentRun!.runDate,
                orders: current.currentRun!.orders
                    .map((o) => o.copyWith(status: 'out_for_delivery'))
                    .toList(),
              )
            : current.currentRun;

        emit(current.copyWith(
          currentRun: updatedRun,
          orders: updatedRun?.orders ?? current.orders,
        ));

        emit(await _fetchFresh());
      }
    } catch (_) {
      // State remains unchanged on error
    }
  }

  Future<void> _onTriggerSos(
      TriggerSosEvent event, Emitter<DeliverySessionState> emit) async {
    emit(_currentLoaded().copyWith(isSosActive: true));
    try {
      final dioClient = sl<DioClient>();
      final locationService = sl<LocationService>();
      final position = await locationService.getCurrentPosition();
      await dioClient.dio.post(
        ApiEndpoints.sos,
        data: {
          if (position != null) 'latitude': position.latitude,
          if (position != null) 'longitude': position.longitude,
        },
      );
    } catch (_) {}
  }

  Future<void> _onClearSos(
      ClearSosEvent event, Emitter<DeliverySessionState> emit) async {
    emit(_currentLoaded().copyWith(isSosActive: false));
    try {
      final dioClient = sl<DioClient>();
      await dioClient.dio.post(ApiEndpoints.clearSos);
    } catch (_) {}
  }

  void _onClearActiveRun(
      ClearActiveRunEvent event, Emitter<DeliverySessionState> emit) {
    emit(_currentLoaded().copyWith(clearRun: true, orders: []));
  }

  Future<void> _onHandoverRun(
      HandoverRunEvent event, Emitter<DeliverySessionState> emit) async {
    final current = _currentLoaded();
    try {
      final result = await _ordersRepo.handoverRun(event.runId);
      if (result.success) {
        // Handover completed successfully, refresh the state to clear or update run
        emit(await _fetchFresh());
        event.onSuccess?.call(result);
      } else {
        event.onError?.call(result.message.isNotEmpty
            ? result.message
            : 'Warehouse handover failed.');
      }
    } catch (e) {
      event.onError?.call(e.toString());
    }
  }
}
