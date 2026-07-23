import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../shared/database/Database.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  try {
    const hashed = await bcrypt.hash('admin123', 10);
    console.log('Hashed admin123:', hashed);

    // Get all users
    const users = await db.query('SELECT user_id, email, user_name FROM users');
    console.log('Users currently in database:', users);

    // Upsert admin.panel@f2hfresh.com
    await db.query(
      `INSERT INTO users (id, sno, user_id, email, user_name, password, first_name, last_name, account_status, created_at, updated_at)
       VALUES (1, 1001, 'USRADMIN001', 'admin.panel@f2hfresh.com', 'admin', $1, 'Admin', 'User', 'active', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password = $1, account_status = 'active';`,
      [hashed]
    );

    await db.query(
      `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
       VALUES ($1, 'USRADMIN001', 'ADMIN', 1, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [Date.now()]
    );

    // Upsert f2hmaintainence@gmail.com
    await db.query(
      `INSERT INTO users (id, sno, user_id, email, user_name, password, first_name, last_name, account_status, created_at, updated_at)
       VALUES (2, 1002, 'USRADMIN002', 'f2hmaintainence@gmail.com', 'f2hmaintenance', $1, 'Maintenance', 'Admin', 'active', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password = $1, account_status = 'active';`,
      [hashed]
    );

    await db.query(
      `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
       VALUES ($1, 'USRADMIN002', 'ADMIN', 1, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [Date.now() + 1]
    );

    console.log('SUCCESSFULLY_UPDATED_ADMIN_CREDENTIALS');
  } catch (e) {
    console.error('Error running admin seed:', e);
  } finally {
    await app.close();
  }
}

bootstrap();
