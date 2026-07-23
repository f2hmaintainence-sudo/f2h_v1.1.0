CREATE TABLE "password_history" (
  "id" int NOT NULL,
  "user_id" VARCHAR(50)   NOT NULL,
  "password_hash" VARCHAR(255)   NOT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP
);
