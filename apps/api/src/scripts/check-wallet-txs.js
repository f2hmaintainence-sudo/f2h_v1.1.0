const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'database.f2hfresh.com',
    port: 5432,
    user: 'f2h_user',
    password: 'f2h_password',
    database: 'f2h_fresh',
  });

  await client.connect();

  console.log('--- CUSTOMERS TABLE ---');
  const custs = await client.query('SELECT customer_id, email, phone, wallet_balance, referral_status, first_order_completed FROM customers');
  console.table(custs.rows);

  console.log('--- ALL WALLET TRANSACTIONS ---');
  const txs = await client.query('SELECT * FROM customer_wallet_transactions ORDER BY created_at DESC');
  console.table(txs.rows);

  await client.end();
}

run().catch(console.error);
