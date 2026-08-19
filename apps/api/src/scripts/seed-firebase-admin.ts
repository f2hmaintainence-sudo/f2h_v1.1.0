/**
 * Loads the Firebase Admin service account into `api_integrations_config`
 * (`category = 'firebase'`, `config_key = 'admin'`), which is where
 * PushNotificationService looks first when it initialises the Admin SDK.
 *
 * This is a script rather than a migration because the file it reads is a
 * private key. Migrations are tracked in git; `keys-set/` is not.
 *
 * Usage:
 *   npm run seed:firebase-admin                        DRY RUN — prints the
 *                                                      target and the identity
 *                                                      it would store
 *   npm run seed:firebase-admin -- --yes               actually write
 *   npm run seed:firebase-admin -- --yes --file=PATH   use a different key file
 *
 * Like the migration runner, a dry run is the default and the target database
 * is printed before anything is written.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const DEFAULT_KEY_PATHS = [
  path.join(__dirname, '../shared/secrets/firebasepushnotification.json'),
  path.join(__dirname, '../../../../keys-set/f2hfresh-65beb-firebase-adminsdk-fbsvc-732ac6da2d.json'),
];

/** Fields the Admin SDK's `credential.cert()` refuses to work without. */
const REQUIRED_FIELDS = ['type', 'project_id', 'private_key', 'client_email'] as const;

function resolveKeyFile(): string {
  const explicit = process.argv
    .find((arg) => arg.startsWith('--file='))
    ?.split('=')
    .slice(1)
    .join('=');

  const candidates = explicit ? [explicit] : DEFAULT_KEY_PATHS;
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Firebase service-account file found. Looked at:\n  ${candidates.join('\n  ')}`,
    );
  }
  return found;
}

function readServiceAccount(file: string): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = REQUIRED_FIELDS.filter((field) => !parsed[field]);
  if (missing.length > 0) {
    throw new Error(`${file} is not a service account — missing ${missing.join(', ')}`);
  }
  if (parsed.type !== 'service_account') {
    throw new Error(`${file} has type "${parsed.type}", expected "service_account"`);
  }
  return parsed;
}

async function main() {
  const apply = process.argv.includes('--yes');
  const file = resolveKeyFile();
  const serviceAccount = readServiceAccount(file);

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
        `  [${apply ? 'APPLYING' : 'DRY RUN — pass --yes to write'}]`,
    );
    console.log(`key file: ${file}`);
    console.log(`project:  ${serviceAccount.project_id}`);
    console.log(`identity: ${serviceAccount.client_email}`);

    if (!apply) {
      console.log('Nothing written.');
      return;
    }

    await pool.query(
      `INSERT INTO public.api_integrations_config
           (category, config_key, name, provider, is_active, config_data)
       VALUES ('firebase', 'admin', 'Firebase Admin SDK', 'google', true, $1::jsonb)
       ON CONFLICT (category, config_key) DO UPDATE
       SET name        = EXCLUDED.name,
           provider    = EXCLUDED.provider,
           is_active   = true,
           -- Replaced wholesale, not merged: a rotated key must not inherit the
           -- previous key's private_key_id or private_key.
           config_data = EXCLUDED.config_data,
           updated_at  = CURRENT_TIMESTAMP`,
      [JSON.stringify(serviceAccount)],
    );

    console.log(`Stored firebase:admin for project ${serviceAccount.project_id}.`);
    console.log('Restart the API so PushNotificationService picks it up.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
