import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/data/datasources/subscription_remote_datasource.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';

class SubscriptionRepositoryImpl implements SubscriptionRepository {
  final SubscriptionRemoteDataSource remoteDataSource;

  SubscriptionRepositoryImpl({required this.remoteDataSource});

  @override
  Future<List<Subscription>> getSubscriptions() async {
    try {
      final rawList = await remoteDataSource.getSubscriptions();
      if (rawList.isEmpty) return [];

      final Map<String, Map<String, dynamic>> subscriptionsById = {};
      final Map<String, List<Map<String, dynamic>>> rowsBySubscriptionId = {};
      final Map<String, List<Map<String, dynamic>>> nestedItemsBySubscriptionId = {};

      for (final entry in rawList) {
        if (entry is! Map) continue;

        final row = Map<String, dynamic>.from(entry);
        final subscriptionId =
            _firstString(row, const ['subscription_id', 'id']);
        // if (subscriptionId.isEmpty) continue;
        if (subscriptionId == null || subscriptionId.isEmpty) {
          continue;
        }

        subscriptionsById.putIfAbsent(
          subscriptionId,
          () => Map<String, dynamic>.from(row),
        );
        rowsBySubscriptionId.putIfAbsent(subscriptionId, () => []);

        final nestedItems = _asListOfMaps(row['items']);
        if (nestedItems.isNotEmpty) {
          nestedItemsBySubscriptionId[subscriptionId] = nestedItems;
          continue;
        }

        // final itemId = _firstString(
        //   row,
        //   const [
        //     'subscription_item_id',
        //     'subscriptionItemId',
        //     'si_id',
        //   ],
        // );
        // if (itemId.isNotEmpty) {
        //   rowsBySubscriptionId[subscriptionId]!.add(row);
        // }
        rowsBySubscriptionId[subscriptionId]!.add(row);
      }

      final subscriptions = <Subscription>[];

      for (final entry in subscriptionsById.entries) {
        final subscriptionId = entry.key;
        final subRow = entry.value;
        final flatRows = rowsBySubscriptionId[subscriptionId] ?? const [];
        final rawItems = nestedItemsBySubscriptionId[subscriptionId] ??
            flatRows;

        final items = rawItems
            .map(SubscriptionItemModel.fromJson)
            .toList();
        final weeklySchedules = _buildWeeklySchedules(subRow, flatRows);
        final customDates = _buildCustomDates(subRow, flatRows);
        final pauses = _buildPauses(subRow, flatRows);

        final normalizedItems = items.isNotEmpty
            ? items
            : <SubscriptionItemModel>[
                if (_firstString(subRow, const [
                      'product_variant_id',
                      'variant_id',
                    ]) != null)
                  SubscriptionItemModel.fromJson(subRow),
              ];

        final productName = normalizedItems.isNotEmpty
            ? normalizedItems.first.displayName
            : _firstString(subRow, const ['product_name', 'name']) ??
                'Subscription';
        final vendorName = _firstString(subRow, const ['vendor_name', 'branch_name']) ??
            (normalizedItems.isNotEmpty && normalizedItems.first.sku.isNotEmpty
                ? normalizedItems.first.sku
                : 'F2H Partner');
        int qty = 0;
        if (normalizedItems.isNotEmpty) {
          qty = normalizedItems.fold<int>(
            0,
            (sum, item) => sum + (item.totalDailyQty > 0 ? item.totalDailyQty : 1),
          );
        }
        if (qty <= 0) {
          qty = _parseInt(subRow['qty'] ?? subRow['quantity'] ?? 1);
        }

        double pricePerDay = 0.0;
        if (normalizedItems.isNotEmpty) {
          pricePerDay = normalizedItems.fold<double>(
            0.0,
            (sum, item) {
              final itemPrice = item.finalPrice > 0 ? item.finalPrice : item.unitPrice;
              final itemQty = item.totalDailyQty > 0 ? item.totalDailyQty : 1;
              return sum + (itemPrice * itemQty);
            },
          );
        }
        if (pricePerDay <= 0) {
          pricePerDay = _parseDouble(subRow['price_per_day'] ?? subRow['pricePerDay'] ?? subRow['price'] ?? subRow['unit_price']);
        }
        final frequency = _deriveFrequency(
          weeklySchedules: weeklySchedules,
          customDates: customDates,
          scheduleType: _firstString(subRow, const ['schedule_type']) ??
              'weekly',
        );
        final deliverySlot = _deriveDeliverySlot(subRow, normalizedItems);
        final emoji = _emojiForProduct(productName);

        subscriptions.add(
          Subscription(
            id: _firstString(subRow, const ['subscription_id', 'id']) ?? '',
            subscriptionNumber: _firstString(
                  subRow,
                  const ['subscription_number'],
                ) ??
                '',
            customerId: _firstString(subRow, const ['customer_id']) ?? '',
            status: _firstString(subRow, const ['status']) ?? 'active',
            scheduleType:
                _firstString(subRow, const ['schedule_type']) ?? 'weekly',
            paymentType:
                _firstString(subRow, const ['payment_type']) ?? 'prepaid',
            deliverySlot: deliverySlot,
            autoRenew: _isTruthy(subRow['auto_renew'] ?? subRow['autoRenew']),
            startDate: _firstString(subRow, const ['start_date', 'startDate']),
            endDate: _firstString(subRow, const ['end_date', 'endDate']),
            pauseFromDate: _firstString(
              subRow,
              const ['pause_from_date', 'pause_start_date', 'pauseFromDate'],
            ),
            pauseToDate: _firstString(
              subRow,
              const ['pause_to_date', 'pause_end_date', 'pauseToDate'],
            ),
            addressId: _firstString(
                  subRow,
                  const ['address_id', 'addressId', 'action_id'],
                ) ??
                '',
            branchId: _firstString(subRow, const ['branch_id', 'branchId']) ??
                '',
            createdAt: _firstString(subRow, const ['created_at', 'createdAt']),
            updatedAt: _firstString(subRow, const ['updated_at', 'updatedAt']),
            notes: _firstString(subRow, const ['notes', 'remark']),
            items: normalizedItems,
            weeklySchedules: weeklySchedules,
            customDates: customDates,
            pauses: pauses,
            productName: productName,
            vendorName: vendorName,
            emoji: emoji,
            pricePerDay: pricePerDay,
            frequency: frequency,
            slot: deliverySlot,
            qty: qty,
            imageUrl: normalizedItems.isNotEmpty ? normalizedItems.first.imageUrl : null,
            monthlyEstimate: _parseDouble(subRow['monthly_estimate'] ?? subRow['monthlyEstimate']),
          ),
        );
      }

      return subscriptions;
    } catch (e) {
      print('Error parsing subscriptions: $e');
      rethrow;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  CREATE SUBSCRIPTION — supports morning/evening split,
  //  paymentType, autoRenew from the SubscriptionSetupScreen.
  //  Returns the full response Map so the bloc can extract
  //  the subscription ID for the success screen.
  // ══════════════════════════════════════════════════════════
  @override
  Future<Map<String, dynamic>> createSubscription({
    required String customerId,
    required String branchId,
    required String variantId,
    required int quantity,
    required int morningQty,
    required int eveningQty,
    required String scheduleType,
    required String deliverySlot,
    required String startDate,
    required double unitPrice,
    required List<String> customDays,
    required String paymentType,
    required bool autoRenew,
  }) async {
    try {
      final schedules = _buildSchedulesWithSplit(
        scheduleType: scheduleType,
        morningQty: morningQty,
        eveningQty: eveningQty,
        customDays: customDays,
      );
      final data = {
        'customer_id': customerId,
        'branch_id': branchId,
        'schedule_type': scheduleType == 'custom' ? 'custom_days' : 'weekly',
        'payment_type': paymentType,
        'auto_renew': autoRenew,
        'custom_dates': scheduleType == 'custom' ? customDays : <String>[],
        'items': [
          {
            'product_variant_id': variantId,
            'unit_price': unitPrice,
            'schedules': schedules,
          }
        ],
        'start_date': startDate,
      };
      final res = await remoteDataSource.createSubscription(data);
      return res;
    } catch (e) {
      print('Error creating subscription: $e');
      rethrow;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  CHECKOUT SUBSCRIPTION — with payment validation
  //  Wallet deduction (prepaid/wallet) or credit limit check
  //  (postpaid) is handled server-side at this endpoint.
  // ══════════════════════════════════════════════════════════
  @override
  Future<Map<String, dynamic>> checkoutSubscription({
    required String customerId,
    required String branchId,
    String? addressId,
    required String variantId,
    required int quantity,
    required int morningQty,
    required int eveningQty,
    Map<String, Map<String, int>> weeklySchedule = const {},
    required String scheduleType,
    required String deliverySlot,
    required String startDate,
    required double unitPrice,
    required List<String> customDays,
    required String paymentType,
    required String paymentMethod,
    required bool autoRenew,
    required double estimatedTotal,
  }) async {
    try {
      final List<Map<String, dynamic>> schedules;

      if (scheduleType == 'weekly' && weeklySchedule.isNotEmpty) {
        // Build per-day schedules from the weekly schedule map
        // Only include days that have at least 1 unit (morning or evening)
        const dayIndexMap = <String, int>{
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
        };
        schedules = [];
        for (final entry in weeklySchedule.entries) {
          // The key is the 3-letter abbreviation e.g. 'Mon', 'Tue', etc.
          final key = entry.key.length >= 3 ? entry.key.substring(0, 3) : entry.key;
          final normalizedKey = key[0].toUpperCase() + key.substring(1).toLowerCase();
          final dayIndex = dayIndexMap[normalizedKey];
          final mQty = entry.value['morning'] ?? 0;
          final eQty = entry.value['evening'] ?? 0;
          if ((mQty > 0 || eQty > 0) && dayIndex != null) {
            schedules.add({
              'day': dayIndex,
              'day_of_week': dayIndex,
              'm_quantity': mQty,
              'm_qty': mQty,
              'e_quantity': eQty,
              'e_qty': eQty,
            });
          }
        }
      } else if (scheduleType == 'daily') {
        // Daily: same quantity for all 7 days
        schedules = List.generate(7, (i) => <String, dynamic>{
          'day': i,
          'day_of_week': i,
          'm_quantity': morningQty,
          'm_qty': morningQty,
          'e_quantity': eveningQty,
          'e_qty': eveningQty,
        });
      } else {
        schedules = _buildSchedulesWithSplit(
          scheduleType: scheduleType,
          morningQty: morningQty,
          eveningQty: eveningQty,
          customDays: customDays,
        );
      }

      final data = {
        'customer_id': customerId,
        'branch_id': branchId,
        if (addressId != null && addressId.isNotEmpty) 'address_id': addressId,
        'schedule_type': (scheduleType == 'daily' || scheduleType == 'weekly') ? 'weekly' : 'custom_dates',
        'payment_type': paymentType,
        'payment_method': paymentMethod,
        'auto_renew': autoRenew,
        'estimated_total': estimatedTotal,
        'monthly_estimate': estimatedTotal,

        'custom_dates': scheduleType == 'custom' ? customDays : <String>[],
        'items': [
          {
            'product_variant_id': variantId,
            'unit_price': unitPrice,
            'schedules': schedules,
          }
        ],
        'start_date': startDate,
      };
      final res = await remoteDataSource.checkoutSubscription(data);
      return res;
    } catch (e) {
      print('Error during subscription checkout: $e');
      rethrow;
    }
  }


  @override
  Future<bool> placeOrder({
    required String variantId,
    required int quantity,
    required double unitPrice,
    required String deliverySlot,
    required String scheduledDate,
  }) async {
    try {
      final data = {
        'delivery_slot': deliverySlot,
        'scheduled_date': scheduledDate,
        'payment_mode': 'wallet',
        'items': [
          {
            'variant_id': variantId,
            'quantity': quantity,
            'unit_price': unitPrice,
          }
        ]
      };
      final res = await remoteDataSource.placeOrder(data);
      return res['status'] == true;
    } catch (e) {
      print('Error placing order: $e');
      return false;
    }
  }

  @override
  Future<List<Order>> getOrders() {
    return remoteDataSource.getOrders();
  }

  @override
  Future<bool> pauseSubscription(String subscriptionId, {String? startDate, String? endDate}) async {
    try {
      final res = await remoteDataSource.pauseSubscription(
        subscriptionId,
        startDate: startDate,
        endDate: endDate,
      );
      return res['status'] == true;
    } catch (e) {
      print('Error pausing subscription: $e');
      return false;
    }
  }

  @override
  Future<bool> resumeSubscription(String subscriptionId) async {
    try {
      final res = await remoteDataSource.resumeSubscription(subscriptionId);
      return res['status'] == true;
    } catch (e) {
      print('Error resuming subscription: $e');
      return false;
    }
  }

  @override
  Future<List<dynamic>> getSubscriptionCalendar(String subscriptionId) {
    return remoteDataSource.getSubscriptionCalendar(subscriptionId);
  }

  @override
  Future<bool> cancelSubscriptionItem(String subscriptionItemId) async {
    try {
      final res = await remoteDataSource.cancelSubscriptionItem(subscriptionItemId);
      return res['status'] == true;
    } catch (e) {
      print('Error cancelling subscription item: $e');
      return false;
    }
  }

  @override
  Future<bool> cancelSubscription(String subscriptionId, {String? cancelReason, String? endDate}) async {
    try {
      final res = await remoteDataSource.cancelSubscription(
        subscriptionId,
        cancelReason: cancelReason,
        endDate: endDate,
      );
      return res['status'] == true;
    } catch (e) {
      print('Error cancelling subscription: $e');
      return false;
    }
  }

  @override
  Future<List<SubscriptionPauseModel>> getPauseHistory(String subscriptionId) async {
    try {
      final rawList = await remoteDataSource.getPauseHistory(subscriptionId);
      return rawList
          .whereType<Map>()
          .map((e) => SubscriptionPauseModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      print('Error getting pause history: $e');
      return [];
    }
  }

  // ── Legacy schedule builder (kept for placeOrder compatibility) ────
  List<Map<String, dynamic>> _buildSchedules({
    required String scheduleType,
    required String deliverySlot,
    required int quantity,
    required List<String> customDays,
  }) {
    final isMorning = deliverySlot.toLowerCase().contains('morning');
    return _buildSchedulesWithSplit(
      scheduleType: scheduleType,
      morningQty: isMorning ? quantity : 0,
      eveningQty: isMorning ? 0 : quantity,
      customDays: customDays,
    );
  }

  // ── Primary schedule builder — supports morning/evening split ──────
  List<Map<String, dynamic>> _buildSchedulesWithSplit({
    required String scheduleType,
    required int morningQty,
    required int eveningQty,
    required List<String> customDays,
  }) {
    if (scheduleType == 'custom_dates') {
      return [];
    }

    final schedules = <Map<String, dynamic>>[];
    List<int> deliveryDaysIndices = [];

    if (scheduleType == 'daily') {
      deliveryDaysIndices = List.generate(7, (index) => index);
    } else if (scheduleType == 'alternate') {
      deliveryDaysIndices = [1, 3, 5]; // Mon, Wed, Fri
    } else if (scheduleType == 'custom_days' || scheduleType == 'custom') {
      const dayMap = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };
      deliveryDaysIndices = customDays
          .map((day) {
            if (day.length < 3) return null;
            final shortDay = day.substring(0, 3);
            final key = shortDay[0].toUpperCase() + shortDay.substring(1).toLowerCase();
            return dayMap[key];
          })
          .where((d) => d != null)
          .cast<int>()
          .toList();
    } else {
      // 'weekly' or unknown — deliver Mon–Sun
      deliveryDaysIndices = List.generate(7, (index) => index);
    }

    for (final dayIndex in deliveryDaysIndices) {
      schedules.add({
        'day': dayIndex,
        'day_of_week': dayIndex,
        'm_quantity': morningQty,
        'm_qty': morningQty,
        'e_quantity': eveningQty,
        'e_qty': eveningQty,
      });
    }

    return schedules;
  }

  List<SubscriptionScheduleModel> _buildWeeklySchedules(
    Map<String, dynamic> subRow,
    List<Map<String, dynamic>> rows,
  ) {
    final schedules = <SubscriptionScheduleModel>[];
    schedules.addAll(_asSchedules(subRow['weekly_schedules'] ?? subRow['weeklySchedules']));

    if (schedules.isEmpty) {
      for (final row in rows) {
        schedules.addAll(
          _asSchedules(row['weekly_schedules'] ?? row['weeklySchedules']),
        );
      }
    }

    return schedules;
  }

  List<SubscriptionCustomDateModel> _buildCustomDates(
    Map<String, dynamic> subRow,
    List<Map<String, dynamic>> rows,
  ) {
    final customDates = <SubscriptionCustomDateModel>[];
    customDates.addAll(_asCustomDates(subRow['custom_dates'] ?? subRow['customDates']));

    if (customDates.isEmpty) {
      for (final row in rows) {
        customDates.addAll(
          _asCustomDates(row['custom_dates'] ?? row['customDates']),
        );
      }
    }

    return customDates;
  }

  List<SubscriptionPauseModel> _buildPauses(
    Map<String, dynamic> subRow,
    List<Map<String, dynamic>> rows,
  ) {
    final pauses = <SubscriptionPauseModel>[];
    pauses.addAll(_asPauses(subRow['pauses']));

    if (pauses.isEmpty) {
      for (final row in rows) {
        pauses.addAll(_asPauses(row['pauses']));
      }
    }

    return pauses;
  }

  List<SubscriptionScheduleModel> _asSchedules(dynamic value) {
    return _asListOfMaps(value)
        .map(SubscriptionScheduleModel.fromJson)
        .toList();
  }

  List<SubscriptionCustomDateModel> _asCustomDates(dynamic value) {
    return _asListOfMaps(value)
        .map(SubscriptionCustomDateModel.fromJson)
        .toList();
  }

  List<SubscriptionPauseModel> _asPauses(dynamic value) {
    return _asListOfMaps(value).map(SubscriptionPauseModel.fromJson).toList();
  }

  List<Map<String, dynamic>> _asListOfMaps(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
  }

  String _deriveFrequency({
    required List<SubscriptionScheduleModel> weeklySchedules,
    required List<SubscriptionCustomDateModel> customDates,
    required String scheduleType,
  }) {
    if (scheduleType == 'custom_dates') {
      if (customDates.isEmpty) return 'Custom';
      return '${customDates.length} custom dates';
    }

    final activeDays = weeklySchedules
        .where((schedule) => schedule.hasDelivery)
        .map((schedule) => schedule.dayName)
        .toSet()
        .toList();

    if (activeDays.isEmpty) return 'Weekly';
    if (activeDays.length == 7) return 'Daily';
    if (activeDays.length <= 2) return activeDays.join(', ');
    return '${activeDays.length} days/week';
  }

  String _deriveDeliverySlot(
    Map<String, dynamic> subRow,
    List<SubscriptionItemModel> items,
  ) {
    final explicitSlot = _firstString(
      subRow,
      const ['delivery_slot', 'deliverySlot', 'slot'],
    );
    if (explicitSlot != null && explicitSlot.isNotEmpty) {
      return explicitSlot;
    }

    if (items.isEmpty) return 'Morning';

    final slots = items
        .map((item) => item.slotLabel)
        .where((label) => label.trim().isNotEmpty)
        .toSet()
        .toList();

    if (slots.isEmpty) return 'Morning';
    if (slots.length == 1) return slots.first;
    return slots.join(' / ');
  }

  static String _emojiForProduct(String productName) {
    final lowerName = productName.toLowerCase();
    if (lowerName.contains('milk')) return '🥛';
    if (lowerName.contains('ghee')) return '🧈';
    if (lowerName.contains('curd')) return '🍶';
    if (lowerName.contains('paneer')) return '🧀';
    return '📦';
  }

  static String? _firstString(
    Map<String, dynamic> value,
    List<String> keys,
  ) {
    for (final key in keys) {
      final candidate = value[key];
      if (candidate == null) continue;
      final text = candidate.toString().trim();
      if (text.isNotEmpty) return text;
    }
    return null;
  }

  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  static double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  static bool _isTruthy(dynamic value) {
    final normalized = value?.toString().trim().toLowerCase();
    return normalized == 'true' || normalized == '1' || normalized == 'yes';
  }

  @override
  Future<SubscriptionDetailInfo> getSubscriptionDetail(String subscriptionId) async {
    try {
      final raw = await remoteDataSource.getSubscriptionDetail(subscriptionId);
      if (raw.isEmpty) return const SubscriptionDetailInfo();
      return SubscriptionDetailInfo.fromJson(raw);
    } catch (_) {
      return const SubscriptionDetailInfo();
    }
  }

  @override
  Future<List<SubscriptionBillModel>> getSubscriptionBills(String subscriptionId) async {
    try {
      final rawList = await remoteDataSource.getSubscriptionBills(subscriptionId);
      return rawList
          .whereType<Map>()
          .map((e) => SubscriptionBillModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
