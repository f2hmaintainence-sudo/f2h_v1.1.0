const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'f2hfresh.com',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'f2h_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'f2h_fresh',
  });

  await client.connect();

  console.log('--- Testing strict scheduled_date filtering for 2026-08-03 ---');
  const strictRes = await client.query(
    "SELECT order_id, scheduled_date, created_at, status FROM orders WHERE scheduled_date = '2026-08-03'"
  );
  console.log('Orders with scheduled_date = 2026-08-03:', strictRes.rows.length);

  const oldRes = await client.query(
    "SELECT order_id, scheduled_date, created_at, status FROM orders WHERE (scheduled_date = '2026-08-03' OR created_at::date = '2026-08-03')"
  );
  console.log('Orders with old condition (scheduled_date OR created_at::date):', oldRes.rows.length);

  if (orderRes.rows.length > 0 && orderRes.rows[0].delivery_partner_id) {
    const partnerId = orderRes.rows[0].delivery_partner_id;
    console.log(`\n--- Looking up delivery_partner_id: ${partnerId} ---`);
    
    const dpRes = await client.query(
      "SELECT * FROM delivery_partners WHERE delivery_partner_id = $1 OR user_id = $1",
      [partnerId]
    );
    console.log('delivery_partners table match:', dpRes.rows);

    const userRes = await client.query(
      "SELECT user_id, user_name, first_name, last_name, phone, email FROM users WHERE user_id = $1",
      [partnerId]
    );
    console.log('users table match:', userRes.rows);
  }

  // Let's also sample a few rows from delivery_partners table
  const sampleDp = await client.query("SELECT delivery_partner_id, user_id, full_name, phone FROM delivery_partners LIMIT 5");
  console.log('\nSample delivery_partners rows:', sampleDp.rows);

  await client.end();
}

run().catch(console.error);
