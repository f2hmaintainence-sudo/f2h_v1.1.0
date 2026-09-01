import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../shared/database/Database.service';
import { RefundCandidatesService } from '../panels/admin/customers-orders/subscriptions/refund-candidates/refund-candidates.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get(DatabaseService);
  const service = app.get(RefundCandidatesService);

  console.log('--- 1. Check existing columns on customer_wallet_transactions ---');
  const cols = await db.query<any>(
    `SELECT column_name, data_type, character_maximum_length 
       FROM information_schema.columns 
      WHERE table_name = 'customer_wallet_transactions'`
  );
  console.log('Columns before:', cols.map(c => `${c.column_name}: ${c.data_type}(${c.character_maximum_length})`));

  console.log('--- 2. Alter column types to VARCHAR(64) or TEXT ---');
  await db.query(`ALTER TABLE customer_wallet_transactions ALTER COLUMN reference_id TYPE VARCHAR(64);`);
  await db.query(`ALTER TABLE customer_wallet_transactions ALTER COLUMN reference_type TYPE VARCHAR(64);`);
  await db.query(`ALTER TABLE customer_wallet_transactions ALTER COLUMN transaction_id TYPE VARCHAR(64);`);
  await db.query(`ALTER TABLE customer_wallet_transactions ALTER COLUMN created_by TYPE VARCHAR(64);`);

  console.log('--- 3. Check columns after migration ---');
  const colsAfter = await db.query<any>(
    `SELECT column_name, data_type, character_maximum_length 
       FROM information_schema.columns 
      WHERE table_name = 'customer_wallet_transactions'`
  );
  console.log('Columns after:', colsAfter.map(c => `${c.column_name}: ${c.data_type}(${c.character_maximum_length})`));

  console.log('--- 4. Test approve on a real candidate ---');
  const pending = await db.query<any>(
    `SELECT refund_candidate_id, customer_id, status, refund_amount 
       FROM subscription_refund_candidates 
      WHERE status IN ('pending', 'reviewed') AND deleted_at IS NULL 
      LIMIT 1`
  );

  if (pending.length > 0) {
    console.log('Testing bulkApprove with candidate:', pending[0]);
    const res = await service.bulkApprove([pending[0].refund_candidate_id], 'system');
    console.log('bulkApprove Success Result:', JSON.stringify(res, null, 2));
  }

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
