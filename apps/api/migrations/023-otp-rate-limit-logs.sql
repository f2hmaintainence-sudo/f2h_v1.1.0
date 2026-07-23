CREATE TABLE "otp_rate_limit_logs" (
  "id" int  NOT NULL,
  "phone" VARCHAR(20)   NOT NULL,
  "type" VARCHAR(30)   NOT NULL,
  "attempt_number" int NOT NULL,
  "ip_address" VARCHAR(45)   NOT NULL,
  "deleted_at" TIMESTAMPTZ DEFAULT NULL,
  "created_by" VARCHAR(100) DEFAULT NULL,
  "updated_by" VARCHAR(100) DEFAULT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
