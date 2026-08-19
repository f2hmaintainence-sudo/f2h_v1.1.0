import { INestApplication } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';

/**
 * Refuses to let a suite touch anything but its own database.
 *
 * Belt and braces alongside `setup-env.ts`: the environment plumbing here has more
 * than one way to point at production (`DATABASE_URL` in `.env`, and
 * `ConfigModule`'s cached copy of the env file), so the suite asks the connection
 * itself which database it reached and aborts before seeding if the answer is
 * anything other than the expected test database.
 */
export async function assertConnectedToTestDatabase(
  app: INestApplication,
  expected: string,
): Promise<DatabaseService> {
  const db = app.get(DatabaseService);
  const [row] = await db.query<{ db: string }>('SELECT current_database() AS db');

  if (row?.db !== expected) {
    await app.close();
    throw new Error(
      `Refusing to run: connected to "${row?.db}" but expected the test database ` +
        `"${expected}". Set TEST_DB_DATABASE and check DATABASE_URL in .env.`,
    );
  }

  return db;
}
