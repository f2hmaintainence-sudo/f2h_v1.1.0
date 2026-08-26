import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, types } from 'pg';

// Set DATE (OID 1082) parser to return raw string (YYYY-MM-DD) instead of local Date object conversion
types.setTypeParser(1082, (val) => val);
import { DeveloperService } from '../logger/Developer.service';

type QueryParams = any[];

interface SharedConnection {
  query<T = any>(sql: string, params?: QueryParams): Promise<[T[]]>;
  execute<T = any>(sql: string, params?: QueryParams): Promise<[T[]]>;
  release(): void;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;
  private connectionTarget!: {
    host: string;
    port: number;
    runtime: 'docker' | 'local';
  };

  constructor(
    private readonly config: ConfigService,
    private readonly developer: DeveloperService,
  ) { }

  async onModuleInit() {
    const password = this.resolveDbPassword();
    this.connectionTarget = this.resolveConnectionTarget();

    this.logger.log(
      `Initializing DB pool via PgBouncer at ${this.connectionTarget.host}:${this.connectionTarget.port} (${this.connectionTarget.runtime}) user=${this.config.get<string>('DB_USERNAME')} db=${this.config.get<string>('DB_DATABASE')}`,
    );

    this.pool = new Pool({
      host: this.connectionTarget.host,
      port: this.connectionTarget.port,
      database: this.config.get<string>('DB_DATABASE'),
      user: this.config.get<string>('DB_USERNAME'),
      password,
      max: this.config.get<number>('DB_POOL_SIZE', 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: this.config.get<string>(
        'DB_APPLICATION_NAME',
        'backend-api',
      ),
    });

    this.pool.on('error', (err: Error) => {
      this.logger.warn(`Unexpected idle client error in pg pool: ${err.message}`);
    });

    await this.verifyConnectionWithRetry();
    await this.assertRequiredTablesExist();
  }

  /**
   * Tables this process cannot function without. They used to be CREATEd here at
   * boot, guarded only by a per-process static flag — which meant every instance
   * raced on startup, the runtime DB role needed CREATE privileges in production,
   * and (because of IF NOT EXISTS) any later change to their shape silently never
   * applied. Their definitions now live in
   * `src/panels/admin/migrations/007_dispatch_tables_and_management_staff.sql`.
   *
   * Verification is safe; mutation is not. Booting against a database that has not
   * been migrated fails loudly instead of quietly repairing itself.
   */
  private static readonly REQUIRED_TABLES = [
    'delivery_dispatch',
    'delivery_dispatch_items',
    'management_staff',
  ];

  private async assertRequiredTablesExist() {
    const { rows } = await this.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1)`,
      [DatabaseService.REQUIRED_TABLES],
    );

    const present = new Set(rows.map((row) => row.table_name));
    const missing = DatabaseService.REQUIRED_TABLES.filter(
      (table) => !present.has(table),
    );

    if (missing.length) {
      this.logger.error(`Missing required database tables: ${missing.join(', ')}`);
      throw new Error(`Database tables missing: ${missing.join(', ')}`);
    }

    try {
      await this.pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS stock_balances_warehouse_variant_unique 
        ON stock_balances (warehouse_id, product_variant_id);

        ALTER TABLE public.delivery_partner_referral_bonuses 
          ADD COLUMN IF NOT EXISTS paid_by VARCHAR(50),
          ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
          ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2);

        UPDATE public.delivery_dispatch 
          SET status = 'in_progress', updated_at = NOW() 
          WHERE status = 'return_pending' 
            AND delivery_run_id IN (SELECT run_id FROM public.delivery_runs WHERE status != 'handed_over');

        UPDATE public.delivery_runs 
          SET status = 'in_progress', updated_at = NOW() 
          WHERE status = 'completed' AND run_date = CURRENT_DATE;
      `);
    } catch (_) { }
  }

  private resolveConnectionTarget(): {
    host: string;
    port: number;
    runtime: 'docker' | 'local';
  } {
    const runtime = this.resolveRuntime();
    const explicitHost = this.config.get<string>('DB_HOST');
    const explicitPort = this.config.get<number>('DB_PORT');

    if (explicitHost && explicitPort) {
      return {
        host: explicitHost,
        port: explicitPort,
        runtime,
      };
    }

    if (runtime === 'docker') {
      return {
        host:
          explicitHost ||
          this.config.get<string>('DB_HOST_DOCKER', 'pgbouncer'),
        port: explicitPort || this.config.get<number>('DB_PORT_DOCKER', 6432),
        runtime,
      };
    }

    return {
      host:
        explicitHost || this.config.get<string>('DB_HOST_LOCAL', '127.0.0.1'),
      port: explicitPort || this.config.get<number>('DB_PORT_LOCAL', 6432),
      runtime,
    };
  }

  private resolveRuntime(): 'docker' | 'local' {
    const configuredRuntime = this.config.get<'auto' | 'docker' | 'local'>(
      'DB_RUNTIME',
      'auto',
    );

    if (configuredRuntime === 'docker' || configuredRuntime === 'local') {
      return configuredRuntime;
    }

    return existsSync('/.dockerenv') ? 'docker' : 'local';
  }

  private resolveDbPassword(): string | undefined {
    const passwordFile = this.config.get<string>('DB_PASSWORD_FILE');
    if (passwordFile && existsSync(passwordFile)) {
      return readFileSync(passwordFile, 'utf8').trim();
    }

    const inlinePassword = this.config.get<string>('DB_PASSWORD');
    if (inlinePassword) {
      return inlinePassword;
    }

    return undefined;
  }

  private ensurePool() {
    if (!this.pool) throw new Error('Database pool not initialized');
  }

  private normalizeSql(sql: string): string {
    let index = 0;

    return sql.replace(/`([^`]+)`/g, '"$1"').replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
  }

  async query<T = any>(sql: string, params: QueryParams = []): Promise<T[]> {
    this.ensurePool();

    const start = Date.now();
    const normalizedSql = this.normalizeSql(sql);

    try {
      const result: QueryResult = await this.pool.query(normalizedSql, params);
      const duration = Date.now() - start;

      if (duration > 2000) {
        this.logger.warn({
          message: 'Slow query detected',
          duration,
          sql: normalizedSql.substring(0, 200),
        });
      }

      return result.rows as T[];
    } catch (error) {
      // `params` are the actual bound row values — password hashes, encrypted PII,
      // wallet amounts. The statement text is enough to locate the failure.
      this.logger.error('Query failed', {
        sql: normalizedSql.substring(0, 200),
        errorCode: (error as { code?: string })?.code,
      });
      throw error;
    }
  }

  async execute<T = any>(sql: string, params: QueryParams = []): Promise<T[]> {
    return this.query<T>(sql, params);
  }

  async getClient(): Promise<PoolClient> {
    this.ensurePool();
    return this.pool.connect();
  }

  async getConnection(): Promise<SharedConnection> {
    const client = await this.getClient();

    return {
      query: async <T = any>(sql: string, params: QueryParams = []) => {
        const rows = await this.runOnClient<T>(client, sql, params);
        return [rows];
      },
      execute: async <T = any>(sql: string, params: QueryParams = []) => {
        const rows = await this.runOnClient<T>(client, sql, params);
        return [rows];
      },
      release: () => client.release(),
    };
  }

  private async runOnClient<T = any>(
    client: PoolClient,
    sql: string,
    params: QueryParams = [],
  ): Promise<T[]> {
    const normalizedSql = this.normalizeSql(sql);
    const result = await client.query(normalizedSql, params);
    return result.rows as T[];
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async verifyConnectionWithRetry(retries = 5, delayMs = 3000) {
    for (let i = 1; i <= retries; i++) {
      try {
        await this.pool.query('SELECT 1');
        this.logger.log(
          `PostgreSQL connected through PgBouncer at ${this.connectionTarget.host}:${this.connectionTarget.port}`,
        );
        return;
      } catch (err) {
        this.logger.warn(
          `DB retry ${i}/${retries} -> ${this.connectionTarget.host}:${this.connectionTarget.port}`,
        );
        if (i === retries) {
          this.logger.error('DB connection failed', err);
          throw err;
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    if (!this.pool) return;

    this.logger.log('Closing DB pool...');

    await Promise.race([
      this.pool.end(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB shutdown timeout')), 5000),
      ),
    ]);

    this.logger.log('DB pool closed');
  }

  getPoolStats() {
    if (!this.pool) {
      return { error: 'Pool not initialized' };
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}
