-- ============================================================================
-- Migration   : 030-backfill-subscription-bill-items.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-22
-- Description : Populate missing customer_bill_items for existing subscription bills,
--               calculating actual item quantities from schedules over billing period.
-- ============================================================================

INSERT INTO public.customer_bill_items (
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
SELECT 
  agg.bill_id,
  'subscription',
  agg.subscription_id,
  agg.product_variant_id,
  agg.final_qty,
  agg.unit_price,
  ROUND(agg.discount_amount * agg.final_qty, 2) AS discount_amount,
  0 AS tax_amount,
  CASE 
    WHEN ROUND(agg.final_qty * (agg.unit_price - agg.discount_amount), 2) > 0 
      THEN ROUND(agg.final_qty * (agg.unit_price - agg.discount_amount), 2)
    WHEN agg.items_count = 1 AND agg.bill_total > 0 
      THEN agg.bill_total
    ELSE ROUND(agg.final_qty * agg.unit_price, 2)
  END AS total_amount,
  NOW()
FROM (
  SELECT 
    b.bill_id,
    b.subscription_id,
    b.bill_total,
    si.product_variant_id,
    COALESCE(NULLIF(si.final_price, 0), si.unit_price, 0) AS unit_price,
    COALESCE(si.discount_amount, 0) AS discount_amount,
    (SELECT COUNT(*) FROM public.subscription_items si2 WHERE si2.subscription_id = b.subscription_id AND si2.deleted_at IS NULL) AS items_count,
    CASE 
      WHEN COALESCE(SUM(ws.m_quantity + ws.e_quantity), 0) > 0 
        THEN SUM(ws.m_quantity + ws.e_quantity)
      WHEN COALESCE(NULLIF(si.final_price, 0), si.unit_price, 0) > 0 AND b.bill_total > 0 
        THEN GREATEST(1, ROUND(b.bill_total / COALESCE(NULLIF(si.final_price, 0), si.unit_price, 0)))
      ELSE 1
    END AS final_qty
  FROM (
    SELECT 
      cb.bill_id,
      cb.reference_id AS subscription_id,
      cb.total_amount AS bill_total,
      d.dt
    FROM public.customer_bills cb
    CROSS JOIN LATERAL generate_series(
      COALESCE(cb.billing_from::date, cb.created_at::date),
      COALESCE(cb.billing_to::date, cb.created_at::date),
      '1 day'::interval
    ) AS d(dt)
    WHERE (cb.bill_type = 'subscription' OR cb.reference_id LIKE 'SUB_%')
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_bill_items cbi WHERE cbi.bill_id = cb.bill_id
      )
  ) b
  JOIN public.subscription_items si ON si.subscription_id = b.subscription_id AND si.deleted_at IS NULL
  LEFT JOIN public.subscription_weekly_schedule ws 
    ON ws.subscription_item_id = si.subscription_item_id 
    AND ws.day_of_week = EXTRACT(DOW FROM b.dt)::int
  GROUP BY b.bill_id, b.subscription_id, b.bill_total, si.subscription_item_id, si.product_variant_id, si.final_price, si.unit_price, si.discount_amount
) agg;
