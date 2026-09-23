export interface SubscriptionBillItemData {
  subscription_item_id?: string;
  product_variant_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

export function parseDateToUtcMs(dateStrOrObj: string | Date): number {
  if (dateStrOrObj instanceof Date) {
    return Date.UTC(
      dateStrOrObj.getUTCFullYear(),
      dateStrOrObj.getUTCMonth(),
      dateStrOrObj.getUTCDate(),
    );
  }
  const s = String(dateStrOrObj).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Calculates item quantities and amounts for a subscription over a billing period.
 */
export async function calculateSubscriptionBillItems(
  dbOrClient: { query: (sql: string, params?: any[]) => Promise<any> },
  subscriptionId: string,
  billingFrom: string | Date,
  billingTo: string | Date,
  fallbackTotalAmount?: number,
): Promise<SubscriptionBillItemData[]> {
  // 1. Fetch subscription details
  const subRes = await dbOrClient.query(
    `SELECT subscription_id, schedule_type, start_date, end_date, metadata
     FROM public.subscriptions
     WHERE subscription_id = $1
     LIMIT 1`,
    [subscriptionId],
  );
  const subRows = subRes?.rows || subRes;
  const sub = subRows?.[0];

  // 2. Fetch active subscription items
  const itemsRes = await dbOrClient.query(
    `SELECT subscription_item_id, product_variant_id, unit_price, discount_amount, final_price, status
     FROM public.subscription_items
     WHERE subscription_id = $1 AND deleted_at IS NULL
     ORDER BY id ASC`,
    [subscriptionId],
  );
  const itemRows = itemsRes?.rows || itemsRes || [];
  if (!Array.isArray(itemRows) || itemRows.length === 0) {
    return [];
  }

  // 3. Fetch weekly schedules
  const schedRes = await dbOrClient.query(
    `SELECT subscription_item_id, day_of_week, m_quantity, e_quantity
     FROM public.subscription_weekly_schedule
     WHERE subscription_id = $1 AND deleted_at IS NULL`,
    [subscriptionId],
  );
  const schedRows = schedRes?.rows || schedRes || [];

  const startUtc = parseDateToUtcMs(billingFrom);
  const endUtc = parseDateToUtcMs(billingTo);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const isCustomDates = sub?.schedule_type === 'custom_dates' || sub?.schedule_type === 'custom';
  let customDatesSet: Set<string> | null = null;
  if (isCustomDates) {
    try {
      const meta = typeof sub?.metadata === 'string' ? JSON.parse(sub.metadata) : sub?.metadata;
      const dates = Array.isArray(meta?.custom_dates) ? meta.custom_dates : [];
      customDatesSet = new Set(dates.map((d: any) => String(d).split('T')[0]));
    } catch {
      customDatesSet = null;
    }
  }

  const result: SubscriptionBillItemData[] = [];

  for (const item of itemRows) {
    const itemId = item.subscription_item_id;
    const unitPrice = Number(item.unit_price ?? item.final_price ?? 0);
    const perUnitDiscount = Number(item.discount_amount ?? 0);
    const itemScheds = schedRows.filter((s: any) => s.subscription_item_id === itemId);

    let calculatedQty = 0;

    if (isCustomDates && customDatesSet) {
      for (let t = startUtc; t <= endUtc; t += ONE_DAY_MS) {
        const dtStr = new Date(t).toISOString().split('T')[0];
        if (customDatesSet.has(dtStr)) {
          // Default to sum of schedule quantities or 1
          const dayOfWeek = new Date(t).getUTCDay();
          const match = itemScheds.find((s: any) => Number(s.day_of_week) === dayOfWeek);
          const dayQty = match
            ? Number(match.m_quantity || 0) + Number(match.e_quantity || 0)
            : 1;
          calculatedQty += dayQty > 0 ? dayQty : 1;
        }
      }
    } else {
      // Weekly recurring schedule
      for (let t = startUtc; t <= endUtc; t += ONE_DAY_MS) {
        const dayOfWeek = new Date(t).getUTCDay();
        const match = itemScheds.find((s: any) => Number(s.day_of_week) === dayOfWeek);
        if (match) {
          calculatedQty += Number(match.m_quantity || 0) + Number(match.e_quantity || 0);
        }
      }
    }

    // Fallback: If calculatedQty is 0 but fallbackTotalAmount is given
    if (calculatedQty === 0 && fallbackTotalAmount && fallbackTotalAmount > 0 && unitPrice > 0) {
      calculatedQty = Math.max(1, Math.round(fallbackTotalAmount / (unitPrice - perUnitDiscount || unitPrice)));
    } else if (calculatedQty === 0) {
      calculatedQty = 1;
    }

    const discountTotal = Math.round(perUnitDiscount * calculatedQty * 100) / 100;
    const itemTotal = Math.max(0, Math.round((calculatedQty * (unitPrice - perUnitDiscount)) * 100) / 100);

    result.push({
      subscription_item_id: itemId,
      product_variant_id: item.product_variant_id,
      quantity: calculatedQty,
      unit_price: unitPrice,
      discount_amount: discountTotal,
      tax_amount: 0,
      total_amount: itemTotal,
    });
  }

  return result;
}

/**
 * Creates customer_bill_items records for a given subscription bill.
 */
export async function createSubscriptionBillItems(
  dbOrClient: { query: (sql: string, params?: any[]) => Promise<any> },
  billId: string,
  subscriptionId: string,
  billingFrom: string | Date,
  billingTo: string | Date,
  fallbackTotalAmount?: number,
): Promise<SubscriptionBillItemData[]> {
  const items = await calculateSubscriptionBillItems(
    dbOrClient,
    subscriptionId,
    billingFrom,
    billingTo,
    fallbackTotalAmount,
  );

  for (const it of items) {
    await dbOrClient.query(
      `INSERT INTO public.customer_bill_items (
        bill_id,
        reference_type,
        reference_id,
        product_variant_id,
        quantity,
        unit_price,
        discount_amount,
        tax_amount,
        total_amount,
        created_at
      )
      VALUES ($1, 'subscription', $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        billId,
        subscriptionId,
        it.product_variant_id,
        it.quantity,
        it.unit_price,
        it.discount_amount,
        it.tax_amount,
        it.total_amount,
      ],
    );
  }

  return items;
}
