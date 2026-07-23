CREATE TABLE "roles" (
  "id" bigint NOT NULL,
  "sno" VARCHAR(10)   NOT NULL,
  "role_id" VARCHAR(30)   NOT NULL,
  "name" VARCHAR(255)   DEFAULT NULL,
  "description" text  ,
  "parent_role_id" VARCHAR(30)   DEFAULT NULL,
  "is_system_role" SMALLINT NOT NULL DEFAULT '0',
  "is_active" SMALLINT NOT NULL DEFAULT '1',
  "created_by" VARCHAR(30)   DEFAULT NULL,
  "updated_by" VARCHAR(30)   DEFAULT NULL,
  "delete_on" timestamp NULL DEFAULT NULL,
  "restored_at" timestamp NULL DEFAULT NULL,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP 
);
