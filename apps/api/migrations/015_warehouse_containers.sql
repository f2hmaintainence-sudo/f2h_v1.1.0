-- ============================================================================
-- Migration: 015_warehouse_containers.sql
-- Description: Create warehouse_containers table for per-warehouse container stock
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.warehouse_containers (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id VARCHAR(100) NOT NULL,
    container_id VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT uq_warehouse_container UNIQUE (warehouse_id, container_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_containers_wh ON public.warehouse_containers (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_containers_cont ON public.warehouse_containers (container_id);

-- Ensure containers table has deleted_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'containers' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.containers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;
