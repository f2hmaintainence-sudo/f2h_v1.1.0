-- ============================================================
-- Migration 078: Backfill products.image_path from product_images
-- ============================================================
-- After the image architecture refactor, products.image_path is the
-- single source of truth for product images.  product_images records
-- with variant_id IS NULL and is_primary = true were the old way of
-- storing a product's primary image.
-- This one-off migration copies those URLs into products.image_path
-- so no product loses its image when the showEdit query is removed.
-- ============================================================

UPDATE products p
SET image_path = pi.url,
    updated_at = NOW()
FROM product_images pi
WHERE pi.product_id = p.product_id
  AND pi.variant_id IS NULL
  AND pi.is_primary = true
  AND pi.deleted_at IS NULL
  AND (p.image_path IS NULL OR p.image_path = '');

-- Verify the result (optional — run manually after migration)
-- SELECT p.product_id, p.name, p.image_path
-- FROM products p
-- WHERE p.image_path IS NOT NULL
-- ORDER BY p.created_at DESC
-- LIMIT 20;
