import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';

export type UnavailableReason = 'not_found' | 'inactive' | 'out_of_stock';

export interface UnavailableVariant {
  variantId: string;
  /** Best available human label — variant name, falling back to the product name. */
  name: string;
  reason: UnavailableReason;
}

/**
 * Single source of truth for "may this variant be purchased right now".
 *
 * The customer catalog decides whether to render a variant as "Out of Stock"
 * in `CategoriesProductsService.getProducts`. Every write path (cart sync,
 * checkout, subscription create) has to answer that same question with the
 * same rule, otherwise the API accepts what the UI refuses to show — so the
 * expression lives here once and the catalog's own copy is documented against
 * it.
 *
 * Two details that are easy to get wrong:
 *
 *  - Stock lives in `stock_balances`, keyed by (warehouse_id, product_variant_id).
 *    `product_variants` has no quantity column at all. Availability is therefore
 *    warehouse-scoped: pass the warehouse behind the customer's branch, or pass
 *    null to aggregate across all warehouses (matching the catalog's fallback
 *    when the branch is unknown).
 *
 *  - `stock_balances.is_out_of_stock` is a plain nullable boolean on this
 *    database, not a generated column, and is left NULL on rows that have run
 *    down to zero. It cannot be trusted on its own; `available_quantity <= 0`
 *    is the load-bearing term. `products.is_out_of_stock` is a separate manual
 *    admin override and is honoured on top.
 */
