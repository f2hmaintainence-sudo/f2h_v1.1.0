/**
 * QA harness — dispatch edit deltas against a scratch warehouse.
 *
 * Drives StockMovementCoreService exactly as delivery-dispatch.service.ts does,
 * to prove that editing a handover moves only the difference.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/qa-dispatch-edit-verify.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { StockMovementCoreService } from 'src/panels/admin/catalog-inventory/inventory/services/stock-movement-core.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot()],
  providers: [DatabaseService, DeveloperService, StockMovementCoreService],
})
class QaModule {}

const WH = 'WH-QA-DISPATCH-TEST';
const VARIANT = 'VRT493NKFSHR';
const RUN = 'QA-RUN-DISPATCH';

async function main() {
  const app = await NestFactory.createApplicationContext(QaModule, { logger: ['error'] });
  const db = app.get(DatabaseService);
  const core = app.get(StockMovementCoreService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  const state = async () =>
    (await q(
      `SELECT available_quantity::numeric AS available, reserved_quantity::numeric AS reserved
         FROM stock_balances WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [WH, VARIANT],
    ))[0];

  const movements = async () =>
    await q(
      `SELECT movement_type, direction, quantity::numeric AS quantity
         FROM stock_movements WHERE warehouse_id = $1 ORDER BY id`,
      [WH],
    );

  await q(
    `INSERT INTO stock_balances (warehouse_id, product_variant_id, available_quantity, reserved_quantity, dispatched_quantity, damaged_quantity)
     VALUES ($1, $2, 100, 0, 0, 0)
     ON CONFLICT (warehouse_id, product_variant_id)
     DO UPDATE SET available_quantity = 100, reserved_quantity = 0`,
    [WH, VARIANT],
  );
  await q(`DELETE FROM stock_movements WHERE warehouse_id = $1`, [WH]);

  console.log('═'.repeat(74));
  console.log('DISPATCH EDIT — only the difference moves');
  console.log('═'.repeat(74));
  console.log(`\nScratch warehouse ${WH}, opening stock 100.`);

  // Mirrors the service: delta = loadedQty - previousLoadedQty
  const applyEdit = async (previous: number, loaded: number, label: string) => {
    const delta = loaded - previous;
    await db.transaction(async (client) => {
      if (delta > 0) {
        await core.recordStockMovement(client, {
          warehouse_id: WH, product_variant_id: VARIANT,
          movement_type: 'dispatch', direction: -1, quantity: delta,
          reference_type: 'delivery_run', reference_id: RUN,
          notes: `added ${delta}`, created_by: 'qa',
        });
      } else if (delta < 0) {
        await core.recordStockMovement(client, {
          warehouse_id: WH, product_variant_id: VARIANT,
          movement_type: 'stock_in', direction: 1, quantity: Math.abs(delta),
          reference_type: 'delivery_run', reference_id: RUN,
          notes: `returned ${Math.abs(delta)}`, created_by: 'qa',
        });
      }
    });
    const s = await state();
    console.log(
      `\n${label}\n    loaded ${previous} -> ${loaded}  (delta ${delta > 0 ? '+' : ''}${delta})` +
        `\n    stock available = ${s.available}`,
    );
  };

  await applyEdit(0, 30, '[1] First dispatch of 30');
  await applyEdit(30, 42, '[2] Admin EDITS UP to 42 — only +12 should leave stock');
  await applyEdit(42, 25, '[3] Admin EDITS DOWN to 25 — only 17 should come back');
  await applyEdit(25, 0, '[4] Item removed entirely — remaining 25 returns');

  const s = await state();
  console.log(
    `\nFinal stock = ${s.available} (opened at 100)` +
      (Number(s.available) === 100 ? '  — fully reconciled' : '  <-- FAIL, stock drifted'),
  );

  console.log('\nmovements recorded:');
  for (const m of await movements()) {
    console.log(`    ${String(m.movement_type).padEnd(16)} dir=${String(m.direction).padStart(2)}  qty=${m.quantity}`);
  }
  const rows = await movements();
  const wholeDispatch = rows.some((m) => m.movement_type === 'dispatch' && Number(m.quantity) === 42);
  console.log(
    wholeDispatch
      ? '\n    <-- FAIL: a movement for the WHOLE dispatch (42) was recorded'
      : '\n    no whole-dispatch movement — every row is a delta',
  );
  const adjustments = rows.filter((m) => m.movement_type === 'stock_adjustment').length;
  console.log(
    adjustments === 0
      ? '    no stock_adjustment rows — the adjustments report stays clean'
      : `    <-- ${adjustments} stock_adjustment row(s) still polluting the adjustments report`,
  );

  await q(`DELETE FROM stock_movements WHERE warehouse_id = $1`, [WH]);
  await q(`DELETE FROM stock_balances WHERE warehouse_id = $1`, [WH]);
  console.log(`\nscratch warehouse removed — no real stock was touched`);
  console.log('═'.repeat(74));

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
