CREATE TABLE "sessions" (
  "id" VARCHAR(255)   NOT NULL,
  "user_id" VARCHAR(30)   DEFAULT NULL,
  "ip_address" VARCHAR(255)   DEFAULT NULL,
  "user_agent" text  ,
  "payload" TEXT   NOT NULL,
  "last_activity" int NOT NULL
);
