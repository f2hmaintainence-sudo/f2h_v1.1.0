const { Pool } = require('pg');

const pool = new Pool({
  host: '95.111.246.72',
  port: 5432,
  database: 'f2h_fresh',
  user: 'f2hfresh',
  password: 'f2hfresh123'
});

async function run() {
  try {
    await pool.query(`ALTER TABLE auth_otp_challenges DROP CONSTRAINT auth_otp_challenges_purpose_check;`);
    await pool.query(`ALTER TABLE auth_otp_challenges ADD CONSTRAINT auth_otp_challenges_purpose_check CHECK (purpose IN ('registration', 'forgot_password', 'email_change'));`);
    console.log('Success!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
