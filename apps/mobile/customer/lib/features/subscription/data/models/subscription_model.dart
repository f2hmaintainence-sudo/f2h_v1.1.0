import '../../../../core/utils/extensions.dart';

String? _asString(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

int _asInt(dynamic value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is double) return value.toInt();
  return int.tryParse(value.toString()) ?? (double.tryParse(value.toString())?.toInt() ?? 0);
}

double _asDouble(dynamic value) {
  if (value == null) return 0.0;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0.0;
}

bool _isTruthy(dynamic value) {
  final normalized = value?.toString().trim().toLowerCase();
  return normalized == 'true' || normalized == '1' || normalized == 'yes';
}

List<Map<String, dynamic>> _asListOfMaps(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((entry) => Map<String, dynamic>.from(entry))
      .toList();
}

String _emojiForProduct(String name) {
  final normalized = name.toLowerCase();
  if (normalized.contains('milk')) return '🥛';
  if (normalized.contains('ghee')) return '🧈';
  if (normalized.contains('curd')) return '🍶';
  if (normalized.contains('paneer')) return '🧀';
  return '📦';
}

class DayQty {
  final String dayName;
  final int quantity;
  final int morningQty;
  final int eveningQty;

  const DayQty({
    required this.dayName,
    required this.quantity,
    this.morningQty = 0,
    this.eveningQty = 0,
  });

  String get formattedText => '$dayName $quantity';
}

class SubscriptionDetailInfo {
  final double walletBalance;
  final double nextRenewalEstimate;
  final int outstandingBillCount;
  final double outstandingAmount;
  final bool alertLowBalance;
  final bool alertOutstandingBills;
  final List<SubscriptionBillModel> latestBills;

  const SubscriptionDetailInfo({
    this.walletBalance = 0,
    this.nextRenewalEstimate = 0,
    this.outstandingBillCount = 0,
    this.outstandingAmount = 0,
    this.alertLowBalance = false,
    this.alertOutstandingBills = false,
    this.latestBills = const [],
  });

  factory SubscriptionDetailInfo.fromJson(Map<String, dynamic> json) {
    final rawBills = _asListOfMaps(json['latest_bills']);
    return SubscriptionDetailInfo(
      walletBalance: _asDouble(json['wallet_balance']),
      nextRenewalEstimate: _asDouble(json['next_renewal_estimate']),
      outstandingBillCount: _asInt(json['outstanding_bill_count']),
      outstandingAmount: _asDouble(json['outstanding_amount']),
      alertLowBalance: _isTruthy(json['alert_low_balance']),
      alertOutstandingBills: _isTruthy(json['alert_outstanding_bills']),
      latestBills: rawBills.map(SubscriptionBillModel.fromJson).toList(),
    );
  }
}

class SubscriptionScheduleModel {
  final String? subscriptionItemId;
  final int dayOfWeek;
  final int mQuantity;
  final int eQuantity;
  final String? effectiveFrom;
  final String? effectiveTo;

  const SubscriptionScheduleModel({
    this.subscriptionItemId,
    required this.dayOfWeek,
    this.mQuantity = 0,
    this.eQuantity = 0,
    this.effectiveFrom,
    this.effectiveTo,
  });

  factory SubscriptionScheduleModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionScheduleModel(
      subscriptionItemId: _asString(
        json['subscription_item_id'] ?? json['subscriptionItemId'],
      ),
      dayOfWeek: _asInt(json['day_of_week'] ?? json['dayOfWeek'] ?? json['day']),
      mQuantity: _asInt(
        json['m_quantity'] ??
            json['mQuantity'] ??
            json['m_qty'] ??
            json['morning_qty'],
      ),
      eQuantity: _asInt(
        json['e_quantity'] ??
            json['eQuantity'] ??
            json['e_qty'] ??
            json['evening_qty'],
      ),
      effectiveFrom: _asString(json['effective_from'] ?? json['effectiveFrom']),
      effectiveTo: _asString(json['effective_to'] ?? json['effectiveTo']),
    );
  }

  String get dayName {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek.clamp(0, 6)];
  }

  bool get hasDelivery => mQuantity > 0 || eQuantity > 0;
}

