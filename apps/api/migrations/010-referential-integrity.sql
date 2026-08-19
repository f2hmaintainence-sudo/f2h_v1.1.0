-- 010-referential-integrity.sql
--
-- Adds foreign keys to the tables the business actually runs on. Before this, the
-- database had 120 tables and 28 foreign keys, and none of them were on `orders`,
-- `subscriptions`, `customers`, `customer_bills`, or the wallet ledger — integrity
-- depended entirely on ~124 services getting it right.
--
-- Every constraint is added NOT VALID: PostgreSQL then enforces it for all NEW and
-- UPDATED rows immediately, takes no table scan, and does not block deployment on
-- pre-existing violations. Validation is a separate, non-blocking step (see the
-- VALIDATE section at the bottom) to be run off-peak once any orphans are resolved.
--
-- Known violation at the time of writing: 7 rows in `customers` reference a
-- `users` row that no longer exists, all with zero orders. Decide whether they are
-- deletable or need their user restored, then validate fk_customers_user.
--   SELECT c.customer_id FROM customers c
--     LEFT JOIN users u ON u.user_id = c.customer_id
--    WHERE u.user_id IS NULL;
--
-- ON DELETE RESTRICT is deliberate: a delete that would orphan an order should
-- fail loudly rather than cascade through financial records.

BEGIN;

-- ── Indexes on the referencing columns ──────────────────────────────────────
-- PostgreSQL does not index a foreign key automatically, and an unindexed FK makes
-- every delete on the parent scan the child table.
CREATE INDEX IF NOT EXISTS idx_orders_branch_id            ON public.orders (branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_address_id           ON public.orders (address_id);
CREATE INDEX IF NOT EXISTS idx_customer_bill_items_bill_id ON public.customer_bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer ON public.payment_transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id        ON public.payments (customer_id);

-- ── orders ──────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches (branch_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_address
  FOREIGN KEY (address_id) REFERENCES public.customer_addresses (address_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_delivery_partner
  FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners (delivery_partner_id)
  ON DELETE RESTRICT NOT VALID;

-- ── customers ───────────────────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD CONSTRAINT fk_customers_user
  FOREIGN KEY (customer_id) REFERENCES public.users (user_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.customers
  ADD CONSTRAINT fk_customers_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches (branch_id)
  ON DELETE RESTRICT NOT VALID;

-- ── customer_addresses ──────────────────────────────────────────────────────
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT fk_customer_addresses_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

-- ── subscriptions ───────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscriptions_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscriptions_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches (branch_id)
  ON DELETE RESTRICT NOT VALID;

-- ── billing ─────────────────────────────────────────────────────────────────
ALTER TABLE public.customer_bills
  ADD CONSTRAINT fk_customer_bills_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.customer_bill_items
  ADD CONSTRAINT fk_customer_bill_items_bill
  FOREIGN KEY (bill_id) REFERENCES public.customer_bills (bill_id)
  ON DELETE CASCADE NOT VALID;

-- ── wallet ledger ───────────────────────────────────────────────────────────
ALTER TABLE public.customer_wallet_transactions
  ADD CONSTRAINT fk_wallet_transactions_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

-- ── payments ────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT fk_payment_transactions_customer
  FOREIGN KEY (customer_id) REFERENCES public.customers (customer_id)
  ON DELETE RESTRICT NOT VALID;

-- ── delivery ────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_runs
  ADD CONSTRAINT fk_delivery_runs_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches (branch_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.delivery_runs
  ADD CONSTRAINT fk_delivery_runs_partner
  FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners (delivery_partner_id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.delivery_run_addresses
  ADD CONSTRAINT fk_delivery_run_addresses_run
  FOREIGN KEY (run_id) REFERENCES public.delivery_runs (run_id)
  ON DELETE CASCADE NOT VALID;

-- ── Money and status sanity ─────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD CONSTRAINT chk_customers_wallet_non_negative
  CHECK (wallet_balance >= 0) NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_total_non_negative
  CHECK (total_amount >= 0) NOT VALID;

ALTER TABLE public.customer_wallet_transactions
  ADD CONSTRAINT chk_wallet_transaction_amount_positive
  CHECK (amount >= 0) NOT VALID;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Run separately, off-peak, once orphans are resolved. VALIDATE takes only a
-- SHARE UPDATE EXCLUSIVE lock, so reads and writes continue during the scan.
-- Left commented so the migration itself never blocks a deploy.
--
-- ALTER TABLE public.orders                       VALIDATE CONSTRAINT fk_orders_customer;
-- ALTER TABLE public.orders                       VALIDATE CONSTRAINT fk_orders_branch;
-- ALTER TABLE public.orders                       VALIDATE CONSTRAINT fk_orders_address;
-- ALTER TABLE public.orders                       VALIDATE CONSTRAINT fk_orders_delivery_partner;
-- ALTER TABLE public.customers                    VALIDATE CONSTRAINT fk_customers_user;         -- 7 known orphans
-- ALTER TABLE public.customers                    VALIDATE CONSTRAINT fk_customers_branch;
-- ALTER TABLE public.customer_addresses           VALIDATE CONSTRAINT fk_customer_addresses_customer;
-- ALTER TABLE public.subscriptions                VALIDATE CONSTRAINT fk_subscriptions_customer;
-- ALTER TABLE public.subscriptions                VALIDATE CONSTRAINT fk_subscriptions_branch;
-- ALTER TABLE public.customer_bills               VALIDATE CONSTRAINT fk_customer_bills_customer;
-- ALTER TABLE public.customer_bill_items          VALIDATE CONSTRAINT fk_customer_bill_items_bill;
-- ALTER TABLE public.customer_wallet_transactions VALIDATE CONSTRAINT fk_wallet_transactions_customer;
-- ALTER TABLE public.payments                     VALIDATE CONSTRAINT fk_payments_customer;
-- ALTER TABLE public.payment_transactions         VALIDATE CONSTRAINT fk_payment_transactions_customer;
-- ALTER TABLE public.delivery_runs                VALIDATE CONSTRAINT fk_delivery_runs_branch;
-- ALTER TABLE public.delivery_runs                VALIDATE CONSTRAINT fk_delivery_runs_partner;
-- ALTER TABLE public.delivery_run_addresses       VALIDATE CONSTRAINT fk_delivery_run_addresses_run;
-- ALTER TABLE public.customers                    VALIDATE CONSTRAINT chk_customers_wallet_non_negative;
-- ALTER TABLE public.orders                       VALIDATE CONSTRAINT chk_orders_total_non_negative;
-- ALTER TABLE public.customer_wallet_transactions VALIDATE CONSTRAINT chk_wallet_transaction_amount_positive;
