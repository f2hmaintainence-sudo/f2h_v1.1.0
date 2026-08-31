/**
 * QA harness part 2 — referrer-resolution edge cases for the 09-referrals spec.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/qa-referral-live-test-2.ts
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
import { ReferralRewardEngineService } from 'src/panels/customer/referral/services/referral-reward-engine.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [DataService, DatabaseService, DeveloperService, FieldEncryptionService, ReferralRepository, ReferralRewardEngineService],
})
class QaModule {}

const RUN = Date.now().toString(36).toUpperCase().slice(-6);

async function main() {
  const app = await NestFactory.createApplicationContext(QaModule, { logger: ['error'] });
  const db = app.get(DatabaseService);
  const engine = app.get(ReferralRewardEngineService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  const mk = async (id: string) => {
    await q(
      `INSERT INTO users (user_id, first_name, last_name, user_name, email, phone, role_id, account_status, created_at, updated_at)
       VALUES ($1,'QaEdge','QA',$1,$2,$3,'CUSTOMER','active',NOW(),NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [id, `${id.toLowerCase()}@f2htest.local`, `8${Math.floor(Math.random() * 900000000 + 100000000)}`],
    );
    await q(
      `INSERT INTO customers (customer_id, wallet_balance, first_order_completed, created_at, updated_at)
       VALUES ($1, 0.00, false, NOW(), NOW()) ON CONFLICT (customer_id) DO NOTHING`,
      [id],
    );
  };

  // EDG-REF-A: referrer id that has no customers row (APP_INVITE_GENERAL / phantom code owner)
  const refereeA = `QAEDGA${RUN}`;
  await mk(refereeA);
  await q(
    `INSERT INTO referrals (refer_id, referrer_customer_id, referred_customer_id, referral_code,
       referrer_reward_amount, referred_reward_amount, status, remarks, created_at, updated_at)
     VALUES ($1,'APP_INVITE_GENERAL',$2,'APP INVITE',100.00,0.00,'pending','QA edge test',NOW(),NOW())`,
    [`QAEDG${RUN}A`, refereeA],
  );
  const res = await engine.processReferralReward(refereeA, `QAORD${RUN}A1`);
  const orphan = await q(
    `SELECT transaction_id, customer_id, amount, balance_after, reference_type FROM customer_wallet_transactions WHERE customer_id = 'APP_INVITE_GENERAL'`,
  );
  const custExists = await q(`SELECT customer_id FROM customers WHERE customer_id = 'APP_INVITE_GENERAL'`);
  const refState = await q(`SELECT status, rewarded_at FROM referrals WHERE refer_id = $1`, [`QAEDG${RUN}A`]);

  console.log('\n[EDG-REF-A] Referrer id that owns no customers row ("APP INVITE" general code)');
  console.log('  engine        :', JSON.stringify(res));
  console.log('  customers row :', custExists.length ? 'exists' : 'DOES NOT EXIST — nothing was credited');
  console.log('  ledger rows   :', JSON.stringify(orphan));
  console.log('  referral state:', JSON.stringify(refState[0]));

  // EDG-REF-B: circular referral A -> B and B -> A
  const x = `QAEDGX${RUN}`;
  const y = `QAEDGY${RUN}`;
  await mk(x);
  await mk(y);
  await q(
    `INSERT INTO referrals (refer_id, referrer_customer_id, referred_customer_id, referral_code,
       referrer_reward_amount, referred_reward_amount, status, remarks, created_at, updated_at)
     VALUES ($1,$2,$3,$2,100.00,0.00,'pending','QA circular',NOW(),NOW()),
            ($4,$3,$2,$3,100.00,0.00,'pending','QA circular',NOW(),NOW())`,
    [`QAEDG${RUN}X`, x, y, `QAEDG${RUN}Y`],
  );
  const cb1 = await engine.processReferralReward(y, `QAORD${RUN}X1`);
  const cb2 = await engine.processReferralReward(x, `QAORD${RUN}Y1`);
  const bals = await q(`SELECT customer_id, wallet_balance FROM customers WHERE customer_id IN ($1,$2)`, [x, y]);
  console.log('\n[EDG-REF-B] Circular referral A->B and B->A');
  console.log('  B first order :', JSON.stringify(cb1));
  console.log('  A first order :', JSON.stringify(cb2));
  console.log('  balances      :', JSON.stringify(bals), '(each mutually mined Rs.100 from the other)');

  console.log(`\nCreated QA ids (run ${RUN}): ${[refereeA, x, y].join(', ')}`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
