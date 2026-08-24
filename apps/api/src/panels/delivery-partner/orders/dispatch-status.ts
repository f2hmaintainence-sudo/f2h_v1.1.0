/**
 * `delivery_dispatch.status` is typed `delivery_dispatch_item_status_enum`
 * (draft, loaded, collected, in_progress, return_pending, completed) and is the
 * single source of truth for whether the warehouse handover actually happened.
 *
 * `delivery_runs.status` is NOT a substitute: a run can already sit at
 * 'in_progress' (route started, planning tools, admin edits) while its dispatch
 * is still 'loaded' — the partner has not physically taken custody yet. Gating
 * the Pickup/Confirm action on the run status is what hides the button and
 * leaves the dispatch stuck at 'loaded' forever.
 */
export const DISPATCH_AWAITING_PICKUP = ['draft', 'loaded'] as const;
export const DISPATCH_HANDED_OVER = ['collected', 'in_progress', 'return_pending', 'completed'] as const;

/** True once the partner has taken custody of the dispatch. */
export function isDispatchHandedOver(status?: string | null): boolean {
  return (DISPATCH_HANDED_OVER as readonly string[]).includes(String(status || ''));
}

/** True while the dispatch is still sitting at the warehouse waiting for the partner. */
export function isDispatchAwaitingPickup(status?: string | null): boolean {
  return (DISPATCH_AWAITING_PICKUP as readonly string[]).includes(String(status || ''));
}