class SubscriptionCustomDateModel {
  final String id;
  final String subscriptionId;
  final String subscriptionItemId;
  final String deliveryDate;
  final int mQuantity;
  final int eQuantity;

  const SubscriptionCustomDateModel({
    required this.id,
    required this.subscriptionId,
    required this.subscriptionItemId,
    required this.deliveryDate,
    this.mQuantity = 0,
    this.eQuantity = 0,
  });

  factory SubscriptionCustomDateModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionCustomDateModel(
      id: _asString(json['id'] ?? json['custom_date_id']) ?? '',
      subscriptionId:
          _asString(json['subscription_id'] ?? json['subscriptionId']) ?? '',
      subscriptionItemId:
          _asString(
            json['subscription_item_id'] ?? json['subscriptionItemId'],
          ) ??
          '',
      deliveryDate:
          _asString(json['delivery_date'] ?? json['deliveryDate']) ?? '',
      mQuantity: _asInt(json['m_quantity'] ?? json['mQuantity']),
      eQuantity: _asInt(json['e_quantity'] ?? json['eQuantity']),
    );
  }

  bool get hasDelivery => mQuantity > 0 || eQuantity > 0;
}

class SubscriptionPauseModel {
  final String id;
  final String subscriptionId;
  final String subscriptionItemId;
  final String? startDate;
  final String? endDate;
  final String? reason;
  final String? status; // 'paused' | 'resumed'

  const SubscriptionPauseModel({
    required this.id,
    required this.subscriptionId,
    this.subscriptionItemId = '',
    this.startDate,
    this.endDate,
    this.reason,
    this.status,
  });

  factory SubscriptionPauseModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionPauseModel(
      id: _asString(json['id']) ?? '',
      subscriptionId:
          _asString(json['subscription_id'] ?? json['subscriptionId']) ?? '',
      subscriptionItemId:
          _asString(
            json['subscription_item_id'] ?? json['subscriptionItemId'],
          ) ??
          '',
      startDate: _asString(
        json['start_date'] ??
            json['paused_at'] ??
            json['pause_from_date'] ??
            json['pauseFromDate'],
      ),
      endDate: _asString(
        json['end_date'] ??
            json['resumed_at'] ??
            json['pause_to_date'] ??
            json['pauseToDate'],
      ),
      reason: _asString(json['reason']),
      status: _asString(json['status']),
    );
  }

  bool get isCurrentlyPaused {
    final end = endDate;
    if (end == null || end.isEmpty) return true;

    final parsedEnd = DateTime.tryParse(end);
    if (parsedEnd == null) {
      return end == '2099-12-31';
    }

    final today = DateTime.now();
    final currentDay = DateTime(today.year, today.month, today.day);
    final endDay = DateTime(parsedEnd.year, parsedEnd.month, parsedEnd.day);
    return !endDay.isBefore(currentDay);
  }

  String? get pausedAt => startDate;
  String? get resumedAt => endDate;
}

class SubscriptionBillItemModel {
  final String billItemId;
  final String billId;
  final String productVariantId;
  final int quantity;
  final double unitPrice;
  final double totalAmount;

  const SubscriptionBillItemModel({
    required this.billItemId,
    required this.billId,
    required this.productVariantId,
    required this.quantity,
    required this.unitPrice,
    required this.totalAmount,
  });

  factory SubscriptionBillItemModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionBillItemModel(
      billItemId: _asString(json['bill_item_id'] ?? json['id']) ?? '',
      billId: _asString(json['bill_id']) ?? '',
      productVariantId: _asString(json['product_variant_id']) ?? '',
      quantity: _asInt(json['quantity']),
      unitPrice: _asDouble(json['unit_price']),
      totalAmount: _asDouble(json['total_amount']),
    );
  }
}

