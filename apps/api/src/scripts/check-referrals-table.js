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

  console.log('--- REFERRALS TABLE SCHEMA ---');
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'referrals'");
  console.log(cols.rows);

  console.log('--- ALL REFERRAL RECORDS ---');
  const refs = await client.query('SELECT * FROM referrals');
  console.table(refs.rows);

  await client.end();
}

run().catch(console.error);
