import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

function getNextMigrationNumber(): number {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return 1;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  let maxNum = 0;

  for (const file of files) {
    const match = file.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  return maxNum + 1;
}

function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run db:create-migration <migration-name>');
    console.error('Example: npm run db:create-migration add-alternate-phone-to-users');
    process.exit(1);
  }

  const rawName = args.join(' ');
  const cleanName = sanitizeName(rawName);
  if (!cleanName) {
    console.error('Error: Migration name must contain alphanumeric characters.');
    process.exit(1);
  }

  const nextNum = getNextMigrationNumber();
  const paddedNum = String(nextNum).padStart(3, '0');
  const filename = `${paddedNum}-${cleanName}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- ============================================================================
-- Migration   : ${filename}
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : ${new Date().toISOString()}
--
-- GUIDELINES FOR SAFE DATABASE VERSION CONTROLLING:
-- 1. BACKWARD COMPATIBILITY: Existing production user data must remain valid.
-- 2. EXPAND-AND-CONTRACT:
--    - When ADDING fields: Column MUST be NULLABLE or have a sensible DEFAULT.
--    - When RENAMING fields: Add new column, backfill data, deprecate old.
--    - When DELETING fields: DO NOT drop immediately; mark deprecated first.
-- 3. IDEMPOTENCY: Use 'IF NOT EXISTS' / 'IF EXISTS' wherever possible.
-- ============================================================================

BEGIN;

-- 1. Schema Changes (Expand)
-- Example:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(20) DEFAULT NULL;

-- 2. Data Migration / Backfill (if transforming existing user data)
-- Example:
-- UPDATE users SET secondary_phone = phone WHERE secondary_phone IS NULL;

-- 3. Constraints & Indexes
-- Example:
-- CREATE INDEX IF NOT EXISTS idx_users_secondary_phone ON users(secondary_phone);

COMMIT;
`;

  fs.writeFileSync(filePath, template, 'utf8');
  console.log(`\x1b[32m✓ Created new migration:\x1b[0m ${filename}`);
  console.log(`\x1b[36m  Path:\x1b[0m ${filePath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit SQL statements in: apps/api/migrations/${filename}`);
  console.log(`  2. Test dry-run:          npm run db:migrate`);
  console.log(`  3. Apply to dev:          npm run db:migrate:apply\n`);
}

main();