class SubscriptionBillModel {
  final String billId;
  final String customerId;
  final String billType;
  final String referenceId;
  final String paymentType;
  final String? billingFrom;
  final String? billingTo;
  final String? dueDate;
  final double subtotal;
  final double discountAmount;
  final double taxAmount;
  final double totalAmount;
  final double paidAmount;
  final double dueAmount;
  final String status;
  final String? remarks;
  final List<SubscriptionBillItemModel> items;

  const SubscriptionBillModel({
    required this.billId,
    required this.customerId,
    required this.billType,
    required this.referenceId,
    required this.paymentType,
    this.billingFrom,
    this.billingTo,
    this.dueDate,
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.totalAmount,
    required this.paidAmount,
    required this.dueAmount,
    required this.status,
    this.remarks,
    this.items = const [],
  });

  factory SubscriptionBillModel.fromJson(Map<String, dynamic> json) {
    final rawItems = _asListOfMaps(json['items']);
    return SubscriptionBillModel(
      billId: _asString(json['bill_id'] ?? json['id']) ?? '',
      customerId: _asString(json['customer_id']) ?? '',
      billType: _asString(json['bill_type']) ?? 'subscription',
      referenceId: _asString(json['reference_id']) ?? '',
      paymentType: _asString(json['payment_type']) ?? 'prepaid',
      billingFrom: _asString(json['billing_from']),
      billingTo: _asString(json['billing_to']),
      dueDate: _asString(json['due_date']),
      subtotal: _asDouble(json['subtotal']),
      discountAmount: _asDouble(json['discount_amount']),
      taxAmount: _asDouble(json['tax_amount']),
      totalAmount: _asDouble(json['total_amount']),
      paidAmount: _asDouble(json['paid_amount']),
      dueAmount: _asDouble(json['due_amount']),
      status: _asString(json['status']) ?? 'paid',
      remarks: _asString(json['remarks']),
      items: rawItems.map(SubscriptionBillItemModel.fromJson).toList(),
    );
  }
}

class SubscriptionItemModel {
  final String id;
  final String subscriptionId;
  final String productVariantId;
  final String productName;
  final String variantName;
  final String sku;
  final int defaultMQty;
  final int defaultEQty;
  final double unitPrice;
  final double finalPrice;
  final double originalPrice;
  final int discount;
  final String status;
  final String? startDate;
  final String? endDate;
  final String? imageUrl;
  final List<SubscriptionScheduleModel> weeklySchedules;
  final List<SubscriptionCustomDateModel> customDates;

  const SubscriptionItemModel({
    required this.id,
    required this.subscriptionId,
    required this.productVariantId,
    this.productName = 'Product',
    this.variantName = '',
    this.sku = '',
    this.defaultMQty = 0,
    this.defaultEQty = 0,
    this.unitPrice = 0,
    this.finalPrice = 0,
    this.originalPrice = 0,
    this.discount = 0,
    this.status = 'active',
    this.startDate,
    this.endDate,
    this.imageUrl,
    this.weeklySchedules = const [],
    this.customDates = const [],
  });

