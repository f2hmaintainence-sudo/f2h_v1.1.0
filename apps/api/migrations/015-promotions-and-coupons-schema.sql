-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 015-promotions-and-coupons-schema.sql
-- Description : Complete schema definition for promotions, coupons,
--               promotion products, redemptions, and product banners.
-- ============================================================================

-- 1. Enums (created safely if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type_enum') THEN
        CREATE TYPE promotion_type_enum AS ENUM ('percentage', 'fixed_amount');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_status_enum') THEN
        CREATE TYPE promotion_status_enum AS ENUM ('draft', 'active', 'paused', 'expired');
    END IF;
END $$;

-- 2. Promotions Table
CREATE TABLE IF NOT EXISTS public.promotions (
    id                          BIGSERIAL PRIMARY KEY,
    promotion_id                VARCHAR(30) NOT NULL UNIQUE,
    name                        VARCHAR(150) NOT NULL,
    description                 TEXT,
    promotion_type              promotion_type_enum NOT NULL DEFAULT 'percentage',
    discount_value              NUMERIC(10,2) NOT NULL,
    max_discount_amount         NUMERIC(10,2),
    minimum_order_amount        NUMERIC(10,2) DEFAULT 0,
    status                      promotion_status_enum DEFAULT 'draft',
    start_at                    TIMESTAMPTZ,
    end_at                      TIMESTAMPTZ,
    first_order_only            BOOLEAN DEFAULT false,
    usage_limit                 INTEGER,
    usage_limit_per_customer    INTEGER DEFAULT 1,
    auto_apply                  BOOLEAN DEFAULT true,
    allow_subscription_orders   BOOLEAN NOT NULL DEFAULT false,
    stackable                   BOOLEAN NOT NULL DEFAULT false,
    apply_to_all_products       BOOLEAN NOT NULL DEFAULT false,
    created_by                  VARCHAR(30),
    updated_by                  VARCHAR(30),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_auto_apply ON public.promotions(auto_apply) WHERE deleted_at IS NULL AND status = 'active';

-- 3. Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id                          BIGSERIAL PRIMARY KEY,
    coupon_id                   VARCHAR(30) NOT NULL UNIQUE,
    promotion_id                VARCHAR(30) NOT NULL REFERENCES public.promotions(promotion_id) ON DELETE CASCADE,
    code                        VARCHAR(50) NOT NULL UNIQUE,
    name                        VARCHAR(100),
    description                 TEXT,
    status                      VARCHAR(20) DEFAULT 'active',
    usage_limit                 INTEGER,
    usage_limit_per_customer    INTEGER DEFAULT 1,
    used_count                  INTEGER DEFAULT 0,
    start_at                    TIMESTAMPTZ,
    end_at                      TIMESTAMPTZ,
    created_by                  VARCHAR(30),
    updated_by                  VARCHAR(30),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(UPPER(code)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_promotion_id ON public.coupons(promotion_id);

-- 4. Promotion Products Table (targeted variants)
CREATE TABLE IF NOT EXISTS public.promotion_products (
    id                          BIGSERIAL PRIMARY KEY,
    promotion_id                VARCHAR(30) NOT NULL REFERENCES public.promotions(promotion_id) ON DELETE CASCADE,
    product_variant_id          VARCHAR(100) NOT NULL REFERENCES public.product_variants(variant_id),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (promotion_id, product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_products_promo ON public.promotion_products(promotion_id);

-- 5. Promotion Redemptions Table
CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
    id                          BIGSERIAL PRIMARY KEY,
    redemption_id               VARCHAR(30) NOT NULL UNIQUE,
    promotion_id                VARCHAR(30) NOT NULL REFERENCES public.promotions(promotion_id),
    customer_id                 VARCHAR(30) NOT NULL REFERENCES public.customers(customer_id),
    order_id                    VARCHAR(30) NOT NULL,
    discount_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
    redeemed_at                 TIMESTAMPTZ DEFAULT NOW(),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (promotion_id, customer_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_customer ON public.promotion_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_promo ON public.promotion_redemptions(promotion_id);

-- 6. Coupon Redemptions Table
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id                          BIGSERIAL PRIMARY KEY,
    redemption_id               VARCHAR(30) NOT NULL UNIQUE,
    coupon_id                   VARCHAR(30) NOT NULL REFERENCES public.coupons(coupon_id),
    promotion_id                VARCHAR(30) NOT NULL REFERENCES public.promotions(promotion_id),
    customer_id                 VARCHAR(30) NOT NULL REFERENCES public.customers(customer_id),
    order_id                    VARCHAR(30) NOT NULL,
    discount_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
    redeemed_at                 TIMESTAMPTZ DEFAULT NOW(),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (coupon_id, customer_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer ON public.coupon_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);

-- 7. Product Banner Table Columns Alignment
CREATE TABLE IF NOT EXISTS public.product_banner (
    id                          SERIAL PRIMARY KEY,
    title                       VARCHAR(255),
    discount_text               VARCHAR(255),
    description                 TEXT,
    action_type                 VARCHAR(100) DEFAULT 'CATEGORY',
    action_value                VARCHAR(255),
    cta_label                   VARCHAR(100) DEFAULT 'Shop Now',
    display_order               INTEGER DEFAULT 0,
    is_active                   BOOLEAN DEFAULT true,
    image_url                   TEXT,
    image_path                  TEXT,
    background_color            VARCHAR(50) DEFAULT '#16a34a',
    banner_type                 VARCHAR(50) DEFAULT 'home_carousel',
    category_id                 VARCHAR(50),
    is_popup                    BOOLEAN DEFAULT false,
    created_by                  VARCHAR(50),
    updated_by                  VARCHAR(50),
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at                  TIMESTAMP
);

-- Ensure all columns exist in product_banner if table already existed
DO $$
BEGIN
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS background_color VARCHAR(50) DEFAULT '#16a34a';
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50) DEFAULT 'home_carousel';
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS category_id VARCHAR(50);
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS is_popup BOOLEAN DEFAULT false;
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS action_value VARCHAR(255);
    ALTER TABLE public.product_banner ADD COLUMN IF NOT EXISTS cta_label VARCHAR(100) DEFAULT 'Shop Now';
END $$;
