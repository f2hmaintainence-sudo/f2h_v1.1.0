-- Create warehouse_contacts table
CREATE TABLE IF NOT EXISTS public.warehouse_contacts (
    id           BIGSERIAL PRIMARY KEY,
    contact_id   VARCHAR(50)  UNIQUE NOT NULL,
    warehouse_id VARCHAR(50)  NOT NULL,
    name         VARCHAR(150) NOT NULL,
    role         VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(150),
    is_primary   BOOLEAN      DEFAULT false,
    created_by   VARCHAR(50),
    updated_by   VARCHAR(50),
    created_at   TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ  DEFAULT now() NOT NULL,
    deleted_at   TIMESTAMPTZ,

    CONSTRAINT fk_warehouse_contacts_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES public.warehouses (warehouse_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for warehouse_contacts
CREATE INDEX idx_warehouse_contacts_warehouse_id ON public.warehouse_contacts(warehouse_id);
CREATE INDEX idx_warehouse_contacts_contact_id ON public.warehouse_contacts(contact_id);
CREATE INDEX idx_warehouse_contacts_is_primary ON public.warehouse_contacts(is_primary);
CREATE INDEX idx_warehouse_contacts_deleted_at ON public.warehouse_contacts(deleted_at);
CREATE INDEX idx_warehouse_contacts_created_at ON public.warehouse_contacts(created_at);
