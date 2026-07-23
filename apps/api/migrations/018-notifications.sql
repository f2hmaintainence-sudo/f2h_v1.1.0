CREATE TABLE "notifications" (
  "id" bigint  NOT NULL,
  "notification_id" VARCHAR(30)   NOT NULL,
  "title" VARCHAR(255)   NOT NULL,
  "message" text  ,
  "medium" VARCHAR(30)   DEFAULT NULL,
  "type" VARCHAR(255)   DEFAULT NULL,
  "priority" VARCHAR(255)   DEFAULT 'medium',
  "sender_id" VARCHAR(30)   DEFAULT NULL,
  "status" VARCHAR(255)   DEFAULT 'active',
  "created_by" VARCHAR(30)   NOT NULL,
  "updated_by" VARCHAR(30)   DEFAULT NULL,
  "delete_on" timestamp NULL DEFAULT NULL,
  "restored_at" timestamp NULL DEFAULT NULL,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP 
);
