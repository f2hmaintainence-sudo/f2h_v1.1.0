/**
 * QA harness — drives the admin profile read/write round-trip against the live
 * database, the same calls PUT/GET /admin/profile/me make.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/qa-admin-profile-verify.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { ProfileService } from 'src/panels/admin/profile/profile.service';
import { RedisModule } from 'src/shared/redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot(), RedisModule],
  providers: [DatabaseService, DeveloperService, ProfileService],
})
class QaModule {}

const USER = process.argv[2] || 'F2HAGD0ZO';

const STAFF_FIELDS = [
  'gender', 'date_of_birth', 'marital_status', 'bio', 'department', 'designation',
  'education', 'address_line1', 'address_line2', 'city', 'state', 'postal_code',
  'alt_phone', 'branch_id',
];

async function main() {
  const app = await NestFactory.createApplicationContext(QaModule, { logger: ['error'] });
  const profile = app.get(ProfileService);
  const db = app.get(DatabaseService);
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)) as any[];

  const snapshot = async () =>
    (await q(
      `SELECT gender, date_of_birth::text, marital_status, bio, department, designation,
              education, address_line1, address_line2, city, state, postal_code, alt_phone, branch_id
       FROM management_staff WHERE user_id = $1`,
      [USER],
    ))[0];

  console.log('═'.repeat(74));
  console.log(`ADMIN PROFILE ROUND-TRIP — ${USER}`);
  console.log('═'.repeat(74));

  const before = await snapshot();
  console.log('\nDB before:', JSON.stringify(before));

  // ── 1. Does the read return the staff fields the edit form seeds from? ──────
  const read: any = await profile.getMyProfile(USER);
  const returned = STAFF_FIELDS.filter((f) => read?.data?.[f] !== undefined);
  const missing = STAFF_FIELDS.filter((f) => read?.data?.[f] === undefined);
  console.log(`\n[1] GET /admin/profile/me returns ${returned.length}/${STAFF_FIELDS.length} staff fields`);
  if (missing.length) console.log(`    MISSING: ${missing.join(', ')}`);
  else console.log('    all present — the edit form can seed real values');

  // ── 2. Write one field; everything else must survive ───────────────────────
  const marker = `QA-${Date.now().toString(36)}`;
  console.log(`\n[2] PUT /admin/profile/me with ONLY { department: "${marker}" }`);
  await profile.updateMyProfile(USER, { department: marker });
  const afterPartial = await snapshot();
  console.log('    DB after :', JSON.stringify(afterPartial));

  const clobbered = STAFF_FIELDS.filter(
    (f) => f !== 'department' && JSON.stringify(before?.[f]) !== JSON.stringify(afterPartial?.[f]),
  );
  console.log(
    afterPartial?.department === marker
      ? '    department written: YES'
      : '    department written: NO  <-- FAIL',
  );
  console.log(
    clobbered.length === 0
      ? '    other fields preserved: YES'
      : `    other fields CLOBBERED: ${clobbered.join(', ')}  <-- FAIL`,
  );

  // ── 3. Does the value survive a re-read? (what the UI does after saving) ────
  const reread: any = await profile.getMyProfile(USER);
  console.log(
    `\n[3] re-read department = ${JSON.stringify(reread?.data?.department)}` +
      (reread?.data?.department === marker
        ? '  — the UI will now show the saved value'
        : '  <-- FAIL, UI would still look unchanged'),
  );

  // ── 4. An explicit empty string must still clear a field ───────────────────
  await profile.updateMyProfile(USER, { department: '' });
  const cleared = await snapshot();
  console.log(
    `\n[4] explicit "" clears the field: ${cleared?.department === '' ? 'YES' : `NO (got ${JSON.stringify(cleared?.department)})`}`,
  );

  // ── restore ────────────────────────────────────────────────────────────────
  await q(`UPDATE management_staff SET department = $2 WHERE user_id = $1`, [
    USER,
    before?.department ?? '',
  ]);
  console.log(`\nrestored department to ${JSON.stringify(before?.department ?? '')}`);
  console.log('═'.repeat(74));

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS FAILURE', e);
  process.exit(1);
});
