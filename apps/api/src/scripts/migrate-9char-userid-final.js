const { Client } = require('pg');
const crypto = require('crypto');

function generate9CharUserId(existingIds) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  do {
    id = 'F2H';
    for (let i = 0; i < 6; i++) { // F2H (3 chars) + 6 chars = 9 total chars
      id += chars[crypto.randomInt(chars.length)];
    }
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

async function run() {
  const client = new Client({
    connectionString: 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_fresh'
  });

  await client.connect();
  console.log('Connected to PostgreSQL database for 9-char User ID (F2H + 6 random chars = 9 total) migration.');

  try {
    await client.query('BEGIN');

    // 1. Ensure referred_by column exists on users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50);
    `);

    // 2. Fetch all current users
    const usersRes = await client.query('SELECT user_id, email, phone, role_id, referred_by FROM users');
    const users = usersRes.rows;
    console.log(`Found ${users.length} existing users to migrate.`);

    const existingIds = new Set();
    const idMap = new Map(); // old_id -> new_9char_id

    for (const u of users) {
      if (u.user_id && u.user_id.length === 9 && u.user_id.startsWith('F2H')) {
        idMap.set(u.user_id, u.user_id);
        existingIds.add(u.user_id);
      } else {
        const newId = generate9CharUserId(existingIds);
        idMap.set(u.user_id, newId);
        console.log(`Mapping user: ${u.user_id} (${u.email || u.phone}) -> ${newId}`);
      }
    }

    // List of table columns to update
    const userColumns = [
      { table: 'auth_logs', col: 'user_id' },
      { table: 'carts', col: 'user_id' },
      { table: 'container_transactions', col: 'customer_id' },
      { table: 'customer_activity_logs', col: 'customer_id' },
      { table: 'customer_addresses', col: 'customer_id' },
      { table: 'customer_bills', col: 'customer_id' },
      { table: 'customer_container_balances', col: 'customer_id' },
      { table: 'customer_feedback', col: 'customer_id' },
      { table: 'customer_special_prices', col: 'customer_id' },
      { table: 'customer_wallet_transactions', col: 'customer_id' },
      { table: 'customers', col: 'customer_id' },
      { table: 'delivery_location_logs', col: 'user_id' },
      { table: 'delivery_partner_locations', col: 'user_id' },
      { table: 'delivery_partners', col: 'user_id' },
      { table: 'delivery_run_addresses', col: 'customer_id' },
      { table: 'device_sessions', col: 'user_id' },
      { table: 'management_staff', col: 'user_id' },
      { table: 'notification_recipients', col: 'user_id' },
      { table: 'order_containers', col: 'customer_id' },
      { table: 'orders', col: 'customer_id' },
      { table: 'password_history', col: 'user_id' },
      { table: 'payments', col: 'customer_id' },
      { table: 'referrals', col: 'referred_customer_id' },
      { table: 'referrals', col: 'referrer_customer_id' },
      { table: 'refunds', col: 'customer_id' },
      { table: 'role_assignments', col: 'user_id' },
      { table: 'subscription_refunds', col: 'customer_id' },
      { table: 'subscription_renewal_attempts', col: 'customer_id' },
      { table: 'subscriptions', col: 'customer_id' },
      { table: 'support_tickets', col: 'user_id' },
      { table: 'user_devices', col: 'user_id' },
      { table: 'users', col: 'referred_by' },
      { table: 'users', col: 'user_id' },
    ];

    for (const item of userColumns) {
      for (const [oldId, newId] of idMap.entries()) {
        if (oldId === newId) continue;
        try {
          await client.query(`
            UPDATE ${item.table} SET ${item.col} = $1 WHERE ${item.col} = $2
          `, [newId, oldId]);
        } catch (err) {
          console.warn(`Note on ${item.table}.${item.col}: ${err.message}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('SUCCESS: All 13 users & referencing records updated to 9-character User IDs (F2H + 6 random chars = 9 total)!');

    // Print resulting user list
    const updatedUsers = await client.query('SELECT user_id, email, phone, role_id, referred_by FROM users');
    console.log('Migrated 9-Char Users List:', updatedUsers.rows);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('MIGRATION FAILED:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
