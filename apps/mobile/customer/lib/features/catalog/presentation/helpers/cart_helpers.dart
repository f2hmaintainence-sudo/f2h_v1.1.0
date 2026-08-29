// ═══════════════════════════════════════════════════════════════════════════
//  CART HELPERS — Shared pricing & calculation logic for Cart and Checkout
//  
//  BUSINESS RULES: 
//    - Subscription items ALWAYS use `subscriptionPrice` (from product_variants).
//    - One-time items ALWAYS use `unitPrice` (the normal selling price).
//    - These prices must NEVER be mixed in Cart, Checkout, or Order Summary.
//    - Subscription totals use delivery-count formula:
//        Estimated Total = Total Deliveries × (Morning Qty + Evening Qty) × Subscription Price
//    - One-time totals use simple: unitPrice × quantity
// ═══════════════════════════════════════════════════════════════════════════

import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';

// ===== Effective Price Resolution =====

/// Returns the correct unit price for the given cart item based on purchase type.
///
/// - Subscription items → use [subscriptionPrice] if available, else [unitPrice].
/// - One-time items → always use [unitPrice].
///
/// NOTE: Preserves a legacy hardcoded override for variant 'VRTDWK8K2X1O' (₹99)
/// until the backend sends the correct subscription_price for that variant.
double getEffectivePrice(CartItemEntity item) {
  final isSub = item.purchaseType == 'subscription';

  // Legacy override: specific variant always priced at ₹99 for subscriptions
  if (isSub && item.variantId == 'VRTDWK8K2X1O') {
    return 99.0;
  }

  if (isSub && item.subscriptionPrice != null && item.subscriptionPrice! > 0) {
    return item.subscriptionPrice!;
  }

  // For one-time orders, always return the normal selling price
  return item.unitPrice;
}

// ===== One-Time Delivery Date Rules =====

int _parseCutoffMinutes(dynamic timeStr, int defaultMinutes) {
  if (timeStr == null || timeStr is! String) return defaultMinutes;
  final parts = timeStr.split(':');
  if (parts.length < 2) return defaultMinutes;
  final h = int.tryParse(parts[0]) ?? 0;
  final m = int.tryParse(parts[1]) ?? 0;
  return h * 60 + m;
}

/// Returns the list of allowed delivery dates based on current time and slot cutoffs.
///
/// RULES:
///   - Before Evening Customer Cutoff (default 16:00 / 4:00 PM):
///       • Today is allowed (Evening slot only — enforced by [getAvailableSlots])
///       • Tomorrow and next 30 days
///   - After Evening Customer Cutoff (16:00 onwards):
///       • Today is NOT allowed
///       • Tomorrow (default) and next 30 days
///
/// Returns a list of [DateTime] objects (date-only, no time component).
List<DateTime> getAllowedDeliveryDates(DateTime now, [Map<String, dynamic>? slotTimings]) {
  final List<DateTime> dates = [];
  final nowMinutes = now.hour * 60 + now.minute;

  final eveningCutoffMinutes = _parseCutoffMinutes(
    slotTimings?['evening_slot']?['customer_cutoff_time'],
    16 * 60, // 16:00 (4:00 PM)
  );

  final isBeforeEveningCutoff = nowMinutes < eveningCutoffMinutes;

  // If before evening cutoff (16:00), include Today
  if (isBeforeEveningCutoff) {
    dates.add(DateTime(now.year, now.month, now.day));
  }

  // Add Tomorrow through +30 days
  for (int i = 1; i <= 30; i++) {
    final d = now.add(Duration(days: i));
    dates.add(DateTime(d.year, d.month, d.day));
  }

  return dates;
}

/// Returns the default delivery date based on current time.
///
/// - Before Evening Cutoff (16:00) → Today (user can get Evening delivery same day)
/// - After Evening Cutoff → Tomorrow
DateTime getDefaultDeliveryDate(DateTime now, [Map<String, dynamic>? slotTimings]) {
  final nowMinutes = now.hour * 60 + now.minute;
  final eveningCutoffMinutes = _parseCutoffMinutes(
    slotTimings?['evening_slot']?['customer_cutoff_time'],
    16 * 60, // 16:00 (4:00 PM)
  );

  if (nowMinutes < eveningCutoffMinutes) {
    return DateTime(now.year, now.month, now.day); // Today
  }
  final tomorrow = now.add(const Duration(days: 1));
  return DateTime(tomorrow.year, tomorrow.month, tomorrow.day);
}

/// Returns the first allowed date (used as `firstDate` in date pickers).
///
/// - Before Evening Cutoff (16:00) → Today
/// - After Evening Cutoff → Tomorrow
DateTime getFirstAllowedDate(DateTime now, [Map<String, dynamic>? slotTimings]) {
  return getDefaultDeliveryDate(now, slotTimings);
}

