CREATE TABLE "delivery_calendar" (
  "id" int NOT NULL,
  "calendar_id" VARCHAR(20) NOT NULL,
  "zone_id" int DEFAULT NULL,
  "date" date NOT NULL,
  "day_type" VARCHAR(255) NOT NULL,
  "delivery_slot" VARCHAR(255) DEFAULT 'both',
  "reason" VARCHAR(255) DEFAULT NULL,
  "is_blocked" SMALLINT NOT NULL DEFAULT '1',
  "created_by" int DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ,
  "updated_by" int DEFAULT NULL,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "deleted_by" int DEFAULT NULL
);
