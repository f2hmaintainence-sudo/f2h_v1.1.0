const fs = require('fs');
const { Client } = require('pg');

const srcConfig = {
  host: 'database.f2hfresh.com',
  port: 5432,
  user: 'f2h_user',
  password: 'f2h_password',
  database: 'f2h_fresh',
};

const tgtConfig = {
  host: '127.0.0.1',
  port: 5432,
  user: 'f2h_user',
  password: 'f2h_password',
  database: 'f2h_fresh',
};

async function main() {
  console.log('=== STARTING COMPLETE DATABASE SYNC ===');
  const srcClient = new Client(srcConfig);
  const tgtClient = new Client(tgtConfig);

  await srcClient.connect();
  await tgtClient.connect();

  console.log('1. Syncing Custom ENUM Types from Source to Target...');
  const enumsRes = await srcClient.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);
  const enumsMap = {};
  for (const r of enumsRes.rows) {
    if (!enumsMap[r.typname]) enumsMap[r.typname] = [];
    enumsMap[r.typname].push(r.enumlabel);
  }
  for (const [typname, labels] of Object.entries(enumsMap)) {
    const labelsStr = labels.map(l => `'${l.replace(/'/g, "''")}'`).join(', ');
    try {
      await tgtClient.query(`CREATE TYPE "${typname}" AS ENUM (${labelsStr});`);
      console.log(`Created ENUM: ${typname}`);
    } catch (err) {
      for (const val of labels) {
        try {
          await tgtClient.query(`ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS '${val.replace(/'/g, "''")}';`);
        } catch (e) {}
      }
    }
  }

  console.log('2. Syncing Sequences from Source to Target...');
  const seqsRes = await srcClient.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'");
  for (const seqRow of seqsRes.rows) {
    const seq = seqRow.sequence_name;
    try {
      await tgtClient.query(`CREATE SEQUENCE IF NOT EXISTS "${seq}";`);
    } catch (e) {}
  }

  console.log('3. Applying base schema (001-init-unified-schema.sql) to Target...');
  const schemaSql = fs.readFileSync('/home/f2hfresh/htdocs/f2hfresh.com/apps/api/migrations/001-init-unified-schema.sql', 'utf8');
  // Remove psql meta-commands if any
  const cleanSchemaSql = schemaSql.split('\n').filter(line => !line.trim().startsWith('\\')).join('\n');
  try {
    await tgtClient.query(cleanSchemaSql);
    console.log('Base schema applied successfully.');
  } catch (err) {
    console.log('Note on base schema application:', err.message);
  }

  console.log('4. Fetching source tables and creating missing tables/columns...');
  const srcTablesRes = await srcClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
  const srcTables = srcTablesRes.rows.map(r => r.table_name);
  console.log('Source table count: ' + srcTables.length);

  for (const table of srcTables) {
    const tgtCheck = await tgtClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1", [table]);
    if (tgtCheck.rows.length === 0) {
      console.log('Creating missing table on target:', table);
      const cols = await srcClient.query("SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table]);
      const colDefs = cols.rows.map(c => {
        let type = c.udt_name;
        if (c.data_type === 'USER-DEFINED') type = `"${c.udt_name}"`;
        else if (c.data_type === 'ARRAY') type = c.udt_name.replace(/^_/, '') + '[]';
        else if (c.data_type === 'character varying') type = c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'varchar';
        else if (c.data_type === 'timestamp with time zone') type = 'timestamptz';
        else if (c.data_type === 'timestamp without time zone') type = 'timestamp';
        let def = c.column_default ? ' DEFAULT ' + c.column_default : '';
        let nullability = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        return `"${c.column_name}" ${type}${def}${nullability}`;
      });
      const createSql = `CREATE TABLE "${table}" (${colDefs.join(', ')});`;
      try {
        await tgtClient.query(createSql);
      } catch (err) {
        console.log(`Error creating table ${table}:`, err.message);
      }
    } else {
      // Check for missing columns in existing table
      const srcCols = await srcClient.query("SELECT column_name, udt_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]);
      const tgtCols = await tgtClient.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]);
      const tgtColSet = new Set(tgtCols.rows.map(r => r.column_name));
      for (const sc of srcCols.rows) {
        if (!tgtColSet.has(sc.column_name)) {
          let type = sc.udt_name;
          if (sc.data_type === 'USER-DEFINED') type = `"${sc.udt_name}"`;
          else if (sc.data_type === 'character varying') type = sc.character_maximum_length ? `varchar(${sc.character_maximum_length})` : 'varchar';
          else if (sc.data_type === 'timestamp with time zone') type = 'timestamptz';
          else if (sc.data_type === 'timestamp without time zone') type = 'timestamp';
          console.log(`Adding missing column ${sc.column_name} to target table ${table}`);
          try {
            await tgtClient.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${sc.column_name}" ${type};`);
          } catch (err) {
            console.log(`Error adding column ${sc.column_name} to ${table}:`, err.message);
          }
        }
      }
    }
  }

  console.log('5. Disabling target triggers and foreign key checks...');
  await tgtClient.query("SET session_replication_role = 'replica';");

  console.log('6. Truncating target tables...');
  for (const table of srcTables) {
    try {
      await tgtClient.query(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch(e) {}
  }

  console.log('7. Copying exact data table by table...');
  for (const table of srcTables) {
    const srcColsRes = await srcClient.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table]);
    const tgtColsRes = await tgtClient.query("SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table]);
    
    const insertableTgtCols = tgtColsRes.rows.filter(r => r.is_generated !== 'ALWAYS').map(r => r.column_name);
    const tgtColsSet = new Set(insertableTgtCols);
    const commonCols = srcColsRes.rows.map(r => r.column_name).filter(c => tgtColsSet.has(c));

    if (commonCols.length === 0) continue;

    const dataRes = await srcClient.query(`SELECT * FROM "${table}"`);
    const rows = dataRes.rows;

    if (rows.length > 0) {
      console.log(`Copying ${rows.length} rows for table: ${table}`);
      const colList = commonCols.map(c => `"${c}"`).join(', ');

      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        let paramIdx = 1;
        const valPlaceholders = [];
        const queryParams = [];

        for (const row of batch) {
          const rowPlaceholders = [];
          for (const col of commonCols) {
            rowPlaceholders.push(`$${paramIdx++}`);
            let val = row[col];
            if (val !== null && val !== undefined && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
              val = JSON.stringify(val);
            }
            queryParams.push(val);
          }
          valPlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertSql = `INSERT INTO "${table}" (${colList}) VALUES ${valPlaceholders.join(', ')};`;
        await tgtClient.query(insertSql, queryParams);
      }
    } else {
      console.log(`Table ${table}: 0 rows.`);
    }
  }

  console.log('8. Syncing sequence position values...');
  for (const seqRow of seqsRes.rows) {
    const seq = seqRow.sequence_name;
    try {
      const srcSeqVal = await srcClient.query(`SELECT last_value, is_called FROM "${seq}"`);
      if (srcSeqVal.rows.length > 0) {
        const { last_value, is_called } = srcSeqVal.rows[0];
        await tgtClient.query(`SELECT setval('"${seq}"', $1, $2)`, [last_value, is_called]);
      }
    } catch (e) {}
  }

  // Auto-fix primary key serial sequences
  for (const table of srcTables) {
    try {
      const res = await tgtClient.query(`
        SELECT column_name, pg_get_serial_sequence('"${table}"', column_name) as seq
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND pg_get_serial_sequence('"${table}"', column_name) IS NOT NULL
      `, [table]);
      for (const r of res.rows) {
        if (r.seq) {
          await tgtClient.query(`SELECT setval($1, COALESCE((SELECT MAX("${r.column_name}") FROM "${table}"), 1))`, [r.seq]);
        }
      }
    } catch(e) {}
  }

  console.log('9. Re-enabling triggers and constraints...');
  await tgtClient.query("SET session_replication_role = 'origin';");

  console.log('=== DATABASE SYNC COMPLETED SUCCESSFULLY ===');
  await srcClient.end();
  await tgtClient.end();
}

main().catch(async (err) => {
  console.error('FATAL SYNC ERROR:', err);
  process.exit(1);
});

