-- Delivery Leave Requests Table
CREATE TABLE IF NOT EXISTS "delivery_leave_requests" (
  "id" SERIAL PRIMARY KEY,
  "delivery_partner_id" VARCHAR(30) NOT NULL,
  "leave_date" DATE NOT NULL,
  "end_date" DATE NULL,
  "leave_type" VARCHAR(50) DEFAULT 'FULL_DAY',
  "half_day_shift" VARCHAR(50) NULL,
  "reason" TEXT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "admin_remarks" TEXT NULL,
  "notified_at" TIMESTAMP NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP NULL
);

-- Schema Patches for Admin Dashboard & Logistics Services
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_path" text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "stock" integer NOT NULL DEFAULT 0;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "low_stock_threshold" integer NOT NULL DEFAULT 10;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" text;

UPDATE "customers" SET "full_name" = CONCAT("first_name", ' ', "last_name"), "phone" = "mobile" WHERE "full_name" IS NULL OR "phone" IS NULL;

-- Delivery Logs Container Tracking Columns
ALTER TABLE "delivery_logs" ADD COLUMN IF NOT EXISTS "returned_containers" integer DEFAULT 0;
ALTER TABLE "delivery_logs" ADD COLUMN IF NOT EXISTS "damaged_containers" integer DEFAULT 0;
ALTER TABLE "delivery_logs" ADD COLUMN IF NOT EXISTS "lost_containers" integer DEFAULT 0;
ALTER TABLE "delivery_logs" ADD COLUMN IF NOT EXISTS "proof_photo_url" text;
ALTER TABLE "delivery_logs" ADD COLUMN IF NOT EXISTS "delivery_time" timestamp with time zone;
