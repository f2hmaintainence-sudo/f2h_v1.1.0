CREATE TABLE "delivery_tracking" (
  "id" int NOT NULL,
  "tracking_id" VARCHAR(20) NOT NULL,
  "order_id" int NOT NULL,
  "delivery_partner_id" int NOT NULL,
  "status" VARCHAR(255) NOT NULL,
  "latitude" decimal(9,6) DEFAULT NULL,
  "longitude" decimal(9,6) DEFAULT NULL,
  "proof_image" VARCHAR(500) DEFAULT NULL,
  "notes" text,
  "tracked_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" int DEFAULT NULL,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ,
  "updated_by" int DEFAULT NULL,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "deleted_by" int DEFAULT NULL
);
