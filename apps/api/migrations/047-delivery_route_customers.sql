CREATE TABLE delivery_route_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    customer_id INT NOT NULL,
    sequence_number INT NOT NULL DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_route_customer ON delivery_route_customers(route_id, customer_id);
CREATE INDEX idx_customer_route ON delivery_route_customers(customer_id);