  factory SubscriptionItemModel.fromJson(Map<String, dynamic> json) {
    final unitP = _asDouble(json['unit_price'] ?? json['unitPrice'] ?? json['price']);
    final origP = _asDouble(json['original_price'] ?? json['originalPrice']);
    final disc = _asInt(json['discount'] ?? json['discount_percentage']);

    return SubscriptionItemModel(
      id:
          _asString(
            json['subscription_item_id'] ?? json['id'] ?? json['si_id'],
          ) ??
          '',
      subscriptionId:
          _asString(json['subscription_id'] ?? json['subscriptionId']) ?? '',
      productVariantId:
          _asString(
            json['product_variant_id'] ??
                json['variant_id'] ??
                json['productVariantId'],
          ) ??
          '',
      productName:
          (_asString(json['product_name'] ?? json['name']) ?? 'Product')
              .toTitleCase(),
      variantName: _asString(json['variant_name'] ?? json['name']) ?? '',
      sku: _asString(json['sku']) ?? '',
      defaultMQty: _asInt(json['default_m_quantity'] ?? json['defaultMQty']),
      defaultEQty: _asInt(json['default_e_quantity'] ?? json['defaultEQty']),
      unitPrice: unitP,
      finalPrice: _asDouble(json['final_price'] ?? json['finalPrice']),
      originalPrice: origP > 0 ? origP : unitP,
      discount: disc > 0
          ? disc
          : (origP > unitP && origP > 0
              ? (((origP - unitP) / origP) * 100).round()
              : 0),
      status: (_asString(json['item_status'] ?? json['status']) ?? 'active').toLowerCase() == 'paused'
          ? 'active'
          : (_asString(json['item_status'] ?? json['status']) ?? 'active'),
      startDate: _asString(json['item_start_date'] ?? json['start_date']),
      endDate: _asString(json['item_end_date'] ?? json['end_date']),
      imageUrl: _asString(
        json['url'] ?? json['image_url'] ?? json['imagePath'],
      ),
      weeklySchedules: _asListOfMaps(
        json['weekly_schedules'] ?? json['weeklySchedules'],
      ).map(SubscriptionScheduleModel.fromJson).toList(),
      customDates: _asListOfMaps(
        json['custom_dates'] ?? json['customDates'],
      ).map(SubscriptionCustomDateModel.fromJson).toList(),
    );
  }

  String get displayName {
    if (variantName.isNotEmpty &&
        variantName.toLowerCase() != 'standard' &&
        variantName.toLowerCase().trim() != productName.toLowerCase().trim()) {
      return '$productName ($variantName)';
    }
    return productName;
  }

  int get totalDailyQty => defaultMQty + defaultEQty;

  String get slotLabel {
    if (defaultMQty > 0 && defaultEQty > 0) return 'Morning & Evening';
    if (defaultEQty > 0) return 'Evening';
    return 'Morning';
  }

  bool get hasCustomSchedule => customDates.isNotEmpty;
}

class Subscription {
  final String id;
  final String subscriptionNumber;
  final String customerId;
  final String status;
  final String scheduleType;
  final String paymentType;
  final String deliverySlot;
  final bool autoRenew;
  final String? startDate;
  final String? endDate;
  final String? pauseFromDate;
  final String? pauseToDate;
  final String addressId;
  final String branchId;
  final String? createdAt;
  final String? updatedAt;
  final String? notes;

  final List<SubscriptionItemModel> items;
  final List<SubscriptionScheduleModel> weeklySchedules;
  final List<SubscriptionCustomDateModel> customDates;
  final List<SubscriptionPauseModel> pauses;
  final List<SubscriptionBillModel> bills;
  final Map<String, dynamic>? customerInfo;

  final String productName;
  final String vendorName;
  final String emoji;
  final double pricePerDay;
  final String frequency;
  final String slot;
  final int qty;

  final String? imageUrl;
  final double? monthlyEstimate;

  const Subscription({
    required this.id,
    this.subscriptionNumber = '',
    this.customerId = '',
    required this.status,
    this.scheduleType = 'weekly',
    this.paymentType = 'prepaid',
    this.deliverySlot = 'Morning',
    this.autoRenew = true,
    this.startDate,
    this.endDate,
    this.pauseFromDate,
    this.pauseToDate,
    this.addressId = '',
    this.branchId = '',
    this.createdAt,
    this.updatedAt,
    this.notes,
    this.items = const [],
    this.weeklySchedules = const [],
    this.customDates = const [],
    this.pauses = const [],
    this.bills = const [],
    this.customerInfo,
    required this.productName,
    required this.vendorName,
    required this.emoji,
    required this.pricePerDay,
    required this.frequency,
    required this.slot,
    required this.qty,
    this.imageUrl,
    this.monthlyEstimate,
  });

