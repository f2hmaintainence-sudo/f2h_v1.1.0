CREATE TABLE "auth_user_devices" (
  "id" bigint  NOT NULL,
  "device_id" VARCHAR(50)   NOT NULL,
  "user_id" VARCHAR(30)   NOT NULL,
  "device_info" text  ,
  "ip_address" VARCHAR(50)   DEFAULT NULL,
  "first_seen_at" timestamp NULL DEFAULT NULL,
  "last_seen_at" timestamp NULL DEFAULT NULL,
  "login_count" int  NOT NULL DEFAULT '1',
  "deleted_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP 
);
