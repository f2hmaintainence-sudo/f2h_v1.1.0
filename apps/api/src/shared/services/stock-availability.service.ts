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
 *    is the load-bearing term. `products.is_out_of_stock` controls whether
 *    out-of-stock visibility is enforced: when true, zero-stock items show as
 *    out-of-stock; when false, items remain available even at zero stock.
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
              CASE
                WHEN COALESCE(p.is_out_of_stock, false) = true THEN
                  (COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0)
                ELSE
                  false
              END AS is_out_of_stock
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
      enforce_stock: boolean | null;
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
              COALESCE(p.is_out_of_stock, false) AS enforce_stock,
              ((pv.status = 'active' OR pv.status IS NULL)
                AND (p.is_active = true OR p.is_active IS NULL)
                AND p.deleted_at IS NULL) AS is_listable,
              CASE
                WHEN COALESCE(p.is_out_of_stock, false) = true THEN
                  (COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0)
                ELSE
                  false
              END AS is_out_of_stock
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
      if (row.enforce_stock === true && item.quantity > available) {
        throw new BadRequestException(
          `Only ${available} unit(s) of "${name}" available in stock (requested ${item.quantity})`,
        );
      }
    }
  }

  /**
   * Moves stock from available to reserved for an order being placed.
   *
   * `assertQuantitiesAvailable` only *reads*, so two checkouts racing for the
   * last units both pass it. The conditional `available_quantity >= $3` here is
   * what actually settles that: PostgreSQL takes a row lock for the UPDATE, so
   * the second one sees the first one's decrement and matches no row.
   *
   * Must be called with the same transaction handle that writes the order —
   * reserving outside it would leak stock whenever the order insert rolls back.
   *
   * [tx] is a shared-connection handle whose `query` resolves to `[rows]`;
   * rowCount is not exposed, which is why every statement uses RETURNING.
   */
  async reserveQuantities(
    tx: { query: (sql: string, params?: any[]) => Promise<any> },
    items: { variantId: string; quantity: number }[],
    warehouseId: string,
  ): Promise<void> {
    for (const item of items) {
      const qty = Number(item.quantity || 0);
      if (!item.variantId || qty <= 0) continue;

      const [rows] = await tx.query(
        `UPDATE stock_balances
            SET available_quantity = available_quantity - $3,
                reserved_quantity  = reserved_quantity + $3,
                last_stock_update  = NOW(),
                updated_at         = NOW()
          WHERE warehouse_id = $1
            AND product_variant_id = $2
            AND deleted_at IS NULL
            AND available_quantity >= $3
          RETURNING available_quantity`,
        [warehouseId, item.variantId, qty],
      );

      if (!rows || rows.length === 0) {
        // Either no balance row for this warehouse, or someone took the units
        // between the pre-check and here. Report what is actually left.
        const [current] = await tx.query(
          `SELECT COALESCE(available_quantity, 0) AS available_quantity
             FROM stock_balances
            WHERE warehouse_id = $1 AND product_variant_id = $2 AND deleted_at IS NULL`,
          [warehouseId, item.variantId],
        );
        const available = Number(current?.[0]?.available_quantity ?? 0);
        const [named] = await tx.query(
          `SELECT COALESCE(pv.name, p.name, $1) AS name
             FROM product_variants pv
             LEFT JOIN products p ON p.product_id = pv.product_id
            WHERE pv.variant_id = $1`,
          [item.variantId],
        );
        const name = named?.[0]?.name || item.variantId;
        throw new BadRequestException(
          `Only ${available} unit(s) of "${name}" available in stock (requested ${qty})`,
        );
      }
    }
  }

  /**
   * Returns reserved stock to available — an order cancelled before dispatch.
   *
   * Deliberately unconditional and floored at zero: releasing is always safe,
   * and refusing to release would strand stock nobody can sell.
   */
  async releaseQuantities(
    tx: { query: (sql: string, params?: any[]) => Promise<any> },
    items: { variantId: string; quantity: number }[],
    warehouseId: string,
  ): Promise<void> {
    for (const item of items) {
      const qty = Number(item.quantity || 0);
      if (!item.variantId || qty <= 0) continue;

      await tx.query(
        `UPDATE stock_balances
            SET available_quantity = available_quantity + LEAST($3, reserved_quantity),
                reserved_quantity  = GREATEST(reserved_quantity - $3, 0),
                last_stock_update  = NOW(),
                updated_at         = NOW()
          WHERE warehouse_id = $1
            AND product_variant_id = $2
            AND deleted_at IS NULL`,
        [warehouseId, item.variantId, qty],
      );
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
