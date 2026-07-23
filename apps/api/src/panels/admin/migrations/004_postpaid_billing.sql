-- Migration: 004_postpaid_billing.sql
-- Description: Creates postpaid_bill_orders table and performance indexes for Postpaid Billing module

-- 1. Create postpaid_bill_orders table to map bills to orders
CREATE TABLE IF NOT EXISTS public.postpaid_bill_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid NOT NULL REFERENCES public.postpaid_bills(id) ON DELETE CASCADE,
  order_id character varying(30) NOT NULL,
  order_amount numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Performance indexes on postpaid_bill_orders
CREATE INDEX IF NOT EXISTS idx_postpaid_bill_orders_bill_id ON public.postpaid_bill_orders(bill_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_postpaid_bill_orders_order_id ON public.postpaid_bill_orders(order_id);

-- 3. Performance indexes on orders table (Requirement 15)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON public.orders(scheduled_date);

-- 4. Ensure status index on postpaid_bills exists
CREATE INDEX IF NOT EXISTS idx_postpaid_bills_status ON public.postpaid_bills(status);
CREATE INDEX IF NOT EXISTS idx_postpaid_bills_customer_id ON public.postpaid_bills(customer_id);
