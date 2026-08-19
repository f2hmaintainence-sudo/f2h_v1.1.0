const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await client.connect();
  
  // Check active constraints on customer_container_balances
  const constraints = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'customer_container_balances'::regclass
  `);
  console.log('Active Constraints on customer_container_balances:', constraints.rows);

  // Try to insert CONT-001 if it's not there
  try {
    const insertRes = await client.query(`
      INSERT INTO containers (container_id, name, quantity, is_returnable, status, warehouse_id)
      VALUES ('CONT-001', 'Glass Bottle', 999999, true, 'active', 'WH-MRXD13W8PWMMON')
      ON CONFLICT (container_id) DO NOTHING
    `);
    console.log('Insert of CONT-001 result:', insertRes);
  } catch (err) {
    console.error('Failed to insert CONT-001:', err.message);
  }

  // Print all containers again
  const containers = await client.query('SELECT * FROM containers');
  console.log('Containers after insert:', containers.rows);
  
  await client.end();
}

run().catch(console.error);
