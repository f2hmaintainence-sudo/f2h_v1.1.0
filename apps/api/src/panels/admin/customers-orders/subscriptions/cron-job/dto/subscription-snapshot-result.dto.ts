export interface SubscriptionSnapshotCountsDto {
  inserted: number;
  updated: number;
}

export interface BranchStatDto {
  branch_id: string | null;
  branch_name: string | null;
  subscription_orders_created: number;
  onetime_orders_confirmed: number;
  total_processed: number;
}

export class SubscriptionSnapshotResultDto {
  targetDate: string;
  slot: string;
  generationType: string;

  // Subscription order generation
  subscriptionOrdersCreated: number;
  subscriptionItemsInserted: number;
  subscriptionLogsInserted: number;

  // One-time order confirmation
  onetimeOrdersConfirmed: number;
  onetimeOrdersSkipped: number;

  // Aggregated
  totalProcessed: number;

  // Branch-wise breakdown
  branchStats: BranchStatDto[];

  // Execution metadata
  durationMs: number;
  status: 'success' | 'skipped' | 'failed';
  lockKey: string;
  errors: string[];

  // Legacy compat (kept for existing consumers)
  recordsInserted: number;
  recordsUpdated: number;
}
