import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/notifications/data/models/notification_model.dart';
import 'package:f2h_customer/features/notifications/data/repositories/notifications_repository.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_event.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_state.dart';

class NotificationsBloc extends Bloc<NotificationsEvent, NotificationsState> {
  final NotificationsRepository notificationsRepository;

  NotificationsBloc({required this.notificationsRepository})
      : super(NotificationsInitial()) {
    on<LoadNotifications>(_onLoad);
    on<MarkAsRead>(_onMarkAsRead);
    on<MarkAllAsRead>(_onMarkAllAsRead);
    on<DismissNotification>(_onDismiss);
    on<DismissAllNotifications>(_onDismissAll);
    on<ChangeStatusFilter>(_onChangeStatusFilter);
    on<ChangeTypeFilter>(_onChangeTypeFilter);
  }

  List<NotificationItem> _applyFilters(
    List<NotificationItem> all,
    String statusFilter,
    String? typeFilter,
  ) {
    var filtered = all.toList();

    // Status filter
    if (statusFilter == 'unread') {
      filtered = filtered.where((n) => n.status == 'unread').toList();
    } else if (statusFilter == 'read') {
      filtered = filtered.where((n) => n.status == 'read').toList();
    }

    // Type filter
    if (typeFilter != null) {
      filtered = filtered.where((n) => n.type == typeFilter).toList();
    }

    return filtered;
  }

  Future<void> _onLoad(LoadNotifications event, Emitter<NotificationsState> emit) async {
    emit(NotificationsLoading());
    try {
      final result = await notificationsRepository.getNotificationsWithCount();
      final filtered = _applyFilters(result.notifications, 'all', null);
      emit(NotificationsLoaded(
        allNotifications: result.notifications,
        filteredNotifications: filtered,
        unreadCount: result.unreadCount,
      ));
    } catch (e) {
      // ponytail: Notifications are non-critical. If they fail (e.g. auth transition or network issue),
      // emit loaded state with empty lists instead of showing an error screen.
      emit(NotificationsLoaded(
        allNotifications: [],
        filteredNotifications: [],
        unreadCount: 0,
      ));
    }
  }

  Future<void> _onMarkAsRead(MarkAsRead event, Emitter<NotificationsState> emit) async {
    if (state is! NotificationsLoaded) return;
    final current = state as NotificationsLoaded;
    try {
      await notificationsRepository.markAsRead(event.recipientId);
      final updatedAll = current.allNotifications.map((n) {
        if (n.id == event.recipientId) {
          return n.copyWith(status: 'read', readAt: DateTime.now());
        }
        return n;
      }).toList();
      final newUnread = updatedAll.where((n) => n.isUnread).length;
      final filtered = _applyFilters(updatedAll, current.statusFilter, current.typeFilter);
      emit(current.copyWith(
        allNotifications: updatedAll,
        filteredNotifications: filtered,
        unreadCount: newUnread,
      ));
    } catch (e) {
      // Silently fail — don't break the UI
    }
  }

  Future<void> _onMarkAllAsRead(MarkAllAsRead event, Emitter<NotificationsState> emit) async {
    if (state is! NotificationsLoaded) return;
    final current = state as NotificationsLoaded;
    try {
      await notificationsRepository.markAllAsRead();
      final updatedAll = current.allNotifications.map((n) {
        return n.copyWith(status: 'read', readAt: DateTime.now());
      }).toList();
      final filtered = _applyFilters(updatedAll, current.statusFilter, current.typeFilter);
      emit(current.copyWith(
        allNotifications: updatedAll,
        filteredNotifications: filtered,
        unreadCount: 0,
      ));
    } catch (e) {
      // Silently fail
    }
  }

  Future<void> _onDismiss(DismissNotification event, Emitter<NotificationsState> emit) async {
    if (state is! NotificationsLoaded) return;
    final current = state as NotificationsLoaded;
    try {
      await notificationsRepository.dismissNotification(event.recipientId);
      final updatedAll = current.allNotifications.where((n) => n.id != event.recipientId).toList();
      final newUnread = updatedAll.where((n) => n.isUnread).length;
      final filtered = _applyFilters(updatedAll, current.statusFilter, current.typeFilter);
      emit(current.copyWith(
        allNotifications: updatedAll,
        filteredNotifications: filtered,
        unreadCount: newUnread,
      ));
    } catch (e) {
      // Silently fail
    }
  }

  Future<void> _onDismissAll(DismissAllNotifications event, Emitter<NotificationsState> emit) async {
    if (state is! NotificationsLoaded) return;
    try {
      await notificationsRepository.dismissAllNotifications();
      emit(NotificationsLoaded(
        allNotifications: [],
        filteredNotifications: [],
        unreadCount: 0,
      ));
    } catch (e) {
      // Silently fail
    }
  }

  void _onChangeStatusFilter(ChangeStatusFilter event, Emitter<NotificationsState> emit) {
    if (state is! NotificationsLoaded) return;
    final current = state as NotificationsLoaded;
    final filtered = _applyFilters(current.allNotifications, event.filter, current.typeFilter);
    emit(current.copyWith(
      statusFilter: event.filter,
      filteredNotifications: filtered,
    ));
  }

  void _onChangeTypeFilter(ChangeTypeFilter event, Emitter<NotificationsState> emit) {
    if (state is! NotificationsLoaded) return;
    final current = state as NotificationsLoaded;
    final filtered = _applyFilters(current.allNotifications, current.statusFilter, event.typeFilter);
    emit(current.copyWith(
      typeFilter: event.typeFilter,
      clearTypeFilter: event.typeFilter == null,
      filteredNotifications: filtered,
    ));
  }
}
