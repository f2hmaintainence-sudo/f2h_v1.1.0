import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'f2h_fresh',
    user: process.env.DB_USERNAME || 'f2h_user',
    password: process.env.DB_PASSWORD || 'f2h_password',
  });

  try {
    const migrationFile = path.join(__dirname, '../../migrations/061-referrals.sql');
    if (!fs.existsSync(migrationFile)) {
      console.error('Migration file not found:', migrationFile);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('Running migration 061-referrals.sql...');

    // Replace CREATE TABLE / INDEX with IF NOT EXISTS for safe execution
    const safeSql = sql
      .replace(/CREATE TABLE referrals/g, 'CREATE TABLE IF NOT EXISTS referrals')
      .replace(/CREATE INDEX/g, 'CREATE INDEX IF NOT EXISTS');

    await pool.query(safeSql);
    console.log('Successfully applied 061-referrals.sql migration!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
