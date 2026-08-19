const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers'");
  console.log('CUSTOMERS TABLE COLS:', cols.rows);

  const walletTxsCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_wallet_transactions'");
  console.log('WALLET TXS TABLE COLS:', walletTxsCols.rows);

  await client.end();
}

run().catch(console.error);
