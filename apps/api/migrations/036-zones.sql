CREATE TABLE "zones" (
  "id" bigint  NOT NULL,
  "zone_id" VARCHAR(30)  NOT NULL,
  "name" VARCHAR(100)  NOT NULL,
  "code" VARCHAR(50)  DEFAULT NULL,
  "description" text ,
  "is_active" SMALLINT DEFAULT '1',
  "created_by" VARCHAR(30)  NOT NULL,
  "updated_by" VARCHAR(30)  NOT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ,
  "deleted_at" timestamp NULL DEFAULT NULL
);
