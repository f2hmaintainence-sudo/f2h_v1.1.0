CREATE TABLE "auth_logs" (
  "id" bigint  NOT NULL,
  "user_id" VARCHAR(30)   DEFAULT NULL,
  "email" VARCHAR(50)   NOT NULL,
  "device_info" text  ,
  "ip_address" VARCHAR(255)   DEFAULT NULL,
  "session_token" text  ,
  "login_at" timestamp NULL DEFAULT NULL,
  "login_via" VARCHAR(30)   DEFAULT NULL,
  "logout_at" timestamp NULL DEFAULT NULL,
  "is_online" SMALLINT NOT NULL DEFAULT '0',
  "last_activity_at" timestamp NULL DEFAULT NULL,
  "deleted_at" TIMESTAMP DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
);
