CREATE TABLE "auth_session_history" (
  "id" bigint  NOT NULL,
  "device_id" VARCHAR(50)   DEFAULT NULL,
  "user_id" VARCHAR(30)   NOT NULL,
  "session_id" VARCHAR(200)   NOT NULL,
  "email" VARCHAR(255)   NOT NULL,
  "event" VARCHAR(255)   NOT NULL,
  "event_via" VARCHAR(50)   DEFAULT NULL,
  "event_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" VARCHAR(50)   DEFAULT NULL,
  "device_info" text  ,
  "location" VARCHAR(220)   DEFAULT NULL,
  "deleted_at" TIMESTAMP DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP 
);