  bool get isPaused =>
      status.toLowerCase() == 'paused' ||
      (pauseFromDate != null && pauseFromDate!.isNotEmpty);
  bool get isActive =>
      status.toLowerCase() == 'active' &&
      (pauseFromDate == null || pauseFromDate!.isEmpty);
  bool get isCompleted => status == 'completed';
  bool get isRenewed => status == 'renewed';
  bool get isExpired => status == 'expired' || status == 'expaired';
  bool get hasCustomSchedule =>
      scheduleType == 'custom_dates' ||
      customDates.isNotEmpty ||
      items.any((item) => item.customDates.isNotEmpty);

  double get totalDailyCost {
    if (items.isEmpty) return pricePerDay * (qty > 0 ? qty : 1);
    final calculated = items.fold<double>(
      0,
      (sum, item) {
        final itemPrice = item.finalPrice > 0 ? item.finalPrice : item.unitPrice;
        final itemQty = item.totalDailyQty > 0 ? item.totalDailyQty : 1;
        return sum + (itemPrice * itemQty);
      },
    );
    if (calculated > 0) return calculated;
    return pricePerDay > 0 ? pricePerDay * (qty > 0 ? qty : 1) : 0.0;
  }

  double get totalMonthlyCost {
    if (monthlyEstimate != null && monthlyEstimate! > 0) {
      return monthlyEstimate!;
    }
    final isWeekly = scheduleType == 'weekly' || frequency.toLowerCase().contains('week');
    if (isWeekly) {
      final dayQtys = getSelectedDayQuantities();
      final totalWeeklyQty = dayQtys.fold<int>(0, (sum, dq) => sum + dq.quantity);
      if (totalWeeklyQty > 0) {
        final unitPrice = (items.isNotEmpty && items.first.unitPrice > 0)
            ? items.first.unitPrice
            : (pricePerDay > 0 ? pricePerDay : 0.0);
        return (unitPrice * totalWeeklyQty * 52) / 12;
      }
    }
    return totalDailyCost * 30;
  }

  List<SubscriptionCustomDateModel> get allCustomDates {
    final collected = <SubscriptionCustomDateModel>[
      ...customDates,
      ...items.expand((item) => item.customDates),
    ];
    return collected;
  }

  SubscriptionPauseModel? get currentPause {
    for (final pause in pauses) {
      if (pause.isCurrentlyPaused) return pause;
    }
    return null;
  }

  List<SubscriptionPauseModel> get pauseHistory =>
      List<SubscriptionPauseModel>.unmodifiable(pauses);

  String get displayLabel =>
      subscriptionNumber.isNotEmpty ? subscriptionNumber : id;

