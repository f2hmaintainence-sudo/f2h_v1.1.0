CREATE TABLE IF NOT EXISTS "role_assignments" (
  "id" bigint NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(30) NOT NULL,
  "role_id" VARCHAR(30) NOT NULL,
  "is_active" SMALLINT NOT NULL DEFAULT 1,
  "deleted_at" timestamp NULL DEFAULT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_role_assignments_user" ON "role_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_role_assignments_role" ON "role_assignments"("role_id");
