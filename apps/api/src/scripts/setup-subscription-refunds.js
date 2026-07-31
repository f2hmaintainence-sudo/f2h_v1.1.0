const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://f2h_user:f2h_password@f2hfresh.com:5432/f2h_fresh',
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
  console.log('subscription_pauses structure verified.');

  console.log('--- Step 3: Remove existing records in subscription_pauses ---');
  await client.query('DELETE FROM subscription_pauses;');
  console.log('Cleared all existing records in subscription_pauses.');

  console.log('--- Step 4: Pick an active subscription from DB ---');
  const subRes = await client.query(`
    SELECT s.subscription_id, s.customer_id, s.status
    FROM subscriptions s
    WHERE s.status = 'active'
    LIMIT 1;
  `);

  if (!subRes.rows.length) {
    console.error('No active subscriptions found in database!');
    await client.end();
    return;
  }

  const sub = subRes.rows[0];
  console.log('Selected Subscription:', sub);

  const subItemsRes = await client.query(`
    SELECT id, subscription_id, product_variant_id, unit_price, final_price
    FROM subscription_items
    WHERE subscription_id = $1;
  `, [sub.subscription_id]);

  console.log('Subscription Items:', subItemsRes.rows);

  const item = subItemsRes.rows[0] || {
    id: 'ITEM_DUMMY_1',
    unit_price: 35.00,
    final_price: 35.00
  };

  const itemPrice = Number(item.final_price || item.unit_price || 35.00);
  const dailyRate = itemPrice;

  console.log(`Daily Item Rate = ₹${dailyRate}/day`);

  console.log('--- Step 5: Add dummy pause records for July 2026 ---');
  // Pause 1: July 5 to July 7 (3 days paused, then resumed)
  await client.query(`
    INSERT INTO subscription_pauses (subscription_id, subscription_item_id, start_date, end_date, reason, status, is_refunded, created_at)
    VALUES ($1, $2, '2026-07-05', '2026-07-07', 'Customer 3-day vacation', 'resumed', false, NOW());
  `, [sub.subscription_id, item.id]);

  // Pause 2: July 9 to July 10 (2 days paused, then resumed)
  await client.query(`
    INSERT INTO subscription_pauses (subscription_id, subscription_item_id, start_date, end_date, reason, status, is_refunded, created_at)
    VALUES ($1, $2, '2026-07-09', '2026-07-10', 'Out of station 2 days', 'resumed', false, NOW());
  `, [sub.subscription_id, item.id]);

  console.log('Inserted 2 dummy pause records (3 days + 2 days = 5 total paused days).');

  console.log('--- Step 6: Perform Month-End Calculation & Create Single Refund Record ---');
  const totalPausedDays = 5;
  const totalRefundAmount = totalPausedDays * dailyRate;

  console.log(`Calculated Refund: ${totalPausedDays} days × ₹${dailyRate} = ₹${totalRefundAmount}`);

  // Fetch current customer wallet balance
  const custRes = await client.query(`SELECT wallet_balance FROM customers WHERE customer_id = $1;`, [sub.customer_id]);
  const currentBalance = Number(custRes.rows[0]?.wallet_balance || 0);
  const newBalance = currentBalance + totalRefundAmount;

  // Update customer wallet balance
  await client.query(`UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE customer_id = $2;`, [newBalance, sub.customer_id]);

  // Create Wallet Transaction
  const walletTxRes = await client.query(`
    INSERT INTO customer_wallet_transactions (customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_at)
    VALUES ($1, 'credit', $2, $3, 'subscription_pause_refund', $4, $5, NOW())
    RETURNING id;
  `, [sub.customer_id, totalRefundAmount, newBalance, sub.subscription_id, `Refund for ${totalPausedDays} paused days in July 2026`]);
  
  const walletTxId = String(walletTxRes.rows[0]?.id || `CWT_${Date.now()}`);

  // Create ONE Single Subscription Refund Record in subscription_refunds
  const refundId = `SUB_REFUND_${Date.now()}`;
  await client.query(`
    INSERT INTO subscription_refunds (id, subscription_id, customer_id, refund_date, refund_month, total_paused_days, refund_amount, wallet_transaction_id, created_at)
    VALUES ($1, $2, $3, '2026-07-31', '2026-07', $4, $5, $6, NOW());
  `, [refundId, sub.subscription_id, sub.customer_id, totalPausedDays, totalRefundAmount, walletTxId]);

  // Mark subscription_pauses records as refunded
  await client.query(`
    UPDATE subscription_pauses
    SET is_refunded = true
    WHERE subscription_id = $1 AND is_refunded = false;
  `, [sub.subscription_id]);

  console.log('====================================================');
  console.log('🎉 MONTH-END REFUND PROCESSED SUCCESSFULLY!');
  console.log(`- Refund Record ID    : ${refundId}`);
  console.log(`- Subscription ID     : ${sub.subscription_id}`);
  console.log(`- Customer ID         : ${sub.customer_id}`);
  console.log(`- Refund Month        : 2026-07`);
  console.log(`- Total Paused Days   : ${totalPausedDays}`);
  console.log(`- Item Daily Rate     : ₹${dailyRate}`);
  console.log(`- Total Refund Amount : ₹${totalRefundAmount}`);
  console.log(`- Prev Wallet Balance : ₹${currentBalance}`);
  console.log(`- New Wallet Balance  : ₹${newBalance}`);
  console.log(`- Wallet Tx ID        : ${walletTxId}`);
  console.log('====================================================');

  await client.end();
}

run().catch(console.error);
