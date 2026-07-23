CREATE TABLE "delivery_location_logs" (
  "id" SERIAL PRIMARY KEY,
  "delivery_partner_id" INT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "recorded_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
