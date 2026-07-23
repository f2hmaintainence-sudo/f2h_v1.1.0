import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';

types.setTypeParser(1082, (val) => val);

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    // Use individual env vars (same as the main DatabaseService)
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const database = this.configService.get<string>('DB_DATABASE', 'f2h_fresh');
    const user = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', 'doordieok');

    this.pool = new Pool({
      host,
      user,
      password,
      port,
      database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.logger.log('Database pool initialized (PostgreSQL)');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Convert mysql2-style `?` placeholders to pg-style `$1, $2, ...`
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });
    const finalSql = pgSql.replace(/`([^`]+)`/g, '"$1"');

    const result = await this.pool.query(finalSql, params);
    return result.rows as T[];
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    // Convert mysql2-style `?` placeholders to pg-style `$1, $2, ...`
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });
    const finalSql = pgSql.replace(/`([^`]+)`/g, '"$1"');

    const result = await this.pool.query(finalSql, params);
    return result;
  }
}
