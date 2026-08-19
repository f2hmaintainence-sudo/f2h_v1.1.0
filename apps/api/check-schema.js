const { Pool } = require('pg');
require('dotenv').config();

async function check() {
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'f2h_fresh',
    user: process.env.DB_USERNAME || 'f2h_user',
    password: process.env.DB_PASSWORD,
  });

  try {
    const resLogs = await pool.query(`
      SELECT order_id, status, bottles_collected, returned_containers, damaged_containers, lost_containers 
      FROM delivery_logs
    `);
    console.log('delivery_logs records:');
    console.log(resLogs.rows);

    const resOrders = await pool.query(`
      SELECT order_id, empty_bottles_expected, empty_bottles_collected, bottles_with_customer 
      FROM orders
    `);
    console.log('orders records:');
    console.log(resOrders.rows);
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    await pool.end();
  }
}
check();