@Injectable()
export class StockAvailabilityService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Maps a customer-facing branch to the warehouse whose stock it sells from.
   * Returns null for an unknown branch, which callers should treat as "count
   * every warehouse" — the same backward-compatible fallback the catalog uses.
   */
  async resolveWarehouseId(branchId?: string | null): Promise<string | null> {
    if (!branchId || branchId === 'ALL') return null;
    const rows = await this.db.query<{ warehouse_id: string }>(
      `SELECT warehouse_id
         FROM warehouses
        WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL
        LIMIT 1`,
      [branchId],
    );
    return rows?.[0]?.warehouse_id ?? null;
  }

  /**
   * Returns the subset of `variantIds` that cannot currently be purchased.
   * An empty array means every id is purchasable.
   */
  async findUnavailableVariants(
    variantIds: string[],
    warehouseId?: string | null,
  ): Promise<UnavailableVariant[]> {
    const wanted = Array.from(
      new Set((variantIds || []).filter((id) => typeof id === 'string' && id.length > 0)),
    );
    if (wanted.length === 0) return [];

    const rows = await this.db.query<{
      variant_id: string;
      variant_name: string | null;
      product_name: string | null;
      is_listable: boolean | null;
      is_out_of_stock: boolean | null;
    }>(
      `WITH sb AS (
         SELECT product_variant_id,
                COALESCE(SUM(available_quantity), 0) AS available_quantity,
                BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances
          WHERE deleted_at IS NULL
            AND ($2::varchar IS NULL OR warehouse_id = $2)
          GROUP BY product_variant_id
       )
       SELECT pv.variant_id,
              pv.name AS variant_name,
              p.name  AS product_name,
              ((pv.status = 'active' OR pv.status IS NULL)
                AND (p.is_active = true OR p.is_active IS NULL)
                AND p.deleted_at IS NULL) AS is_listable,
              (COALESCE(p.is_out_of_stock, false)
                OR COALESCE(sb.is_out_of_stock, false)
                OR COALESCE(sb.available_quantity, 0) <= 0) AS is_out_of_stock
         FROM product_variants pv
         LEFT JOIN products p ON pv.product_id = p.product_id
         LEFT JOIN sb ON sb.product_variant_id = pv.variant_id
        WHERE pv.variant_id = ANY($1)`,
      [wanted, warehouseId ?? null],
    );

    const byVariantId = new Map<string, (typeof rows)[number]>();
    for (const row of rows || []) byVariantId.set(row.variant_id, row);

    const unavailable: UnavailableVariant[] = [];
    for (const variantId of wanted) {
      const row = byVariantId.get(variantId);
      if (!row) {
        unavailable.push({ variantId, name: variantId, reason: 'not_found' });
        continue;
      }
      const name = row.variant_name || row.product_name || variantId;
      if (row.is_listable !== true) {
        unavailable.push({ variantId, name, reason: 'inactive' });
      } else if (row.is_out_of_stock === true) {
        unavailable.push({ variantId, name, reason: 'out_of_stock' });
      }
    }
    return unavailable;
  }

  /** Throws a BadRequestException naming every offending line. */
  async assertAllPurchasable(
    variantIds: string[],
    warehouseId?: string | null,
  ): Promise<void> {
    const unavailable = await this.findUnavailableVariants(variantIds, warehouseId);
    if (unavailable.length > 0) {
      throw new BadRequestException(this.describe(unavailable));
    }
  }

  /**
   * Asserts that every requested item not only exists and is active, but that
   * the requested quantity does not exceed the available stock balance.
   */
  async assertQuantitiesAvailable(
    items: { variantId: string; quantity: number }[],
    warehouseId?: string | null,
  ): Promise<void> {
    const variantIds = Array.from(
      new Set(items.map((i) => i.variantId).filter(Boolean)),
    );
    if (variantIds.length === 0) return;

    const rows = await this.db.query<{
      variant_id: string;
      variant_name: string | null;
      product_name: string | null;
      available_quantity: number | string | null;
      is_listable: boolean | null;
      is_out_of_stock: boolean | null;
    }>(
      `WITH sb AS (
         SELECT product_variant_id,
                COALESCE(SUM(available_quantity), 0) AS available_quantity,
                BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances
          WHERE deleted_at IS NULL
            AND ($2::varchar IS NULL OR warehouse_id = $2)
          GROUP BY product_variant_id
       )
       SELECT pv.variant_id,
              pv.name AS variant_name,
              p.name  AS product_name,
              COALESCE(sb.available_quantity, 0) AS available_quantity,
              ((pv.status = 'active' OR pv.status IS NULL)
                AND (p.is_active = true OR p.is_active IS NULL)
                AND p.deleted_at IS NULL) AS is_listable,
              (COALESCE(p.is_out_of_stock, false)
                OR COALESCE(sb.is_out_of_stock, false)
                OR COALESCE(sb.available_quantity, 0) <= 0) AS is_out_of_stock
         FROM product_variants pv
         LEFT JOIN products p ON pv.product_id = p.product_id
         LEFT JOIN sb ON sb.product_variant_id = pv.variant_id
        WHERE pv.variant_id = ANY($1)`,
      [variantIds, warehouseId ?? null],
    );

    const byVariantId = new Map<string, (typeof rows)[number]>();
    for (const row of rows || []) byVariantId.set(row.variant_id, row);

    for (const item of items) {
      const row = byVariantId.get(item.variantId);
      const name = row?.variant_name || row?.product_name || item.variantId;
      if (!row || row.is_listable !== true || row.is_out_of_stock === true) {
        throw new BadRequestException(`"${name}" is currently out of stock`);
      }
      const available = Number(row.available_quantity || 0);
      if (item.quantity > available) {
        throw new BadRequestException(
          `Only ${available} unit(s) of "${name}" available in stock (requested ${item.quantity})`,
        );
      }
    }
  }

  /** Customer-facing sentence naming the offending items. */
  describe(unavailable: UnavailableVariant[]): string {
    const outOfStock = unavailable.filter((u) => u.reason === 'out_of_stock');
    if (outOfStock.length === unavailable.length) {
      return `Out of stock: ${outOfStock.map((u) => u.name).join(', ')}`;
    }
    return `These products are unavailable: ${unavailable.map((u) => u.name).join(', ')}`;
  }
}
