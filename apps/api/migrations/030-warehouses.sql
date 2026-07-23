-- Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses
(
    id              BIGSERIAL PRIMARY KEY,
    warehouse_id    VARCHAR(50)    UNIQUE NOT NULL,
    name            VARCHAR(200)   NOT NULL,
    code            VARCHAR(50)    UNIQUE NOT NULL,
    warehouse_type  VARCHAR(50)    NOT NULL,
    address_line_1  VARCHAR(255),
    address_line_2  VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100)   DEFAULT 'India',
    pincode         VARCHAR(20),
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    manager_name    VARCHAR(150),
    manager_phone   VARCHAR(20),
    manager_email   VARCHAR(150),
    capacity        NUMERIC(12,2),
    capacity_unit   VARCHAR(20)    DEFAULT 'ltr',
    temperature_type VARCHAR(50),
    is_active       BOOLEAN        DEFAULT true NOT NULL,
    notes           TEXT,
    created_by      VARCHAR(50),
    updated_by      VARCHAR(50),
    created_at      TIMESTAMPTZ    DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ    DEFAULT now() NOT NULL,
    deleted_at      TIMESTAMPTZ
);

-- Create indexes for warehouses
CREATE INDEX idx_warehouses_code ON public.warehouses(code);
CREATE INDEX idx_warehouses_warehouse_id ON public.warehouses(warehouse_id);
CREATE INDEX idx_warehouses_is_active ON public.warehouses(is_active);
CREATE INDEX idx_warehouses_deleted_at ON public.warehouses(deleted_at);
CREATE INDEX idx_warehouses_warehouse_type ON public.warehouses(warehouse_type);
CREATE INDEX idx_warehouses_created_at ON public.warehouses(created_at);
