import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RefundCandidatesService } from '../panels/admin/customers-orders/subscriptions/refund-candidates/refund-candidates.service';
import { DatabaseService } from '../shared/database/Database.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const service = app.get(RefundCandidatesService);
  const db = app.get(DatabaseService);

  const pending = await db.query<any>(
    `SELECT refund_candidate_id, customer_id, status, refund_amount 
       FROM subscription_refund_candidates 
      WHERE status IN ('pending', 'reviewed') AND deleted_at IS NULL 
      LIMIT 5`
  );

  console.log('Pending candidates:', pending);

  const cols = await db.query<any>(
    `SELECT column_name, data_type, character_maximum_length 
       FROM information_schema.columns 
      WHERE table_name = 'customer_wallet_transactions'`
  );
  console.log('customer_wallet_transactions columns:', cols);

  await app.close();
  process.exit(0);
}

main().catch(console.error);