// ===== One-Time Delivery Slot Rules =====

/// Returns available delivery slots for the given [selectedDate].
///
/// RULES:
///   - If [selectedDate] == Today → ['Evening'] if before Evening Cutoff (16:00), else []
///   - If [selectedDate] == Tomorrow → ['Morning', 'Evening'] if before Morning Cutoff (23:00), else ['Evening']
///   - If [selectedDate] >= Day+2 → ['Morning', 'Evening']
///
/// Compares date-only (ignores time component).
List<String> getAvailableSlots(DateTime selectedDate, DateTime now, [Map<String, dynamic>? slotTimings]) {
  final today = DateTime(now.year, now.month, now.day);
  final tomorrow = today.add(const Duration(days: 1));
  final selected = DateTime(selectedDate.year, selectedDate.month, selectedDate.day);
  final nowMinutes = now.hour * 60 + now.minute;

  final eveningCutoffMinutes = _parseCutoffMinutes(
    slotTimings?['evening_slot']?['customer_cutoff_time'],
    16 * 60, // 16:00 (4:00 PM)
  );

  final morningCutoffMinutes = _parseCutoffMinutes(
    slotTimings?['morning_slot']?['customer_cutoff_time'],
    23 * 60, // 23:00 (11:00 PM)
  );

  if (selected.isAtSameMomentAs(today)) {
    // Today: only Evening slot available if before evening cutoff (16:00)
    // Morning slot was closed yesterday night and is NEVER available on same-day.
    if (nowMinutes < eveningCutoffMinutes) {
      return ['Evening'];
    }
    return [];
  }

  if (selected.isAtSameMomentAs(tomorrow)) {
    // Tomorrow: Morning slot available only before morning cutoff (23:00 today)
    if (nowMinutes < morningCutoffMinutes) {
      return ['Morning', 'Evening'];
    }
    // After 23:00, tomorrow morning is closed, only tomorrow evening is available
    return ['Evening'];
  }

  // Future days: both slots available
  return ['Morning', 'Evening'];
}

/// Returns the default slot for a given date.
///
/// - Today → ALWAYS 'Evening' (Morning is never available on same-day)
/// - Tomorrow+ → 'Morning' (or 'Evening' if morning is closed after 23:00)
String getDefaultSlot(DateTime selectedDate, DateTime now, [Map<String, dynamic>? slotTimings]) {
  final today = DateTime(now.year, now.month, now.day);
  final selected = DateTime(selectedDate.year, selectedDate.month, selectedDate.day);
  final available = getAvailableSlots(selectedDate, now, slotTimings);

  if (selected.isAtSameMomentAs(today)) {
    return available.contains('Evening') ? 'Evening' : '';
  }

  if (available.contains('Morning')) return 'Morning';
  if (available.contains('Evening')) return 'Evening';
  return 'Morning';
}

// ===== Quantity Helpers =====

/// Calculates the total weekly quantity for a subscription item from its schedules.
///
/// Each schedule entry has a [day] (0=Mon..6=Sun), [mQuantity] (morning), 
/// and [eQuantity] (evening). This sums all morning + evening quantities.
/// Returns at least 1 to avoid zero-division in price calculations.
int getWeeklyQuantity(CartItemEntity item) {
  if (item.schedules == null || item.schedules!.isEmpty) return 1;

  final total = item.schedules!.fold<int>(
    0,
    (sum, s) => sum + s.mQuantity + s.eQuantity,
  );

  // Ensure minimum 1 to avoid zero-quantity display issues
  return total > 0 ? total : 1;
}

/// Returns the quantity for display/calculation depending on purchase type.
///
/// Subscription items derive quantity from schedules (weekly total).
/// One-time items use their own independent [quantity] field.
/// These are NEVER mixed — switching modes does NOT carry over quantities.
int getItemQuantity(CartItemEntity item) {
  if (item.purchaseType == 'subscription') {
    return getWeeklyQuantity(item);
  }
  return item.quantity ?? 1;
}

// ===== Total Calculations =====

/// Calculates the total cost for all ONE-TIME items in the list.
///
/// Formula: unitPrice × quantity (for each one-time item)
/// Skips subscription items entirely.
double calculateOneTimeTotal(List<CartItemEntity> items) {
  double total = 0;
  for (final item in items) {
    if (item.purchaseType != 'onetime') continue;
    final price = item.unitPrice; // One-time always uses normal price
    final qty = item.quantity ?? 1;
    total += price * qty;
  }
  return total;
}

