import { api } from "./api.client";

export interface DispatchItem {
  product_variant_id: string;
  product_name: string;
  variant_name: string;
  unit_value: number | null;
  unit_type: string;
  quantity: number;
  planned_qty?: number;
  loaded_qty?: number;
  extra_qty?: number;
  /** Warehouse-friendly display string, e.g. "1000 ml Milk × 3" */
  displayLabel: string;
  orderCount?: number;
}

export interface DispatchOrder {
  order_id: string;
  customer_name: string;
  address_line: string;
  delivery_slot: string;
  items: DispatchItem[];
}

export interface DeliveryPartnerPlan {
  id: number; // Numeric primary key
  run_id: string; // String run identifier (e.g. RUN-...)
  run_number: string;
  delivery_partner_id: string;
  delivery_partner_name: string;
  phone: string;
  branch_name: string;
  branch_id: string | null;
  /** Warehouse serving this run — stock for the handover is scoped to it. */
  warehouse_id: string | null;
  warehouse_name: string | null;
  delivery_slot: string;
  status: string;
  hasActualDispatch?: boolean;
  isDispatched?: boolean;
  /** Actual delivery_dispatch.status from DB: 'loaded', 'collected', 'short', 'returned', etc. */
  dispatchStatus?: string | null;
  orders: DispatchOrder[];
  totals: Record<string, DispatchItem>;
  extraItems?: DispatchItem[];
  totalExtraQty?: number;
  totalPlannedQty?: number;
  totalOrders: number;
  totalCustomers: number;
  totalQuantity: number;
  totalProducts: number;
}

export interface WarehouseTotalItem {
  product_variant_id: string;
  product_name: string;
  variant_name: string;
  unit_value: number | null;
  unit_type: string;
  quantity: number;
  displayLabel: string;
  orderCount?: number;
}

/**
 * Builds a warehouse-friendly display label for a variant.
 * E.g. "Cow Milk (500 ml) × 3"
 */
function buildDisplayLabel(
  variantName: string,
  productName: string,
  unitValue: number | null,
  unitType: string,
  quantity: number,
): string {
  let label = productName;
  if (variantName && variantName !== productName) {
    label = `${productName} (${variantName})`;
  }
  return `${label} × ${quantity}`;
}

