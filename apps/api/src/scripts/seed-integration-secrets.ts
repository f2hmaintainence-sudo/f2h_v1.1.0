/**
 * Writes the *secret* halves of the API integrations into
 * `api_integrations_config`, reading them from the untracked `.env`.
 *
 * Migrations seed everything that is safe to commit; this fills in the fields
 * that are not. Splitting it this way is what lets the whole configuration live
 * in the database — rotatable from Admin → Developer → API Integrations —
 * without a private key ever entering git.
 *
 * Every field is merged into the existing row, so a config edited in the admin
 * panel keeps its other values.
 *
 * Usage:
 *   npm run seed:integration-secrets              DRY RUN — lists what it would
 *                                                 set, values masked
 *   npm run seed:integration-secrets -- --yes     actually write
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface SecretField {
  /** Row to merge into. */
  category: string;
  configKey: string;
  /** jsonb key to set. */
  field: string;
  /** Environment variable holding the value. */
  env: string;
}

const SECRETS: SecretField[] = [
  { category: 'email', configKey: 'smtp', field: 'smtp_pass', env: 'INFO_MAIL_PASSWORD' },
  { category: 'payment-gateway', configKey: 'razorpay', field: 'private_api_key', env: 'RAZORPAY_KEY_SECRET' },
  { category: 'payment-gateway', configKey: 'razorpay', field: 'webhook_secret', env: 'RAZORPAY_WEBHOOK_SECRET' },
];

/** Shows enough to recognise a value without printing it. */
function mask(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 20))}${value.slice(-2)}`;
}

async function main() {
  const apply = process.argv.includes('--yes');

  const hasDiscreteConfig = Boolean(process.env.DB_DATABASE && process.env.DB_USERNAME);
  if (!hasDiscreteConfig && !process.env.DATABASE_URL) {
    throw new Error('Set DB_DATABASE + DB_USERNAME + DB_PASSWORD (preferred), or DATABASE_URL');
  }

  const pool = new Pool(
    hasDiscreteConfig
      ? {
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: process.env.DB_DATABASE as string,
          user: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
        }
      : { connectionString: process.env.DATABASE_URL },
  );

  try {
    const { rows: target } = await pool.query<{ db: string; host: string | null }>(
      `SELECT current_database() AS db, inet_server_addr()::text AS host`,
    );
    console.log(
      `target: ${target[0].db} on ${target[0].host ?? 'local socket'}` +
        `  [${apply ? 'APPLYING' : 'DRY RUN — pass --yes to write'}]\n`,
    );

    let written = 0;
    for (const secret of SECRETS) {
      const value = process.env[secret.env];
      const label = `${secret.category}:${secret.configKey}.${secret.field}`;

      if (!value) {
        console.log(`skip  ${label}  (${secret.env} not set)`);
        continue;
      }

      if (!apply) {
        console.log(`would set ${label} = ${mask(value)}`);
        written++;
        continue;
      }

      const { rowCount } = await pool.query(
        `UPDATE public.api_integrations_config
            SET config_data = config_data || jsonb_build_object($3::text, $4::text),
                updated_at  = CURRENT_TIMESTAMP
          WHERE category = $1 AND config_key = $2`,
        [secret.category, secret.configKey, secret.field, value],
      );

      if (rowCount === 0) {
        // The row is created by a migration; without it there is nothing to
        // merge into and the secret would be silently dropped.
        console.warn(
          `!     ${label}  — no such row. Run the migrations first (npm run db:migrate).`,
        );
        continue;
      }

      console.log(`set   ${label} = ${mask(value)}`);
      written++;
    }

    console.log(
      written === 0
        ? '\nNothing to do.'
        : `\n${apply ? 'Wrote' : 'Would write'} ${written} secret(s).`,
    );
    if (apply && written > 0) console.log('Restart the API so the cached configs refresh.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
