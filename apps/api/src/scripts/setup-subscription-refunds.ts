import { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_fresh',
  });

  await client.connect();

  console.log('--- Step 1: Ensure subscription_refunds table exists ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS subscription_refunds (
      id VARCHAR(64) PRIMARY KEY,
      subscription_id VARCHAR(64) NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      refund_date DATE NOT NULL,
      refund_month VARCHAR(7) NOT NULL,
      total_paused_days INT NOT NULL,
      refund_amount NUMERIC(10, 2) NOT NULL,
      wallet_transaction_id VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('subscription_refunds table created/verified.');

  console.log('--- Step 2: Ensure subscription_pauses structure ---');
  await client.query(`
    ALTER TABLE subscription_pauses 
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'paused',
    ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;
  `);

  console.log('--- Step 3: Remove existing records in subscription_pauses ---');
  await client.query('DELETE FROM subscription_pauses;');
  console.log('Cleared existing records in subscription_pauses.');

  console.log('--- Step 4: Pick active subscription ---');
  const subRes = await client.query(`
    SELECT s.subscription_id, s.customer_id, s.status, s.shift
    FROM subscriptions s
    LIMIT 1;
  `);

  if (!subRes.rows.length) {
    console.error('No subscriptions found in database!');
    await client.end();
    return;
  }

  const sub = subRes.rows[0];
  console.log('Selected Subscription:', sub);

  const subItemsRes = await client.query(`
    SELECT id, subscription_id, variant_id, quantity, price, per_delivery_price
    FROM subscription_items
    WHERE subscription_id = $1;
  `, [sub.subscription_id]);

  console.log('Subscription Items:', subItemsRes.rows);

  const item = subItemsRes.rows[0] || {
    id: 'ITEM_DUMMY_1',
    quantity: 1,
    price: 32.00,
    per_delivery_price: 32.00
  };

  // Determine daily rate: quantity * price * shifts (if 2 shifts, multiply by 2)
  const itemPrice = Number(item.per_delivery_price || item.price || 32.00);
  const qty = Number(item.quantity || 1);
  const isTwoShifts = sub.shift === 'both' || sub.shift === '2_shifts' || sub.shift === 'morning_and_evening';
  const shiftsPerDay = isTwoShifts ? 2 : 1;
  const dailyRate = itemPrice * qty * shiftsPerDay;

  console.log(`Calculation parameters: itemPrice=₹${itemPrice}, qty=${qty}, shiftsPerDay=${shiftsPerDay} -> dailyRate=₹${dailyRate}/day`);

  console.log('--- Step 5: Add dummy pause records for July 2026 ---');
  // Pause 1: July 5 to July 7 (3 days)
  const pause1Id = `PAUSE_${Date.now()}_1`;
  await client.query(`
    INSERT INTO subscription_pauses (id, subscription_id, subscription_item_id, start_date, end_date, reason, status, is_refunded, created_at, updated_at)
    VALUES ($1, $2, $3, '2026-07-05', '2026-07-07', 'Customer on vacation', 'resumed', false, NOW(), NOW());
  `, [pause1Id, sub.subscription_id, item.id]);

  // Pause 2: July 9 to July 10 (2 days)
  const pause2Id = `PAUSE_${Date.now()}_2`;
  await client.query(`
    INSERT INTO subscription_pauses (id, subscription_id, subscription_item_id, start_date, end_date, reason, status, is_refunded, created_at, updated_at)
    VALUES ($1, $2, $3, '2026-07-09', '2026-07-10', 'Out of station', 'resumed', false, NOW(), NOW());
  `, [pause2Id, sub.subscription_id, item.id]);

  console.log('Inserted dummy pause records (3 days + 2 days = 5 days total).');

  console.log('--- Step 6: Perform Month-End Calculation & Refund Creation ---');
  // Total Paused Days = 3 + 2 = 5 days
  const totalPausedDays = 5;
  const totalRefundAmount = totalPausedDays * dailyRate;

  console.log(`Month-End Total: ${totalPausedDays} paused days × ₹${dailyRate} = ₹${totalRefundAmount}`);

  // Fetch current customer wallet balance
  const custRes = await client.query(`SELECT wallet_balance FROM customers WHERE customer_id = $1;`, [sub.customer_id]);
  const currentBalance = Number(custRes.rows[0]?.wallet_balance || 0);
  const newBalance = currentBalance + totalRefundAmount;

  // Update customer wallet balance
  await client.query(`UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE customer_id = $2;`, [newBalance, sub.customer_id]);

  // Create Wallet Transaction
  const walletTxId = `CWT_REFUND_${Date.now()}`;
  await client.query(`
    INSERT INTO customer_wallet_transactions (id, customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_at)
    VALUES ($1, $2, 'credit', $3, $4, 'subscription_pause_refund', $5, $6, NOW());
  `, [walletTxId, sub.customer_id, totalRefundAmount, newBalance, sub.subscription_id, `Refund for ${totalPausedDays} paused days in July 2026`]);

  // Create Single Subscription Refund Record
  const refundId = `SUB_REFUND_${Date.now()}`;
  await client.query(`
    INSERT INTO subscription_refunds (id, subscription_id, customer_id, refund_date, refund_month, total_paused_days, refund_amount, wallet_transaction_id, created_at)
    VALUES ($1, $2, $3, '2026-07-31', '2026-07', $4, $5, $6, NOW());
  `, [refundId, sub.subscription_id, sub.customer_id, totalPausedDays, totalRefundAmount, walletTxId]);

  // Mark subscription_pauses as is_refunded = true
  await client.query(`
    UPDATE subscription_pauses
    SET is_refunded = true, updated_at = NOW()
    WHERE subscription_id = $1 AND is_refunded = false;
  `, [sub.subscription_id]);

  console.log('✅ MONTH-END REFUND SUCCESSFUL!');
  console.log(`- Refund ID: ${refundId}`);
  console.log(`- Customer ID: ${sub.customer_id}`);
  console.log(`- Refund Month: 2026-07`);
  console.log(`- Total Paused Days: ${totalPausedDays}`);
  console.log(`- Total Refund Credited: ₹${totalRefundAmount}`);
  console.log(`- New Wallet Balance: ₹${newBalance}`);
  console.log(`- Wallet Tx ID: ${walletTxId}`);

  await client.end();
}

run().catch(console.error);
