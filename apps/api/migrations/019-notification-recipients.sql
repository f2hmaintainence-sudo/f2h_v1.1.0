CREATE TABLE "notification_recipients" (
  "id" bigint NOT NULL,
  "notification_id" VARCHAR(30)   NOT NULL,
  "user_id" VARCHAR(30)   NOT NULL,
  "html" text  ,
  "image" VARCHAR(30)   DEFAULT NULL,
  "status" VARCHAR(255)   DEFAULT 'unread',
  "notified_at" timestamp NULL DEFAULT NULL,
  "read_at" timestamp NULL DEFAULT NULL,
  "remind_at" timestamp NULL DEFAULT NULL,
  "created_by" VARCHAR(30)   NOT NULL,
  "updated_by" VARCHAR(30)   DEFAULT NULL,
  "delete_on" timestamp NULL DEFAULT NULL,
  "restored_at" timestamp NULL DEFAULT NULL,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP 
);
