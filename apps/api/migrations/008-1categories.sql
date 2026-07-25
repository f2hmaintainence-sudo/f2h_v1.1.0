-- Create categories table
CREATE TABLE public.categories
(
    id SERIAL PRIMARY KEY,
    category_id VARCHAR(100) NOT NULL,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image_path TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    parent_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);