import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

export interface WalletDriftRow {
  customer_id: string;
  cached_balance: string;
  ledger_balance: string;
  difference: string;
}

export interface MirrorDriftRow {
  customer_id: string;
  on_customers: string;
  on_balances: string;
}

/**
 * A wallet balance exists in three places: `customers.wallet_balance` (what
 * checkout debits), `customer_wallet_balances.wallet_balance` (what the admin
 * customer table reads), and the running sum of `customer_wallet_transactions`
 * (the ledger). Nothing kept them in step, and they have already drifted.
 *
 * `customer_wallet_transactions` is the ledger of record. The other two are cached
 * projections, and this job's whole purpose is to make a divergence loud instead of
 * silent. It deliberately does NOT auto-correct: a mismatch means either money was
 * moved without a ledger entry or a ledger entry was written without moving money,
 * and which one it is decides whether the fix is a credit or a write-off.
 */
@Injectable()
export class WalletReconciliationService {
  private readonly logger = new Logger(WalletReconciliationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly cronLock: CronLockService,
  ) {}

  /** Customers whose cached balance disagrees with the sum of their ledger. */
  async findLedgerDrift(): Promise<WalletDriftRow[]> {
    return this.db.query<WalletDriftRow>(`
      SELECT c.customer_id,
             c.wallet_balance::text AS cached_balance,
             COALESCE(SUM(
               CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END
             ), 0)::text AS ledger_balance,
             (c.wallet_balance - COALESCE(SUM(
               CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END
             ), 0))::text AS difference
        FROM customers c
        LEFT JOIN customer_wallet_transactions t
               ON t.customer_id = c.customer_id
              AND t.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       GROUP BY c.customer_id, c.wallet_balance
      HAVING c.wallet_balance <> COALESCE(SUM(
               CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END
             ), 0)
       ORDER BY abs(c.wallet_balance - COALESCE(SUM(
               CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE -t.amount END
             ), 0)) DESC
    `);
  }

  /** Customers where the two cached balance columns disagree with each other. */
  async findMirrorDrift(): Promise<MirrorDriftRow[]> {
    return this.db.query<MirrorDriftRow>(`
      SELECT c.customer_id,
             c.wallet_balance::text AS on_customers,
             b.wallet_balance::text AS on_balances
        FROM customers c
        JOIN customer_wallet_balances b ON b.customer_id = c.customer_id
       WHERE c.wallet_balance IS DISTINCT FROM b.wallet_balance
       ORDER BY c.customer_id
    `);
  }

  async reconcile(): Promise<{ ledgerDrift: WalletDriftRow[]; mirrorDrift: MirrorDriftRow[] }> {
    const [ledgerDrift, mirrorDrift] = await Promise.all([
      this.findLedgerDrift(),
      this.findMirrorDrift(),
    ]);

    if (ledgerDrift.length || mirrorDrift.length) {
      this.logger.error(
        `Wallet reconciliation found ${ledgerDrift.length} ledger mismatch(es) and ` +
          `${mirrorDrift.length} mirror mismatch(es)`,
      );
      this.developer.error('Wallet reconciliation drift detected', {
        ledgerDriftCount: ledgerDrift.length,
        mirrorDriftCount: mirrorDrift.length,
        // Customer ids only — amounts stay out of the log line.
        ledgerDriftCustomers: ledgerDrift.slice(0, 25).map((row) => row.customer_id),
        mirrorDriftCustomers: mirrorDrift.slice(0, 25).map((row) => row.customer_id),
      });
    } else {
      this.logger.log('Wallet reconciliation clean: every balance matches its ledger');
    }

    return { ledgerDrift, mirrorDrift };
  }

  /** Daily at 02:30 IST, after the nightly order generation has settled. */
  @Cron('0 30 2 * * *', { timeZone: 'Asia/Kolkata' })
  async handleDailyReconciliation(): Promise<void> {
    if (!(await this.cronLock.acquire('walletReconciliation', 3600))) return;

    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error(
        `Wallet reconciliation failed: ${(error as Error).message}`,
      );
      this.developer.error('Wallet reconciliation job failed', { error });
    }
  }
}
