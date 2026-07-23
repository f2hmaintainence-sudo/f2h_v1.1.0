CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    -- Business order number
    order_id VARCHAR(30) NOT NULL UNIQUE
        DEFAULT ('ORD_' || upper(substr(gen_random_uuid()::text, 1, 12))),

    -- Customer and subscription references (string-based IDs)
    customer_id VARCHAR(30) NOT NULL,

    customer_name VARCHAR(150) NOT NULL,
    -- from customer_address

    order_source VARCHAR(20),
    -- subscription
    -- one_time

    subscription_id VARCHAR(30) DEFAULT NULL,

    generation_type VARCHAR(20),
    -- cron
    -- manual
    -- event

    -- Delivery and routing
    address_id VARCHAR(30) NOT NULL,

    address_line  VARCHAR(150) NOT NULL,
    -- from customer_address

    contact_number VARCHAR(15) NOT NULL,
    -- from customer_address

    branch_id VARCHAR(30) DEFAULT NULL,

    -- Delivery schedule
    delivery_slot VARCHAR(20) NOT NULL,

    scheduled_date DATE NOT NULL,

    -- Order status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Amounts
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,

    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Payment
    payment_mode VARCHAR(20) DEFAULT NULL,

    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Delivery assignment
    delivery_partner_id VARCHAR(30) DEFAULT NULL,

    delivery_run_id VARCHAR(30) DEFAULT NULL,

    -- Notes
    special_instructions TEXT DEFAULT NULL,
    is_arriving_notified BOOLEAN,
    run_sequence INT DEFAULT NULL,
    assignment_method varchar(30),
    assigned_at timestamp null,
    
    -- Image fields
    invoice_image VARCHAR(255) DEFAULT NULL,
    delivery_image VARCHAR(255) DEFAULT NULL,
    payment_screenshot VARCHAR(255) DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by  VARCHAR(50) DEFAULT 'SYSTEM',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_subscription_delivery UNIQUE (
        subscription_id,
        scheduled_date,
        delivery_slot
    )
);