export class DispatchPlanningService {
  /**
   * Fetches the dispatch planning data from API for a target date
   */
  static async fetchDispatchPlan(date: string): Promise<DeliveryPartnerPlan[]> {
    const runsRes = await api.get<any>(`/admin/delivery/runs?date=${date}&limit=100`);
    const runs = runsRes.data?.data || [];

    if (runs.length === 0) {
      return [];
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const todayStr = `${pick('year')}-${pick('month')}-${pick('day')}`;
    const isHistorical = date < todayStr;

    // Fetch details and table-stored dispatch items for each run in parallel
    const runDetailsPromises = runs.map((run: any) => {
      const runIdentifier = run.run_id || run.id;
      return Promise.all([
        api.get<any>(`/admin/delivery/runs/${runIdentifier}/addresses`).catch(() => ({ data: { data: [] } })),
        api.get<any>(`/admin/delivery/dispatch/${runIdentifier}/items`).catch(() => ({ data: { data: [] } })),
      ]).then(([addrRes, dispRes]) => {
        const dispatchItems = dispRes.data?.data || [];
        const hasActualDispatch = Array.isArray(dispatchItems) && dispatchItems.length > 0;
        // Surface the actual delivery_dispatch.status (loaded/collected/short/returned)
        // The dispatch items API response joins delivery_dispatch, so grab status from first row
        const dispatchStatus: string | null = hasActualDispatch
          ? (dispatchItems[0]?.dispatch_status ?? dispatchItems[0]?.dd_status ?? null)
          : null;
        return {
          run,
          addresses: addrRes.data?.data || [],
          dispatchItems: dispatchItems,
          hasActualDispatch,
          dispatchStatus,
        };
      });
    });

    const runsWithDetails = await Promise.all(runDetailsPromises);

    // Process and construct plans
    return runsWithDetails.map(({ run, addresses, dispatchItems, hasActualDispatch, dispatchStatus }) => {
      // Each address row contains a `orders` JSON array of actual orders at that stop.
      // Build the stop-level display from address rows, but track the actual orders
      // for correct counting.
      const orders: DispatchOrder[] = addresses.map((row: any) => {
        // Parse the embedded orders JSON from the address row
        let embeddedOrders: any[] = [];
        if (typeof row.orders === 'string') {
          try { embeddedOrders = JSON.parse(row.orders) ?? []; } catch { embeddedOrders = []; }
        } else if (Array.isArray(row.orders)) {
          embeddedOrders = row.orders;
        }

        let items: any[] = [];
        if (typeof row.items_json === 'string') {
          try {
            items = JSON.parse(row.items_json);
          } catch {
            items = [];
          }
        } else if (Array.isArray(row.items_json)) {
          items = row.items_json;
        }

        const parsedItems: DispatchItem[] = items.map(item => {
          const qty = Number(item.quantity || 0);
          const unitType = item.unit || 'pcs';
          const unitValue = item.unit_value ? Number(item.unit_value) : null;
          
          const productName = item.variant_name || item.product_name || 'Unknown Product';
          const variantName = unitValue && unitType ? `${unitValue} ${unitType}` : (item.variant_name || '');

          return {
            product_variant_id: item.product_variant_id,
            product_name: productName,
            variant_name: variantName,
            unit_value: unitValue,
            unit_type: unitType,
            quantity: qty,
            displayLabel: buildDisplayLabel(variantName, productName, unitValue, unitType, qty),
          };
        });

        return {
          // order_id here represents the stop/address, not a single order
          order_id: row.order_id || row.run_address_id || row.address_id,
          customer_name: row.contact_name || row.customer_name || 'Customer',
          address_line: row.address_line || 'Address not listed',
          delivery_slot: row.delivery_slot || run.delivery_slot,
          items: parsedItems,
          // Carry the embedded actual orders count for this address stop
          _actualOrders: embeddedOrders,
        } as DispatchOrder & { _actualOrders: any[] };
      });

      // Calculate delivery-boy-wise product aggregates (grouped by product_name + variant_name combo)
      const totals: Record<string, DispatchItem> = {};
      const orderCounts: Record<string, number> = {};
      const orderQuantities: Record<string, number> = {};

      orders.forEach(order => {
        const seen = new Set<string>();
        order.items.forEach(item => {
          const groupKey = `${item.product_name.trim()}::${item.variant_name.trim()}`;
          orderQuantities[groupKey] = (orderQuantities[groupKey] || 0) + item.quantity;
          if (!seen.has(groupKey)) {
            orderCounts[groupKey] = (orderCounts[groupKey] || 0) + 1;
            seen.add(groupKey);
          }
        });
      });

      const isDispatched = hasActualDispatch || (isHistorical && ['dispatched', 'completed'].includes(run.status));

      if (hasActualDispatch && dispatchItems.length > 0) {
        // Populate totals directly from table data (delivery_dispatch_items)
        dispatchItems.forEach((row: any) => {
          const unitType = row.unit || row.unit_type || 'pcs';
          const unitValue = row.unit_value ? Number(row.unit_value) : null;
          
          const productName = row.variant_name || row.product_name || 'Unknown Product';
          const variantName = unitValue && unitType ? `${unitValue} ${unitType}` : (row.variant_name || '');
          const groupKey = `${productName.trim()}::${variantName.trim()}`;
          const plannedQty = Number(row.planned_qty || 0);
          const loadedQty = Number(row.loaded_qty) || plannedQty || 0;
          const effectivePlanned = plannedQty > 0 ? plannedQty : (orderQuantities[groupKey] || 0);
          const extraQty = Math.max(0, loadedQty - effectivePlanned);

          if (!totals[groupKey]) {
            totals[groupKey] = {
              product_variant_id: row.product_variant_id,
              product_name: productName,
              variant_name: variantName,
              unit_value: unitValue,
              unit_type: unitType,
              quantity: 0,
              planned_qty: 0,
              loaded_qty: 0,
              extra_qty: 0,
              displayLabel: '',
              orderCount: orderCounts[groupKey] || (effectivePlanned > 0 ? 1 : 0)
            };
          }
          totals[groupKey].quantity += loadedQty;
          totals[groupKey].planned_qty = (totals[groupKey].planned_qty || 0) + effectivePlanned;
          totals[groupKey].loaded_qty = (totals[groupKey].loaded_qty || 0) + loadedQty;
          totals[groupKey].extra_qty = (totals[groupKey].extra_qty || 0) + extraQty;
        });
      } else {
        // Not dispatched yet: compile planned demand from customer orders
        orders.forEach(order => {
          order.items.forEach(item => {
            const groupKey = `${item.product_name.trim()}::${item.variant_name.trim()}`;
            if (!totals[groupKey]) {
              totals[groupKey] = {
                product_variant_id: item.product_variant_id,
                product_name: item.product_name,
                variant_name: item.variant_name,
                unit_value: item.unit_value,
                unit_type: item.unit_type,
                quantity: 0,
                planned_qty: 0,
                loaded_qty: 0,
                extra_qty: 0,
                displayLabel: '',
                orderCount: orderCounts[groupKey] || 1
              };
            }
            totals[groupKey].quantity += item.quantity;
            totals[groupKey].planned_qty = (totals[groupKey].planned_qty || 0) + item.quantity;
            totals[groupKey].loaded_qty = 0;
            totals[groupKey].extra_qty = 0;
          });
        });
      }

      // Compute display labels
      Object.keys(totals).forEach(key => {
        const t = totals[key];
        t.displayLabel = buildDisplayLabel(t.variant_name, t.product_name, t.unit_value, t.unit_type, t.quantity);
      });

      const totalQty = Object.values(totals).reduce((sum, item) => sum + item.quantity, 0);
      const totalPlannedQty = Object.values(totals).reduce((sum, item) => sum + (item.planned_qty ?? item.quantity), 0);
      const totalExtraQty = Object.values(totals).reduce((sum, item) => sum + (item.extra_qty || 0), 0);
      const extraItems = Object.values(totals).filter(item => (item.extra_qty || 0) > 0 || (item.orderCount === 0 && item.quantity > 0));

      // Compute actual order count from embedded orders within each address stop
      // (delivery_run_addresses row has a `orders` JSON array of actual orders)
      let actualOrderCount = 0;
      const actualCustomerNames = new Set<string>();
      for (const stop of orders as any[]) {
        const embedded = (stop._actualOrders as any[]) || [];
        if (embedded.length > 0) {
          actualOrderCount += embedded.length;
          embedded.forEach((o: any) => {
            if (o.customer_name) actualCustomerNames.add(o.customer_name);
          });
        } else {
          // Fallback: count the address row itself as 1 order
          actualOrderCount += 1;
          if (stop.customer_name) actualCustomerNames.add(stop.customer_name);
        }
      }

      return {
        id: run.id, // Primary key
        run_id: run.run_id,
        run_number: run.run_id,
        delivery_partner_id: run.delivery_partner_id,
        delivery_partner_name: run.partner_name || 'Unassigned Rider',
        phone: run.partner_phone || 'N/A',
        branch_name: run.branch_name || 'Default Branch',
        branch_id: run.branch_id ?? null,
        warehouse_id: run.warehouse_id ?? null,
        warehouse_name: run.warehouse_name ?? null,
        delivery_slot: run.delivery_slot,
        status: run.status,
        hasActualDispatch,
        isDispatched,
        dispatchStatus,
        orders,
        totals,
        extraItems,
        totalExtraQty,
        totalPlannedQty,
        totalOrders: actualOrderCount,
        totalCustomers: actualCustomerNames.size > 0 ? actualCustomerNames.size : new Set(orders.map(o => o.customer_name)).size,
        totalQuantity: totalQty,
        totalProducts: Object.keys(totals).length
      };
    });
  }

  /**
   * Compiles the overall warehouse aggregates
   */
  static compileWarehouseTotals(plans: DeliveryPartnerPlan[]): Record<string, WarehouseTotalItem> {
    const totals: Record<string, WarehouseTotalItem> = {};
    plans.forEach(plan => {
      Object.keys(plan.totals).forEach(key => {
        const pt = plan.totals[key];
        // key is already groupKey from plan.totals
        if (!totals[key]) {
          totals[key] = {
            product_variant_id: pt.product_variant_id,
            product_name: pt.product_name,
            variant_name: pt.variant_name,
            unit_value: pt.unit_value,
            unit_type: pt.unit_type,
            quantity: 0,
            displayLabel: '',
            orderCount: 0
          };
        }
        totals[key].quantity += pt.quantity;
        totals[key].orderCount = (totals[key].orderCount || 0) + (pt.orderCount || 1);
      });
    });

    Object.keys(totals).forEach(key => {
      const wt = totals[key];
      wt.displayLabel = buildDisplayLabel(wt.variant_name, wt.product_name, wt.unit_value, wt.unit_type, wt.quantity);
    });

    return totals;
  }

  /**
   * Dispatches the stock for a delivery run
   */
  static async approveDispatch(runDbId: number, warehouseId: string, totals: Record<string, DispatchItem>): Promise<any> {
    const items = Object.values(totals).map((t) => {
      const planned = t.planned_qty !== undefined ? Number(t.planned_qty) : (t.orderCount === 0 ? 0 : Number(t.quantity || 0));
      const loaded = t.loaded_qty !== undefined ? Number(t.loaded_qty) : Number(t.quantity || 0);
      return {
        warehouse_id: warehouseId,
        product_variant_id: t.product_variant_id,
        planned_qty: planned,
        loaded_qty: loaded,
        unit: t.unit_type || "pcs",
      };
    });

    return api.post<any>(`/admin/delivery/dispatch/${runDbId}`, { items });
  }
}
