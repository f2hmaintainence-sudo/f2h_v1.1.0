/**
 * Runs before any test module is imported (jest `setupFiles`).
 *
 * This has to happen here, not in a `beforeAll`. `app.module.ts` calls
 * `ConfigModule.forRoot({ cache: true })` at import time, which reads `.env` and
 * freezes the result — so setting `DB_DATABASE` inside `beforeAll` is already too
 * late and the app connects to whatever `.env` names. That is how an earlier run of
 * this suite seeded fixtures into the production database.
 */
const testDatabase = process.env.TEST_DB_DATABASE;

if (testDatabase) {
  process.env.DB_DATABASE = testDatabase;
  // `.env` also carries a DATABASE_URL pointing at the live database, and anything
  // that prefers it would bypass DB_DATABASE entirely.
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_CRON = 'false';
}
