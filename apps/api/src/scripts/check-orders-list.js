const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'database.f2hfresh.com',
    port: 5432,
    user: 'f2h_user',
    password: process.env.DB_PASSWORD,
    database: 'f2h_fresh',
  });

  await client.connect();

  console.log('--- ALL ORDERS ---');
  const orders = await client.query('SELECT order_id, customer_id, customer_name, status, total_amount, payment_mode, created_at FROM orders ORDER BY created_at DESC');
  console.table(orders.rows);

  await client.end();
}

run().catch(console.error);