  List<DayQty> getSelectedDayQuantities([
    List<SubscriptionScheduleModel>? itemSchedules,
  ]) {
    final schedules = (itemSchedules != null && itemSchedules.isNotEmpty)
        ? itemSchedules
        : (weeklySchedules.isNotEmpty
            ? weeklySchedules
            : items.expand((i) => i.weeklySchedules).toList());

    const fullDayNames = [
      'Sun',
      'Mon',
      'Tues',
      'Wed',
      'Thurs',
      'Fri',
      'Sat',
    ];

    if (schedules.isNotEmpty) {
      final Map<int, ({int m, int e})> dayMap = {};
      for (final sch in schedules) {
        final dow = sch.dayOfWeek.clamp(0, 6);
        final current = dayMap[dow] ?? (m: 0, e: 0);
        dayMap[dow] = (
          m: current.m + sch.mQuantity,
          e: current.e + sch.eQuantity
        );
      }

      final result = <DayQty>[];
      final sortedKeys = dayMap.keys.toList()..sort();
      for (final dow in sortedKeys) {
        final data = dayMap[dow]!;
        final total = data.m + data.e;
        if (total > 0) {
          result.add(DayQty(
            dayName: fullDayNames[dow],
            quantity: total,
            morningQty: data.m,
            eveningQty: data.e,
          ));
        }
      }
      if (result.isNotEmpty) return result;
    }

    final freq = frequency.toLowerCase();
    final defaultQty = qty > 0 ? qty : 1;

    if (freq.contains('daily') || freq.contains('everyday')) {
      return List.generate(
        7,
        (i) => DayQty(
          dayName: fullDayNames[i],
          quantity: defaultQty,
        ),
      );
    }

    final result = <DayQty>[];
    for (int i = 0; i < fullDayNames.length; i++) {
      final fullName = fullDayNames[i];
      final shortKey = fullName.substring(0, 3).toLowerCase();
      if (freq.contains(shortKey) || freq.contains(fullName.toLowerCase())) {
        result.add(DayQty(
          dayName: fullName,
          quantity: defaultQty,
        ));
      }
    }

    if (result.isNotEmpty) return result;

    return [
      DayQty(dayName: 'Everyday', quantity: defaultQty),
    ];
  }

