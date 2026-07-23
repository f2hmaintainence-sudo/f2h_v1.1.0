CREATE TABLE "auth_login_attempts" (
  "id" bigint  NOT NULL,
  "email" VARCHAR(255)   NOT NULL,
  "business_id" VARCHAR(30)   NOT NULL,
  "ip_address" VARCHAR(50)   DEFAULT NULL,
  "device_id" VARCHAR(50)   NOT NULL,
  "device_info" text   NOT NULL,
  "event" VARCHAR(255)   NOT NULL,
  "attempt_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP 
);