/// Calculates the total WEEKLY cost for all SUBSCRIPTION items in the list.
///
/// Uses [subscriptionPrice] (via getEffectivePrice) × weekly quantity
/// from the item's schedules. Skips one-time items.
double calculateSubscriptionWeeklyTotal(List<CartItemEntity> items) {
  double total = 0;
  for (final item in items) {
    if (item.purchaseType != 'subscription') continue;
    final price = getEffectivePrice(item);
    final qty = getWeeklyQuantity(item);
    total += price * qty;
  }
  return total;
}

/// Calculates the combined total for all items (both one-time and subscription).
///
/// This is the "cart total" shown in the bill summary. Subscription items
/// use their weekly cost (not monthly estimate).
double calculateGrandTotal(List<CartItemEntity> items) {
  double total = 0;
  for (final item in items) {
    final price = getEffectivePrice(item);
    final qty = getItemQuantity(item);
    total += price * qty;
  }
  return total;
}

// ===== Subscription Estimation =====

/// Counts actual delivery days between [startDate] and [endDate] (inclusive)
/// for the given [activeWeekdays].
///
/// [activeWeekdays] uses Dart's DateTime.weekday convention (1=Mon..7=Sun).
/// This is the primary function for calculating estimated delivery counts.
int calculateEstimatedDeliveryDays(
  DateTime startDate,
  DateTime endDate,
  List<int> activeWeekdays,
) {
  if (activeWeekdays.isEmpty) return 0;

  int count = 0;
  DateTime current = DateTime(startDate.year, startDate.month, startDate.day);
  final end = DateTime(endDate.year, endDate.month, endDate.day);

  while (!current.isAfter(end)) {
    if (activeWeekdays.contains(current.weekday)) {
      count++;
    }
    current = current.add(const Duration(days: 1));
  }

  return count;
}

/// Calculates the number of remaining delivery days from [startDate] to the
/// end of the current month, filtered by which [selectedWeekdays] are active.
///
/// Convenience wrapper around [calculateEstimatedDeliveryDays] that
/// automatically uses end-of-month as the end date.
int getRemainingDeliveryDays(DateTime startDate, List<int> selectedWeekdays) {
  if (selectedWeekdays.isEmpty) return 0;
  final endOfMonth = DateTime(startDate.year, startDate.month + 1, 0);
  return calculateEstimatedDeliveryDays(startDate, endOfMonth, selectedWeekdays);
}

/// Extracts the active weekdays from a subscription item's schedules.
///
/// Returns a list of Dart-convention weekday numbers (1=Mon..7=Sun)
/// for days that have any quantity (morning or evening > 0).
List<int> getActiveWeekdays(CartItemEntity item) {
  if (item.schedules == null || item.schedules!.isEmpty) {
    // Daily mode default: all 7 days
    return [1, 2, 3, 4, 5, 6, 7];
  }

  final weekdays = <int>[];
  for (final s in item.schedules!) {
    if (s.mQuantity > 0 || s.eQuantity > 0) {
      // Schedule day is 0-indexed (0=Mon..6=Sun), Dart weekday is 1-indexed
      weekdays.add(s.day + 1);
    }
  }
  return weekdays;
}