  factory Subscription.fromJson(Map<String, dynamic> json) {
    final rawItems = _asListOfMaps(json['items']);
    final items = rawItems.map(SubscriptionItemModel.fromJson).toList();
    final weeklySchedules = _asListOfMaps(
      json['weekly_schedules'] ?? json['weeklySchedules'],
    ).map(SubscriptionScheduleModel.fromJson).toList();
    final customDates = _asListOfMaps(
      json['custom_dates'] ?? json['customDates'],
    ).map(SubscriptionCustomDateModel.fromJson).toList();
    final pauses = _asListOfMaps(
      json['pauses'],
    ).map(SubscriptionPauseModel.fromJson).toList();
    final bills = _asListOfMaps(
      json['bills'],
    ).map(SubscriptionBillModel.fromJson).toList();
    final customerInfo = json['customer_info'] is Map<String, dynamic>
        ? json['customer_info'] as Map<String, dynamic>
        : (json['customer_info'] is Map
            ? Map<String, dynamic>.from(json['customer_info'])
            : null);

    final normalizedItems = items.isNotEmpty
        ? items
        : <SubscriptionItemModel>[
            if (_asString(json['product_variant_id']) != null)
              SubscriptionItemModel(
                id: _asString(json['subscription_item_id'] ?? json['id']) ?? '',
                subscriptionId:
                    _asString(json['subscription_id'] ?? json['id']) ?? '',
                productVariantId: _asString(json['product_variant_id']) ?? '',
                productName:
                    (_asString(json['product_name'] ?? json['name']) ??
                            'Product')
                        .toTitleCase(),
                variantName:
                    _asString(json['variant_name'] ?? json['name']) ?? '',
                sku: _asString(json['sku']) ?? '',
                defaultMQty: _asInt(json['default_m_quantity']),
                defaultEQty: _asInt(json['default_e_quantity']),
                unitPrice: _asDouble(json['unit_price']),
                finalPrice: _asDouble(json['final_price']),
                status: (_asString(json['item_status'] ?? json['status']) ?? 'active').toLowerCase() == 'paused'
                    ? 'active'
                    : (_asString(json['item_status'] ?? json['status']) ?? 'active'),
                startDate: _asString(
                  json['item_start_date'] ?? json['start_date'],
                ),
                endDate: _asString(json['item_end_date'] ?? json['end_date']),
                imageUrl: _asString(
                  json['url'] ?? json['image_url'] ?? json['imagePath'],
                ),
              ),
          ];

    final productLabel = normalizedItems.isNotEmpty
        ? normalizedItems.first.displayName
        : (_asString(json['product_name'] ?? json['name']) ?? 'Subscription')
              .toTitleCase();
    final vendorLabel =
        normalizedItems.isNotEmpty && normalizedItems.first.sku.isNotEmpty
        ? normalizedItems.first.sku
        : _asString(json['vendor_name'] ?? json['branch_name']) ??
              'F2H Partner';
    final quantityTotal = normalizedItems.isNotEmpty
        ? normalizedItems.fold<int>(0, (sum, item) => sum + (item.totalDailyQty > 0 ? item.totalDailyQty : 1))
        : _asInt(json['qty'] ?? json['quantity']);
    double dailyCost = 0.0;
    if (normalizedItems.isNotEmpty) {
      dailyCost = normalizedItems.fold<double>(
        0,
        (sum, item) {
          final itemPrice = item.finalPrice > 0 ? item.finalPrice : item.unitPrice;
          final itemQty = item.totalDailyQty > 0 ? item.totalDailyQty : 1;
          return sum + (itemPrice * itemQty);
        },
      );
    }
    if (dailyCost <= 0) {
      dailyCost = _asDouble(json['price_per_day'] ?? json['pricePerDay'] ?? json['price'] ?? json['unit_price']);
    }
    final frequencyLabel = weeklySchedules.isNotEmpty
        ? weeklySchedules
              .where((schedule) => schedule.hasDelivery)
              .map((schedule) => schedule.dayName)
              .toSet()
              .join(', ')
        : _asString(json['frequency']) ?? 'Weekly';
    final slotLabel =
        _asString(json['delivery_slot'] ?? json['slot']) ??
        (normalizedItems.isNotEmpty
            ? normalizedItems.first.slotLabel
            : 'Morning');
    final emoji = _emojiForProduct(productLabel);

    return Subscription(
      id: _asString(json['subscription_id'] ?? json['id']) ?? '',
      subscriptionNumber: _asString(json['subscription_number']) ?? '',
      customerId: _asString(json['customer_id']) ?? '',
      status: (_asString(json['status']) ?? 'active').toLowerCase() == 'expired' ||
              (_asString(json['status']) ?? 'active').toLowerCase() == 'expaired'
          ? 'expired'
          : (_asString(json['status']) ?? 'active').toLowerCase() == 'paused'
              ? 'active'
              : (_asString(json['status']) ?? 'active'),
      scheduleType: _asString(json['schedule_type']) ?? 'weekly',
      paymentType: (_asString(json['payment_type'] ?? json['payment_mode'] ?? json['paymentMode']) ?? 'prepaid').toLowerCase(),
      deliverySlot: slotLabel,
      autoRenew: _isTruthy(json['auto_renew'] ?? json['autoRenew']),
      startDate: _asString(json['start_date'] ?? json['startDate']),
      endDate: _asString(json['end_date'] ?? json['endDate']),
      pauseFromDate: _asString(
        json['pause_from_date'] ??
            json['pause_start_date'] ??
            json['pauseFromDate'],
      ),
      pauseToDate: _asString(
        json['pause_to_date'] ?? json['pause_end_date'] ?? json['pauseToDate'],
      ),
      addressId:
          _asString(
            json['address_id'] ?? json['addressId'] ?? json['action_id'],
          ) ??
          '',
      branchId: _asString(json['branch_id'] ?? json['branchId']) ?? '',
      createdAt: _asString(json['created_at'] ?? json['createdAt']),
      updatedAt: _asString(json['updated_at'] ?? json['updatedAt']),
      notes: _asString(json['notes'] ?? json['remark']),
      items: normalizedItems,
      weeklySchedules: weeklySchedules,
      customDates: customDates,
      pauses: pauses,
      bills: bills,
      customerInfo: customerInfo,
      productName: productLabel,
      vendorName: vendorLabel,
      emoji: emoji,
      pricePerDay: dailyCost,
      frequency: frequencyLabel.isEmpty ? 'Weekly' : frequencyLabel,
      slot: slotLabel,
      qty: quantityTotal,
    );
  }
}
