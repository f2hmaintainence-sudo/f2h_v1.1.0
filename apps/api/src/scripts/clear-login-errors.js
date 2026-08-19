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

  console.log('--- Checking users with failed login attempts or lockouts ---');
  const lockedUsers = await client.query(
    "SELECT user_id, email, user_name, max_logins, locked_at, account_status FROM users WHERE max_logins > 0 OR locked_at IS NOT NULL OR account_status != 'active'"
  );
  console.log('Locked / Failed Login Users:', lockedUsers.rows);

  console.log('\n--- Clearing login errors (max_logins = 0, locked_at = null, account_status = active) ---');
  const updateRes = await client.query(
    "UPDATE users SET max_logins = 0, locked_at = NULL, account_status = 'active' WHERE max_logins > 0 OR locked_at IS NOT NULL OR account_status != 'active'"
  );
  console.log('Updated rows count:', updateRes.rowCount);

  const adminUsers = await client.query(
    "SELECT user_id, email, user_name, max_logins, locked_at, account_status FROM users WHERE email IN ('admin.panel@f2hfresh.com', 'f2hmaintainence@gmail.com')"
  );
  console.log('\nAdmin users status:', adminUsers.rows);

  await client.end();
}

run().catch(console.error);
