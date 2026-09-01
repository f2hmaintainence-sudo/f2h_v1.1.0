/**
 * QA harness — drives the same two entry points the crons and the admin buttons
 * use, against the live database, to verify the month-close fixes.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/qa-billing-refund-verify.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CustomerBillingService } from 'src/panels/admin/customers-orders/customer-billing/services/customer-billing.service';
import { CustomerBillingRepository } from 'src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository';
import { NotificationService } from 'src/notifications/notification.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';
import { RefundCandidatesRepository } from 'src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-candidates.repository';
import { RefundEligibilityService } from 'src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-eligibility.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [
    DatabaseService,
    DeveloperService,
    CustomerBillingRepository,
    CustomerBillingService,
    RefundCandidatesRepository,
    RefundEligibilityService,
    // Outbound notifications are not what this harness verifies, and wiring the
    // real ones drags in the whole admin auth graph. The billing logic under
    // test never reads their return values.
    { provide: NotificationService, useValue: { sendNotification: async () => undefined } },
    { provide: AuthService, useValue: { getUsersByRole: async () => ({ user_ids: [] }) } },
    { provide: PushNotificationService, useValue: { sendNotificationToUsers: async () => undefined } },
    // The cron lock is Redis-backed; granting it keeps the batch path identical.
    { provide: CronLockService, useValue: { acquire: async () => true } },
  ],
})
class QaModule {}

const MONTH = process.argv[2] || '2026-08';
const PERIOD_START = `${MONTH}-01`;
const PERIOD_END = (() => {
  const [y, m] = MONTH.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${MONTH}-${String(d.getDate()).padStart(2, '0')}`;
})();
const DUE_DATE = (() => {
  const [y, m] = MONTH.split('-').map(Number);
  const due = new Date(y, m, 5);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-05`;
})();

async function main() {
  const app = await NestFactory.createApplicationContext(QaModule, { logger: ['error'] });
  const billingService = app.get(CustomerBillingService);
  const eligibility = app.get(RefundEligibilityService);
  const db = app.get(DatabaseService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  console.log('═'.repeat(78));
  console.log(`MONTH-CLOSE VERIFY — ${MONTH} (${PERIOD_START} → ${PERIOD_END}, due ${DUE_DATE})`);
  console.log('═'.repeat(78));

  // ── 1. Postpaid bill generation — the exact call the monthly cron and the
  //       admin "Generate" button both make ────────────────────────────────────
  console.log('\n[1] POSTPAID BILL GENERATION (via CustomerBillingService.runMonthlyBatchBilling)');
  const run = await billingService.runMonthlyBatchBilling({
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    dueDate: DUE_DATE,
  } as any);
  console.log(`  summary: ${JSON.stringify(run.summary)}`);
  for (const r of run.data ?? []) {
    const sub = r.subscriptionId ? ` sub=${r.subscriptionId}` : '';
    console.log(`  - ${r.customerId}${sub}: ${String(r.action).toUpperCase()} ${r.billNumber ?? ''} ${r.message ?? ''}`);
  }

  const madeBills = await q(
    `SELECT bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
            total_amount, due_amount, status
     FROM customer_bills
     WHERE billing_from = $1 AND billing_to = $2 AND payment_type = 'postpaid'
     ORDER BY reference_id`,
    [PERIOD_START, PERIOD_END],
  );
  console.log(`\n  bills now on record for ${PERIOD_START}..${PERIOD_END}:`);
  for (const b of madeBills) {
    const items = (
      await q(`SELECT count(*)::int AS n, sum(total_amount) AS amt FROM customer_bill_items WHERE bill_id = $1`, [b.bill_id])
    )[0];
    console.log(`    ${b.bill_id}  type=${b.bill_type}  ref=${b.reference_id}  ` +
      `Rs.${b.total_amount} due=${b.due_amount} ${b.status}  items=${items.n} (Rs.${items.amt})`);
  }

  // ── 2. Idempotency: pressing Generate again must not duplicate ────────────
  console.log('\n[2] RE-RUN (the admin pressing Generate twice)');
  const rerun = await billingService.runMonthlyBatchBilling({
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    dueDate: DUE_DATE,
  } as any);
  const afterBills = Number(
    (await q(
      `SELECT count(*)::int AS n FROM customer_bills WHERE billing_from = $1 AND billing_to = $2 AND payment_type = 'postpaid'`,
      [PERIOD_START, PERIOD_END],
    ))[0].n,
  );
  console.log(`  summary: ${JSON.stringify(rerun.summary)}`);
  console.log(`  bill count: ${madeBills.length} -> ${afterBills}` +
    `${afterBills === madeBills.length ? ' — no duplicates' : ' — DUPLICATES CREATED, CHECK THIS'}`);

  // ── 3. Refund candidate scan (the path the new cron and the developer
  //       "Run Live Scan & Materialize" button take) ──────────────────────────
  console.log('\n[3] REFUND CANDIDATE SCAN');
  const before = Number((await q(`SELECT count(*)::int AS n FROM subscription_refund_candidates`))[0].n);
  const scan = await eligibility.scan({ month: MONTH });
  const after = Number((await q(`SELECT count(*)::int AS n FROM subscription_refund_candidates`))[0].n);
  console.log(`  scan result : ${JSON.stringify(scan)}`);
  console.log(`  candidates  : ${before} → ${after}`);

  const grouped = await q(
    `SELECT customer_id, source, count(*)::int AS n, sum(refund_amount) AS amount
     FROM subscription_refund_candidates GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  console.log(`  by customer : ${JSON.stringify(grouped)}`);

  // ── 4. Refund scan idempotency ────────────────────────────────────────────
  console.log('\n[4] REFUND SCAN RE-RUN (idempotency)');
  const scan2 = await eligibility.scan({ month: MONTH });
  const after2 = Number((await q(`SELECT count(*)::int AS n FROM subscription_refund_candidates`))[0].n);
  console.log(`  scan result : ${JSON.stringify(scan2)}`);
  console.log(`  candidates  : ${after} → ${after2}` +
    `${after2 === after ? ' — no duplicates' : ' — DUPLICATES CREATED, CHECK THIS'}`);

  console.log('\n' + '═'.repeat(78));
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