/// Calculates the estimated subscription cost from [startDate] to end of month.
///
/// FORMULA:
///   Estimated Total = Σ (for each active schedule day):
///     occurrences_of_that_weekday × (morning_qty + evening_qty) × subscription_price
///
/// This correctly accounts for:
///   - Different quantities per day (Custom mode)
///   - Same quantity all days (Daily mode)
///   - Partial months (subscription starts mid-month)
///   - Both morning AND evening quantities
///
/// Returns a record with totalDays, totalQuantity, unitPrice, estimatedAmount,
/// morningQty, and eveningQty.
({
  int totalDays,
  int totalQuantity,
  double unitPrice,
  double estimatedAmount,
  int totalMorningQty,
  int totalEveningQty,
}) calculateSubscriptionEstimate(
  List<CartItemEntity> subscriptionItems,
  DateTime startDate,
) {
  final endOfMonth = DateTime(startDate.year, startDate.month + 1, 0);

  int totalDays = 0;
  int totalQuantity = 0;
  int totalMorningQty = 0;
  int totalEveningQty = 0;
  double estimatedAmount = 0;
  double unitPrice = 0;

  for (final item in subscriptionItems) {
    if (item.purchaseType != 'subscription') continue;

    final price = getEffectivePrice(item);
    unitPrice = price;

    if (item.schedules != null && item.schedules!.isNotEmpty) {
      // Track unique weekdays to avoid double-counting delivery days
      final Set<int> countedWeekdays = {};

      for (final s in item.schedules!) {
        final dayQty = s.mQuantity + s.eQuantity;
        if (dayQty > 0) {
          // Count how many times this specific weekday occurs from start to month end
          final dartWeekday = s.day + 1; // Convert 0-indexed to 1-indexed
          final thisDayCount = calculateEstimatedDeliveryDays(
            startDate, endOfMonth, [dartWeekday],
          );

          // Only count unique delivery days (not per-slot)
          if (!countedWeekdays.contains(dartWeekday)) {
            totalDays += thisDayCount;
            countedWeekdays.add(dartWeekday);
          }

          // Total quantity = (morning + evening) × occurrences
          totalQuantity += dayQty * thisDayCount;
          totalMorningQty += s.mQuantity * thisDayCount;
          totalEveningQty += s.eQuantity * thisDayCount;

          // Estimated amount = subscription_price × (morning + evening) × occurrences
          estimatedAmount += price * dayQty.toDouble() * thisDayCount.toDouble();
        }
      }
    } else {
      // No schedules — assume daily with qty 1 morning
      final activeWeekdays = [1, 2, 3, 4, 5, 6, 7];
      final deliveryDays = calculateEstimatedDeliveryDays(
        startDate, endOfMonth, activeWeekdays,
      );
      totalDays += deliveryDays;
      totalQuantity += deliveryDays;
      totalMorningQty += deliveryDays;
      estimatedAmount += price * deliveryDays;
    }
  }

  return (
    totalDays: totalDays,
    totalQuantity: totalQuantity,
    unitPrice: unitPrice,
    estimatedAmount: estimatedAmount,
    totalMorningQty: totalMorningQty,
    totalEveningQty: totalEveningQty,
  );
}

// ===== Monthly Savings Calculation =====

/// Calculates the monthly savings by comparing normal price vs subscription price.
///
/// FORMULA:
///   Savings = (Normal Variant Price - Subscription Price) × Total Estimated Quantity
///   Savings % = (Savings / Normal Price Total) × 100
///
/// Uses the same delivery-count logic as [calculateSubscriptionEstimate] to
/// determine total estimated quantity.
///
/// Returns a record with all values needed for the MonthlySavingsCard widget.
({
  double normalPriceTotal,
  double subscriptionTotal,
  double savings,
  double savingsPercent,
  int totalDeliveryDays,
  int totalEstimatedQuantity,
}) calculateMonthlySavings(
  List<CartItemEntity> subscriptionItems,
  DateTime startDate,
) {
  final endOfMonth = DateTime(startDate.year, startDate.month + 1, 0);

  double normalPriceTotal = 0;
  double subscriptionTotal = 0;
  int totalDeliveryDays = 0;
  int totalEstimatedQuantity = 0;

  for (final item in subscriptionItems) {
    if (item.purchaseType != 'subscription') continue;

    final normalPrice = item.unitPrice; // Always the normal selling price
    final subPrice = getEffectivePrice(item); // Subscription price

    if (item.schedules != null && item.schedules!.isNotEmpty) {
      final Set<int> countedWeekdays = {};

      for (final s in item.schedules!) {
        final dayQty = s.mQuantity + s.eQuantity;
        if (dayQty > 0) {
          final dartWeekday = s.day + 1;
          final thisDayCount = calculateEstimatedDeliveryDays(
            startDate, endOfMonth, [dartWeekday],
          );

          if (!countedWeekdays.contains(dartWeekday)) {
            totalDeliveryDays += thisDayCount;
            countedWeekdays.add(dartWeekday);
          }

          totalEstimatedQuantity += dayQty * thisDayCount;
          normalPriceTotal += normalPrice * dayQty.toDouble() * thisDayCount.toDouble();
          subscriptionTotal += subPrice * dayQty.toDouble() * thisDayCount.toDouble();
        }
      }
    } else {
      final deliveryDays = calculateEstimatedDeliveryDays(
        startDate, endOfMonth, [1, 2, 3, 4, 5, 6, 7],
      );
      totalDeliveryDays += deliveryDays;
      totalEstimatedQuantity += deliveryDays;
      normalPriceTotal += normalPrice * deliveryDays;
      subscriptionTotal += subPrice * deliveryDays;
    }
  }

  final savings = normalPriceTotal - subscriptionTotal;
  final savingsPercent = normalPriceTotal > 0
      ? (savings / normalPriceTotal) * 100
      : 0.0;

  return (
    normalPriceTotal: normalPriceTotal,
    subscriptionTotal: subscriptionTotal,
    savings: savings,
    savingsPercent: savingsPercent,
    totalDeliveryDays: totalDeliveryDays,
    totalEstimatedQuantity: totalEstimatedQuantity,
  );
}
