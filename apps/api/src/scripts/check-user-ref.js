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

  const cust = await client.query("SELECT * FROM customers WHERE customer_id = 'USERTPCAL0'");
  console.log('CUSTOMER USERTPCAL0:', cust.rows);

  const refs = await client.query("SELECT * FROM referrals WHERE referred_customer_id = 'USERTPCAL0' OR referrer_customer_id = 'USERTPCAL0'");
  console.log('REFERRALS FOR USERTPCAL0:', refs.rows);

  await client.end();
}

run().catch(console.error);
