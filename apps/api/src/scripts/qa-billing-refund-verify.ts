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
import { CustomerBillingRepository } from 'src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository';
import { RefundCandidatesRepository } from 'src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-candidates.repository';
import { RefundEligibilityService } from 'src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-eligibility.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [
    DatabaseService,
    DeveloperService,
    CustomerBillingRepository,
    RefundCandidatesRepository,
    RefundEligibilityService,
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
  const billing = app.get(CustomerBillingRepository);
  const eligibility = app.get(RefundEligibilityService);
  const db = app.get(DatabaseService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  console.log('═'.repeat(78));
  console.log(`MONTH-CLOSE VERIFY — ${MONTH} (${PERIOD_START} → ${PERIOD_END}, due ${DUE_DATE})`);
  console.log('═'.repeat(78));

  // ── 1. Postpaid bill generation (the path both the cron and the admin
  //       "Generate" button take) ────────────────────────────────────────────
  console.log('\n[1] POSTPAID BILL GENERATION');
  const eligible = await billing.findEligiblePostpaidCustomers();
  console.log(`  eligible postpaid customers: ${eligible.length}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of eligible) {
    const cid = c.customer_id;
    const orders = await billing.findDeliveredOrdersForPeriod(cid, PERIOD_START, PERIOD_END, true);
    const existing = await billing.checkBillExists(cid, PERIOD_START, PERIOD_END);

    if (existing) {
      skipped++;
      console.log(`  - ${cid}: SKIPPED (bill ${existing.bill_number} already covers this period)`);
      continue;
    }
    if (!orders.length) {
      skipped++;
      console.log(`  - ${cid}: SKIPPED (no unbilled delivered postpaid orders)`);
      continue;
    }

    const total = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const paid = orders
      .filter((o) => o.order_source === 'one-time' && o.payment_status === 'paid')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const status = paid >= total ? 'paid' : 'pending';

    try {
      const bill = await billing.createBillTransaction(
        cid, PERIOD_START, PERIOD_END, DUE_DATE, orders, total, paid, status, 'postpaid',
      );
      generated++;
      const row = (
        await q(
          `SELECT bill_id, payment_method, payment_type, bill_type, total_amount, paid_amount, due_amount, status
           FROM customer_bills WHERE bill_id = $1`,
          [bill.bill_number],
        )
      )[0];
      console.log(`  - ${cid}: GENERATED ${bill.bill_number} from ${orders.length} order(s)`);
      console.log(`      ${JSON.stringify(row)}`);
      const items = (
        await q(`SELECT count(*)::int AS n FROM customer_bill_items WHERE bill_id = $1`, [bill.bill_number])
      )[0];
      console.log(`      customer_bill_items rows: ${items.n}`);
    } catch (err: any) {
      failed++;
      console.log(`  - ${cid}: FAILED — ${err?.message}`);
    }
  }
  console.log(`  summary: { eligible: ${eligible.length}, generated: ${generated}, skipped: ${skipped}, failed: ${failed} }`);

  // ── 2. Idempotency: a second run must not double-bill ─────────────────────
  console.log('\n[2] RE-RUN (idempotency — the admin pressing Generate twice)');
  let reSkipped = 0;
  for (const c of eligible) {
    const existing = await billing.checkBillExists(c.customer_id, PERIOD_START, PERIOD_END);
    const orders = await billing.findDeliveredOrdersForPeriod(c.customer_id, PERIOD_START, PERIOD_END, true);
    if (existing || !orders.length) reSkipped++;
  }
  console.log(`  ${reSkipped}/${eligible.length} customers would be skipped on a second run` +
    `${reSkipped === eligible.length ? ' — no duplicate bills possible' : ' — CHECK THIS'}`);

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
