import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../shared/database/Database.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  try {
    const hashedAdmin369 = await bcrypt.hash('Admin@369', 10);

    // Upsert admin.panel@f2hfresh.com
    await db.query(
      `INSERT INTO users (id, sno, user_id, email, user_name, password, first_name, last_name, role_id, account_status, created_at, updated_at)
       VALUES (1, 1001, 'USRADMIN001', 'admin.panel@f2hfresh.com', 'admin', $1, 'Admin', 'User', 'ADMIN', 'active', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password = $1, role_id = 'ADMIN', account_status = 'active';`,
      [hashedAdmin369]
    );

    // Upsert f2hmaintainence@gmail.com
    await db.query(
      `INSERT INTO users (id, sno, user_id, email, user_name, password, first_name, last_name, role_id, account_status, created_at, updated_at)
       VALUES (2, 1002, 'USRADMIN002', 'f2hmaintainence@gmail.com', 'f2hmaintenance', $1, 'Maintenance', 'Admin', 'ADMIN', 'active', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password = $1, role_id = 'ADMIN', account_status = 'active';`,
      [hashedAdmin369]
    );

    console.log('SUCCESSFULLY_UPDATED_ADMIN_CREDENTIALS');
  } catch (e) {
    console.error('Error running admin seed:', e);
  } finally {
    await app.close();
  }
}

bootstrap();
