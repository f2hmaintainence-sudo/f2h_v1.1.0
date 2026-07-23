CREATE TABLE "user_devices" (
  "id" int NOT NULL ,
  "user_id" VARCHAR(50)   NOT NULL ,
  "device_id" VARCHAR(255)   NOT NULL ,
  "device_name" VARCHAR(255)   DEFAULT NULL ,
  "device_info" json DEFAULT NULL ,
  "ip_address" text ,
  "is_active" SMALLINT DEFAULT '1' ,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ,
  "last_used" timestamp NULL DEFAULT CURRENT_TIMESTAMP  ,
  "revoked_at" timestamp NULL DEFAULT NULL 
);
