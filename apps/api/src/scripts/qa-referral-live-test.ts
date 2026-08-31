/**
 * QA harness — live real-time execution of the 09-referrals test specification.
 *
 * Boots only the referral providers (no cron / queue / HTTP) against the live
 * database and drives ReferralService + FirstOrderDetectorService +
 * ReferralRewardEngineService exactly as the delivery pipeline does.
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/scripts/qa-referral-live-test.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { ReferralRepository } from 'src/panels/customer/referral/repositories/referral.repository';
import { ReferralService } from 'src/panels/customer/referral/services/referral.service';
import { FirstOrderDetectorService } from 'src/panels/customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from 'src/panels/customer/referral/services/referral-reward-engine.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [
    DataService,
    DatabaseService,
    DeveloperService,
    FieldEncryptionService,
    ReferralRepository,
    FirstOrderDetectorService,
    ReferralRewardEngineService,
    { provide: 'IReferralRepository', useClass: ReferralRepository },
    { provide: 'IReferralService', useClass: ReferralService },
    ReferralService,
  ],
})
class QaReferralTestModule {}

// ── Accounts under test (supplied by the requester) ────────────────────────────
const CUST_REFERRER = 'F2HQFK7NH'; // ashokroman007@gmail.com  (existing customer)
const DP_REFERRER = 'F2HFUGZ6H'; // ashoknanda130120@gmail.com (delivery partner)

const RUN = Date.now().toString(36).toUpperCase().slice(-6);
const REFEREE_B = `QAREFB${RUN}`; // customer-referred referee
const REFEREE_C = `QAREFC${RUN}`; // DP-referred referee
const REFEREE_D = `QAREFD${RUN}`; // users.referred_by only, no referrals row
const REFEREE_E = `QAREFE${RUN}`; // self-referral attempt

const results: any[] = [];
function record(id: string, name: string, expected: string, actual: string, pass: boolean | 'partial') {
  results.push({ id, name, expected, actual, pass });
  const tag = pass === true ? 'PASS' : pass === 'partial' ? 'PARTIAL' : 'FAIL';
  console.log(`\n[${tag}] ${id} — ${name}\n  expected: ${expected}\n  actual  : ${actual}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(QaReferralTestModule, {
    logger: ['error', 'warn'],
  });
  const db = app.get(DatabaseService);
  const engine = app.get(ReferralRewardEngineService);
  const detector = app.get(FirstOrderDetectorService);
  const referralService = app.get(ReferralService);

  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];
  const bal = async (id: string) =>
    Number((await q(`SELECT wallet_balance FROM customers WHERE customer_id = $1`, [id]))[0]?.wallet_balance ?? -1);
  const txCount = async (id: string) =>
    Number(
      (await q(
        `SELECT COUNT(*)::int AS n FROM customer_wallet_transactions WHERE customer_id = $1 AND reference_type = 'referral_bonus'`,
        [id],
      ))[0]?.n ?? -1,
    );

  const mkCustomer = async (id: string, name: string, phone: string, referredBy?: string) => {
    await q(
      `INSERT INTO users (user_id, first_name, last_name, user_name, email, phone, role_id, account_status, referred_by, created_at, updated_at)
       VALUES ($1, $2, 'QA', $2, $3, $4, 'CUSTOMER', 'active', $5, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [id, name, `${id.toLowerCase()}@f2htest.local`, phone, referredBy ?? null],
    );
    await q(
      `INSERT INTO customers (customer_id, wallet_balance, first_order_completed, created_at, updated_at)
       VALUES ($1, 0.00, false, NOW(), NOW()) ON CONFLICT (customer_id) DO NOTHING`,
      [id],
    );
  };

  const mkReferral = async (referrer: string, referee: string, amount: number) => {
    const referId = `QAREF${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await q(
      `INSERT INTO referrals (refer_id, referrer_customer_id, referred_customer_id, referral_code,
        referrer_reward_amount, referred_reward_amount, status, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $2, $4, 0.00, 'pending', 'QA live test', NOW(), NOW())`,
      [referId, referrer, referee, amount],
    );
    return referId;
  };

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`QA REFERRAL LIVE TEST — run ${RUN} — ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════════════════════════');

  const aBalBefore = await bal(CUST_REFERRER);
  const aTxBefore = await txCount(CUST_REFERRER);
  console.log(`\nBaseline: referrer ${CUST_REFERRER} wallet=${aBalBefore} referral_bonus_tx=${aTxBefore}`);

  // ── REF-CUST-001 ────────────────────────────────────────────────────────────
  await mkCustomer(REFEREE_B, 'QaRefereeB', '9000${RUN}'.slice(0, 10));
  const refB = await mkReferral(CUST_REFERRER, REFEREE_B, 100.0);
  const orderB1 = `QAORD${RUN}B1`;

  const r1 = await engine.processReferralReward(REFEREE_B, orderB1);
  const aBalAfter = await bal(CUST_REFERRER);
  const bBalAfter = await bal(REFEREE_B);
  const bRow = (await q(`SELECT first_order_completed FROM customers WHERE customer_id = $1`, [REFEREE_B]))[0];
  const refRow = (await q(`SELECT status, referrer_reward_amount, referred_reward_amount, rewarded_at FROM referrals WHERE refer_id = $1`, [refB]))[0];
  const txRow = (
    await q(
      `SELECT amount, balance_after, transaction_type, reference_type, reference_id FROM customer_wallet_transactions
       WHERE customer_id = $1 AND reference_type = 'referral_bonus' ORDER BY created_at DESC LIMIT 1`,
      [CUST_REFERRER],
    )
  )[0];

  record(
    'REF-CUST-001',
    'Existing customer referrer gets Rs.100, new user gets Rs.0',
    `referrer wallet ${aBalBefore} -> ${aBalBefore + 100}; referee wallet 0.00; referrals.status=rewarded (100.00/0.00); 1 credit tx reference_type=referral_bonus`,
    `engine=${JSON.stringify(r1)}; referrer wallet ${aBalBefore} -> ${aBalAfter}; referee wallet ${bBalAfter}; referrals=${JSON.stringify(refRow)}; tx=${JSON.stringify(txRow)}; referee.first_order_completed=${bRow?.first_order_completed}`,
    r1?.status === true &&
      aBalAfter === aBalBefore + 100 &&
      bBalAfter === 0 &&
      refRow?.status === 'rewarded' &&
      Number(refRow?.referrer_reward_amount) === 100 &&
      Number(refRow?.referred_reward_amount) === 0 &&
      bRow?.first_order_completed === true &&
      Number(txRow?.amount) === 100,
  );

  // Notification check
  const notif = (
    await q(
      `SELECT n.title, n.message FROM notifications n
       JOIN notification_recipients nr ON nr.notification_id = n.notification_id
       WHERE nr.user_id = $1 AND n.type = 'referral_bonus' ORDER BY n.created_at DESC LIMIT 1`,
      [CUST_REFERRER],
    )
  )[0];
  record(
    'REF-CUST-001b',
    'Referrer receives referral bonus push notification',
    'notifications row of type referral_bonus addressed to the referrer',
    notif ? `${notif.title} | ${notif.message}` : 'no notification row found',
    !!notif,
  );

  // ── REF-CUST-003 (idempotency) ──────────────────────────────────────────────
  const r2 = await engine.processReferralReward(REFEREE_B, orderB1);
  const r3 = await engine.processReferralReward(REFEREE_B, `QAORD${RUN}B2`);
  const aBalIdem = await bal(CUST_REFERRER);
  const aTxIdem = await txCount(CUST_REFERRER);
  record(
    'REF-CUST-003',
    'Double reward / duplicate delivery callback is rejected',
    `both re-invocations return status:false "already processed"; wallet stays ${aBalAfter}; referral_bonus tx count stays ${aTxBefore + 1}`,
    `2nd=${JSON.stringify(r2)}; 3rd=${JSON.stringify(r3)}; wallet=${aBalIdem}; tx count=${aTxIdem}`,
    r2?.status === false && r3?.status === false && aBalIdem === aBalAfter && aTxIdem === aTxBefore + 1,
  );

  // Concurrency: two simultaneous callbacks on a fresh referral
  const REFEREE_B2 = `QAREFB2${RUN}`;
  await mkCustomer(REFEREE_B2, 'QaRefereeB2', '9000000002');
  await mkReferral(CUST_REFERRER, REFEREE_B2, 100.0);
  const balBeforeRace = await bal(CUST_REFERRER);
  const race = await Promise.allSettled([
    engine.processReferralReward(REFEREE_B2, `QAORD${RUN}R1`),
    engine.processReferralReward(REFEREE_B2, `QAORD${RUN}R1`),
  ]);
  const balAfterRace = await bal(CUST_REFERRER);
  record(
    'REF-CUST-003c',
    'Concurrent delivery callbacks credit exactly once (SELECT ... FOR UPDATE)',
    `wallet ${balBeforeRace} -> ${balBeforeRace + 100} (exactly one credit)`,
    `race=${JSON.stringify(race.map((r: any) => (r.status === 'fulfilled' ? r.value?.status : `rejected:${r.reason?.message}`)))}; wallet ${balBeforeRace} -> ${balAfterRace}`,
    balAfterRace === balBeforeRace + 100,
  );

  // ── REF-PART-001 ────────────────────────────────────────────────────────────
  await mkCustomer(REFEREE_C, 'QaRefereeC', '9000000003');
  const refC = await mkReferral(DP_REFERRER, REFEREE_C, 100.0); // seeded at 100 on purpose: engine must force 75
  const orderC1 = `QAORD${RUN}C1`;
  const dpWalletBefore = await bal(DP_REFERRER); // DP is also a customer row
  const r4 = await engine.processReferralReward(REFEREE_C, orderC1);
  const bonus = (
    await q(`SELECT bonus_id, partner_id, refer_id, order_id, amount, status FROM delivery_partner_referral_bonuses WHERE order_id = $1`, [orderC1])
  )[0];
  const cBal = await bal(REFEREE_C);
  const dpWalletAfter = await bal(DP_REFERRER);
  const refCRow = (await q(`SELECT status, referrer_reward_amount, referred_reward_amount FROM referrals WHERE refer_id = $1`, [refC]))[0];
  record(
    'REF-PART-001',
    'Delivery partner referrer accrues Rs.75 bonus, new user gets Rs.0',
    `delivery_partner_referral_bonuses row partner_id=${DP_REFERRER} amount=75.00 status=pending order_id=${orderC1}; referrals 75.00/0.00 rewarded; referee wallet 0.00; DP customer wallet unchanged (${dpWalletBefore})`,
    `engine=${JSON.stringify(r4)}; bonus=${JSON.stringify(bonus)}; referrals=${JSON.stringify(refCRow)}; referee wallet=${cBal}; DP customer wallet ${dpWalletBefore} -> ${dpWalletAfter}`,
    r4?.status === true &&
      !!bonus &&
      Number(bonus.amount) === 75 &&
      bonus.status === 'pending' &&
      bonus.partner_id === DP_REFERRER &&
      cBal === 0 &&
      dpWalletAfter === dpWalletBefore &&
      Number(refCRow?.referrer_reward_amount) === 75,
  );

  // DP push notification
  const dpNotif = (
    await q(
      `SELECT n.title FROM notifications n JOIN notification_recipients nr ON nr.notification_id = n.notification_id
       WHERE nr.user_id = $1 AND n.type = 'referral_bonus' AND n.created_at > NOW() - INTERVAL '2 minutes' LIMIT 1`,
      [DP_REFERRER],
    )
  )[0];
  record(
    'REF-PART-002',
    'Delivery partner receives the Rs.75 acquisition-bonus push',
    'spec sequence diagram: ENG->>REF: "Rs.75 New Customer Acquisition Bonus Accrued!"',
    dpNotif ? dpNotif.title : 'no notification row created for the delivery partner',
    !!dpNotif,
  );

  // ── Auto-create path: users.referred_by only, no referrals row ───────────────
  await mkCustomer(REFEREE_D, 'QaRefereeD', '9000000004', CUST_REFERRER);
  const dBalBefore = await bal(CUST_REFERRER);
  const r5 = await engine.processReferralReward(REFEREE_D, `QAORD${RUN}D1`);
  const dRefRow = (await q(`SELECT refer_id, status FROM referrals WHERE referred_customer_id = $1`, [REFEREE_D]))[0];
  const dBalAfter = await bal(CUST_REFERRER);
  record(
    'REF-CUST-005',
    'Signup-only referral (users.referred_by set, no referrals row) still rewards',
    `engine auto-creates the referrals row and credits the referrer (wallet ${dBalBefore} -> ${dBalBefore + 100})`,
    `engine=${JSON.stringify(r5)}; referrals row=${JSON.stringify(dRefRow ?? null)}; wallet ${dBalBefore} -> ${dBalAfter}`,
    r5?.status === true && !!dRefRow && dBalAfter === dBalBefore + 100,
  );

  // ── REF-CUST-004 self-referral ──────────────────────────────────────────────
  await mkCustomer(REFEREE_E, 'QaRefereeE', '9000000005');
  await q(`UPDATE customers SET first_order_completed = true WHERE customer_id = $1`, [REFEREE_E]);
  const selfValidate = await referralService.validateReferralCode(REFEREE_E, REFEREE_E);
  let selfAdd: any;
  try {
    selfAdd = await referralService.createReferral(REFEREE_E, {
      referral_code: REFEREE_E,
      referee_name: 'Self Referral Attempt',
      referee_phone: '9000000005',
    } as any);
  } catch (e: any) {
    selfAdd = { threw: e?.message };
  }
  const selfRow = (
    await q(`SELECT refer_id, referrer_customer_id, referred_customer_id, status FROM referrals WHERE referrer_customer_id = $1 OR referred_customer_id = $1`, [REFEREE_E])
  )[0];
  record(
    'REF-CUST-004',
    'Self-referral is rejected on the write path',
    'validate returns valid:false; createReferral rejects; no referrals row where referrer = referred',
    `validate=${JSON.stringify(selfValidate)}; add=${JSON.stringify(selfAdd)}; row=${JSON.stringify(selfRow ?? null)}`,
    selfValidate?.valid === false && !selfRow,
  );

  // ── POST /customer/referrals/add write path (role orientation) ───────────────
  const REFEREE_F = `QAREFF${RUN}`;
  await mkCustomer(REFEREE_F, 'QaRefereeF', '9000000006');
  await q(`UPDATE customers SET first_order_completed = true WHERE customer_id = $1`, [REFEREE_F]);
  let addRes: any;
  try {
    addRes = await referralService.createReferral(REFEREE_F, {
      referral_code: CUST_REFERRER,
      referee_name: 'QA Referee F',
      referee_phone: '9000000006',
    } as any);
  } catch (e: any) {
    addRes = { threw: e?.message };
  }
  const addRow = (
    await q(
      `SELECT refer_id, referrer_customer_id, referred_customer_id, referral_code, referrer_reward_amount, status
       FROM referrals WHERE referrer_customer_id = $1 OR referred_customer_id = $1 ORDER BY id DESC LIMIT 1`,
      [REFEREE_F],
    )
  )[0];
  const fUserRef = (await q(`SELECT referred_by FROM users WHERE user_id = $1`, [REFEREE_F]))[0];
  record(
    'REF-CUST-006',
    'Referral submission records caller as REFEREE and code owner as REFERRER',
    `referrals row referrer_customer_id=${CUST_REFERRER}, referred_customer_id=${REFEREE_F}, status=pending; users.referred_by=${CUST_REFERRER}`,
    `api=${JSON.stringify(addRes)}; row=${JSON.stringify(addRow ?? null)}; users.referred_by=${fUserRef?.referred_by ?? 'NULL'}`,
    addRow?.referrer_customer_id === CUST_REFERRER &&
      addRow?.referred_customer_id === REFEREE_F &&
      addRow?.status === 'pending' &&
      fUserRef?.referred_by === CUST_REFERRER,
  );

  // ── Referral-code resolution of the codes supplied by the requester ─────────
  const repo = app.get(ReferralRepository);
  const resolveAshok = await repo.findByReferralCode('ashokroman007');
  const resolveNanda = await repo.findByReferralCode('ashoknanda130120@gmail.com');
  record(
    'REF-CODE-001',
    'Referral code lookup for the supplied customer code "ashokroman007"',
    `resolves to customer ${CUST_REFERRER} (ashokroman007@gmail.com)`,
    resolveAshok
      ? `resolved to customer_id=${resolveAshok.customer_id ?? resolveAshok.user_id} email=${resolveAshok.email} phone=${resolveAshok.phone}`
      : 'not resolved — returns null / "Invalid referral code"',
    (resolveAshok?.customer_id ?? resolveAshok?.user_id) === CUST_REFERRER,
  );
  record(
    'REF-CODE-002',
    'Referral code lookup for the supplied partner code "ashoknanda130120@gmail.com"',
    `resolves to delivery partner ${DP_REFERRER}`,
    resolveNanda
      ? `resolved to customer_id=${resolveNanda.customer_id ?? resolveNanda.user_id} email=${resolveNanda.email} phone=${resolveNanda.phone}`
      : 'not resolved — returns null / "Invalid referral code"',
    (resolveNanda?.customer_id ?? resolveNanda?.user_id) === DP_REFERRER,
  );

  // ── REF-CUST-002 no automatic first-order cashback ──────────────────────────
  const autoCash = await q(
    `SELECT reference_type, COUNT(*)::int AS n FROM customer_wallet_transactions
     WHERE transaction_type = 'credit' AND (LOWER(COALESCE(remarks,'')) LIKE '%welcome%' OR LOWER(COALESCE(remarks,'')) LIKE '%cashback%' OR LOWER(COALESCE(remarks,'')) LIKE '%first order%')
     GROUP BY 1`,
  );
  const refereeCredits = await q(
    `SELECT customer_id, amount, remarks, created_at FROM customer_wallet_transactions
     WHERE customer_id IN ($1, $2, $3, $4) AND transaction_type = 'credit'`,
    [REFEREE_B, REFEREE_C, REFEREE_D, REFEREE_E],
  );
  record(
    'REF-CUST-002',
    'No automatic first-order refund/cashback credited to a new customer',
    'no wallet credit is created for any referee during first-order processing',
    `referee credits in this run = ${JSON.stringify(refereeCredits)}; historical welcome/cashback credits in DB = ${JSON.stringify(autoCash)}`,
    refereeCredits.length === 0,
  );

  // ── Dashboard / unlock rule ─────────────────────────────────────────────────
  const dashLocked = await referralService.getReferralDashboard(REFEREE_C);
  const dashActive = await referralService.getReferralDashboard(CUST_REFERRER);
  record(
    'REF-CUST-007',
    'Referral code is locked before first delivered order, active after',
    'referee whose first order just completed => active code; totals reflect real rewarded referrals',
    `referee ${REFEREE_C}: status=${dashLocked.referral_status} code=${dashLocked.referral_code}; referrer ${CUST_REFERRER}: status=${dashActive.referral_status} code=${dashActive.referral_code} total_referrals=${dashActive.total_referrals} total_earnings=${dashActive.total_earnings}`,
    dashActive.referral_status === 'active' && dashActive.referral_code === CUST_REFERRER,
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  for (const r of results) {
    console.log(`  ${r.pass === true ? 'PASS   ' : r.pass === 'partial' ? 'PARTIAL' : 'FAIL   '}  ${r.id}  ${r.name}`);
  }
  console.log(`\nCreated QA ids (run ${RUN}): ${[REFEREE_B, REFEREE_B2, REFEREE_C, REFEREE_D, REFEREE_E, REFEREE_F].join(', ')}`);
  console.log(`Referrer ${CUST_REFERRER} wallet: ${aBalBefore} -> ${await bal(CUST_REFERRER)}`);
  console.log('══════════════════════════════════════════════════════════════');

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
