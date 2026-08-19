/**
 * Applies pending SQL migrations from `apps/api/migrations`, in filename order.
 *
 * The previous version applied one hardcoded file (`061-referrals.sql`, which does
 * not exist) and rewrote its SQL with regexes to make it re-runnable. There was no
 * record of what had been applied, so "has this migration run?" was unanswerable.
 *
 * Each file runs in its own transaction and is recorded in `schema_migrations`
 * along with a checksum, so an already-applied file is skipped and an edited one is
 * reported rather than silently re-run.
 *
 * Usage:
 *   npm run db:migrate                     DRY RUN — prints the target and what
 *                                          would run, changes nothing
 *   npm run db:migrate -- --yes            actually apply
 *   npm run db:migrate -- --yes --baseline=NNN
 *                                          record every file up to and including
 *                                          NNN as applied WITHOUT running it
 *
 * A dry run is the default on purpose. The target database is resolved from the
 * environment, and `.env` here carries both DATABASE_URL and DB_* variables that
 * can point at different databases — so the runner prints exactly what it is
 * connected to and refuses to write without --yes.
 *
 * The baseline flag exists because migrations 001-008 in this repository come from
 * a different schema lineage than the live database — the live schema is the
 * authority. On an existing environment, baseline through the last file that
 * predates this runner, then let it apply everything after.
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function main() {
  const apply = process.argv.includes('--yes');
  const dryRun = !apply;
  const baselineArg = process.argv.find((arg) => arg.startsWith('--baseline='));
  const baselineThrough = baselineArg?.split('=')[1];

  // The discrete DB_* variables win over DATABASE_URL. The old precedence was the
  // other way round, which meant an explicitly supplied DB_DATABASE was ignored and
  // the migration silently went to whatever DATABASE_URL in .env pointed at.
  const hasDiscreteConfig = Boolean(process.env.DB_DATABASE && process.env.DB_USERNAME);
  if (!hasDiscreteConfig && !process.env.DATABASE_URL) {
    throw new Error(
      'Set DB_DATABASE + DB_USERNAME + DB_PASSWORD (preferred), or DATABASE_URL',
    );
  }

  const config = hasDiscreteConfig
    ? {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_DATABASE as string,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
      }
    : { connectionString: process.env.DATABASE_URL };

  const pool = new Pool(config);

  // Say out loud which database is about to be changed.
  const { rows: target } = await pool.query<{ db: string; host: string | null }>(
    `SELECT current_database() AS db, inet_server_addr()::text AS host`,
  );
  console.log(
    `target: ${target[0].db} on ${target[0].host ?? 'local socket'}` +
      `  [${dryRun ? 'DRY RUN — pass --yes to apply' : 'APPLYING'}]`,
  );

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows: applied } = await pool.query<{ filename: string; checksum: string }>(
      `SELECT filename, checksum FROM schema_migrations`,
    );
    const appliedByName = new Map(applied.map((row) => [row.filename, row.checksum]));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    let ran = 0;

    for (const filename of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = appliedByName.get(filename);

      if (previous) {
        if (previous !== checksum) {
          // Editing an applied migration is how two environments silently diverge.
          console.warn(
            `! ${filename} was applied but its contents have changed. ` +
              `Add a new migration instead of editing this one.`,
          );
        }
        continue;
      }

      if (baselineThrough && filename <= baselineThrough) {
        if (dryRun) {
          console.log(`would baseline ${filename} (recorded, not executed)`);
        } else {
          await pool.query(
            `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)
             ON CONFLICT (filename) DO NOTHING`,
            [filename, checksum],
          );
          console.log(`baselined ${filename} (recorded, not executed)`);
        }
        ran++;
        continue;
      }

      if (dryRun) {
        console.log(`would apply ${filename}`);
        ran++;
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`,
          [filename, checksum],
        );
        await client.query('COMMIT');
        console.log(`applied ${filename}`);
        ran++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `${filename} failed and was rolled back: ${(error as Error).message}`,
        );
      } finally {
        client.release();
      }
    }

    console.log(
      ran === 0
        ? 'No pending migrations.'
        : `${dryRun ? 'Would apply' : 'Applied'} ${ran} migration(s).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
