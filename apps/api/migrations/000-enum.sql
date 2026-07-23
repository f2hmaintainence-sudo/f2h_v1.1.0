CREATE TYPE subscription_schedule_type_enum AS ENUM (
    'weekly',
    'custom_dates'
);
CREATE TYPE subscription_payment_type_enum AS ENUM (
    'prepaid',
    'postpaid'
);
CREATE TYPE subscription_status_enum AS ENUM (
    'active',
    'paused',
    'expired',
    'cancelled'
);
CREATE TYPE subscription_override_type_enum AS ENUM (
    'extra',
    'replace',
    'cancel',
    'cod'
);
CREATE TYPE subscription_delivery_status_enum AS ENUM (
    'pending',
    'packed',
    'dispatched',
    'delivered',
    'failed'
);
CREATE TYPE subscription_billing_status_enum AS ENUM (
    'pending',
    'invoiced',
    'paid'
);
CREATE TYPE true_or_false AS ENUM (
    'true',
    'false'
);
CREATE TYPE fulfillment_mode_enum AS ENUM (
    'bulk',
    'prepacked'
);
CREATE TYPE customer_status_enum AS ENUM (
    'active',
    'inactive',
    'blocked'
);
CREATE TYPE order_status_enum AS ENUM (
  'pending',
  'placed',
  'confirmed',
  'packed',
  'assigned',
  'out_for_delivery',
  'delivered',
  'cancelled'
);
CREATE TYPE product_unit_enum AS ENUM (
    'kg',
    'ltr',
    'ml',
    'gm',
    'piece',
    'pack'
);