/**
 * QA harness — proves the reserve-at-order-creation behaviour against the live
 * database, using a scratch warehouse so no real stock is touched.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/qa-stock-reservation-verify.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { DataService } from 'src/shared/database/Data.service';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';
import { StockAvailabilityService } from 'src/shared/services/stock-availability.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [
    DatabaseService,
    DeveloperService,
    DataService,
    FieldEncryptionService,
    StockAvailabilityService,
  ],
})
class QaModule {}

const WH = 'WH-QA-RESERVE-TEST';
const VARIANT = 'VRT493NKFSHR';

async function main() {
  const app = await NestFactory.createApplicationContext(QaModule, { logger: ['error'] });
  const db = app.get(DatabaseService);
  const data = app.get(DataService);
  const stock = app.get(StockAvailabilityService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  const state = async () =>
    (await q(
      `SELECT available_quantity::numeric AS available, reserved_quantity::numeric AS reserved
         FROM stock_balances WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [WH, VARIANT],
    ))[0];

  const reset = async (qty: number) => {
    await q(
      `INSERT INTO stock_balances (warehouse_id, product_variant_id, available_quantity, reserved_quantity, dispatched_quantity, damaged_quantity)
       VALUES ($1, $2, $3, 0, 0, 0)
       ON CONFLICT (warehouse_id, product_variant_id)
       DO UPDATE SET available_quantity = $3, reserved_quantity = 0`,
      [WH, VARIANT, qty],
    );
  };

  const line = (s: string) => console.log(s);
  line('═'.repeat(74));
  line('STOCK RESERVATION — reserve at order creation');
  line('═'.repeat(74));

  // ── Your scenario: stock 10, A takes 7, B wants 5 ──────────────────────────
  await reset(10);
  line(`\n[1] Stock 10. Customer A orders 7 for tomorrow.`);
  await data.executeTransaction(async (tx) => {
    await stock.reserveQuantities(tx, [{ variantId: VARIANT, quantity: 7 }], WH);
  });
  let s = await state();
  line(`    after A: available=${s.available} reserved=${s.reserved}  (was 10 / 0)`);

  line(`\n[2] Customer B orders 5 — must be refused, only 3 left.`);
  try {
    await data.executeTransaction(async (tx) => {
      await stock.reserveQuantities(tx, [{ variantId: VARIANT, quantity: 5 }], WH);
    });
    line('    B ACCEPTED  <-- FAIL, this is the oversell');
  } catch (e: any) {
    line(`    B refused: ${e?.message}`);
  }
  s = await state();
  line(`    stock unchanged: available=${s.available} reserved=${s.reserved}`);

  line(`\n[3] Customer B reduces to 3 — must succeed.`);
  await data.executeTransaction(async (tx) => {
    await stock.reserveQuantities(tx, [{ variantId: VARIANT, quantity: 3 }], WH);
  });
  s = await state();
  line(`    after B: available=${s.available} reserved=${s.reserved}  (expect 0 / 10)`);

  // ── Rollback safety ───────────────────────────────────────────────────────
  await reset(10);
  line(`\n[4] Reserve 4, then fail the rest of the transaction — stock must roll back.`);
  try {
    await data.executeTransaction(async (tx) => {
      await stock.reserveQuantities(tx, [{ variantId: VARIANT, quantity: 4 }], WH);
      throw new Error('simulated order-insert failure');
    });
  } catch {
    /* expected */
  }
  s = await state();
  line(
    `    available=${s.available} reserved=${s.reserved}` +
      (Number(s.available) === 10 && Number(s.reserved) === 0
        ? '  — rolled back cleanly'
        : '  <-- FAIL, stock leaked'),
  );

  // ── Concurrency: two simultaneous checkouts for the last units ────────────
  await reset(10);
  line(`\n[5] Stock 10. Two SIMULTANEOUS orders of 7 — exactly one may win.`);
  const attempt = () =>
    data.executeTransaction(async (tx) => {
      await stock.reserveQuantities(tx, [{ variantId: VARIANT, quantity: 7 }], WH);
    });
  const race = await Promise.allSettled([attempt(), attempt()]);
  const won = race.filter((r) => r.status === 'fulfilled').length;
  s = await state();
  line(`    accepted=${won} rejected=${race.length - won}`);
  line(
    `    available=${s.available} reserved=${s.reserved}` +
      (won === 1 && Number(s.reserved) === 7 ? '  — no oversell' : '  <-- FAIL'),
  );

  // ── Release path ─────────────────────────────────────────────────────────
  line(`\n[6] Cancel the winning order — reserved returns to available.`);
  await data.executeTransaction(async (tx) => {
    await stock.releaseQuantities(tx, [{ variantId: VARIANT, quantity: 7 }], WH);
  });
  s = await state();
  line(
    `    available=${s.available} reserved=${s.reserved}` +
      (Number(s.available) === 10 && Number(s.reserved) === 0 ? '  — restored' : '  <-- FAIL'),
  );

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await q(`DELETE FROM stock_balances WHERE warehouse_id = $1`, [WH]);
  line(`\nscratch warehouse ${WH} removed — no real stock was touched`);
  line('═'.repeat(74));

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
