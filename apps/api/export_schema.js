const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function exportLiveSchema() {
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'f2h_fresh',
    user: process.env.DB_USERNAME || 'f2h_user',
    password: process.env.DB_PASSWORD,
  });

  try {
    const res = await pool.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        character_maximum_length, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const tables = {};
    for (const row of res.rows) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        max_len: row.character_maximum_length,
        nullable: row.is_nullable,
        default: row.column_default,
      });
    }

    const outPath = '/root/.gemini/antigravity-ide/brain/2866cb26-c48e-4429-a392-6bb7ed04ec21/scratch/live_schema.json';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(tables, null, 2));
    console.log('Successfully saved schema to:', outPath);
    console.log('Total tables found in live DB:', Object.keys(tables).length);
  } catch (err) {
    console.error('Error dumping schema:', err);
  } finally {
    await pool.end();
  }
}

exportLiveSchema();
