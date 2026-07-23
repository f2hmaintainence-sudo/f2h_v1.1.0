CREATE TABLE "auth_sessions" (
  "id" bigint  NOT NULL,
  "device_id" VARCHAR(50)   DEFAULT NULL,
  "user_id" VARCHAR(30)   NOT NULL,
  "session_id" VARCHAR(200)   NOT NULL,
  "email" VARCHAR(255)   NOT NULL,
  "ip_address" VARCHAR(50)   DEFAULT NULL,
  "device_info" text  ,
  "location" VARCHAR(220)   DEFAULT NULL,
  "login_at" timestamp NULL DEFAULT NULL,
  "last_activity_at" timestamp NULL DEFAULT NULL,
  "is_online" SMALLINT DEFAULT '1',
  "deleted_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP 
);
