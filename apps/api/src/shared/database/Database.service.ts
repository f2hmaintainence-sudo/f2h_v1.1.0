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
  ) {}

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
    await this.createRequiredTables();
  }

  private static isTablesCreated = false;

  private async createRequiredTables() {
    if (DatabaseService.isTablesCreated) return;
    DatabaseService.isTablesCreated = true;
    try {
      this.logger.log('Ensuring dispatch_requirements and dispatch_balances tables exist...');
      
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS dispatch_requirements (
            id BIGSERIAL PRIMARY KEY,
            run_id VARCHAR(30) NOT NULL REFERENCES delivery_runs(run_id) ON DELETE CASCADE,
            run_date DATE NOT NULL,
            delivery_slot VARCHAR(30) NOT NULL,
            delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_partners(delivery_partner_id) ON DELETE CASCADE,
            product_variant_id VARCHAR(30) NOT NULL,
            required_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
            unit VARCHAR(20) DEFAULT 'pcs',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(run_id, product_variant_id)
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_date ON dispatch_requirements(run_date);
      `);
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_run ON dispatch_requirements(run_id);
      `);
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_boy ON dispatch_requirements(delivery_partner_id);
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS dispatch_balances (
            id BIGSERIAL PRIMARY KEY,
            delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_partners(delivery_partner_id) ON DELETE CASCADE,
            product_variant_id VARCHAR(30) NOT NULL,
            run_date DATE NOT NULL,
            delivery_slot VARCHAR(30) NOT NULL,
            dispatched_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
            delivered_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
            returned_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
            damaged_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
            balance_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(delivery_partner_id, product_variant_id, run_date, delivery_slot)
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_dispatch_balances_boy_date ON dispatch_balances(delivery_partner_id, run_date);
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS management_staff (
            id BIGSERIAL PRIMARY KEY,
            management_id VARCHAR(30) UNIQUE,
            user_id VARCHAR(30) NOT NULL,
            branch_id VARCHAR(30),
            role_id VARCHAR(30) DEFAULT 'ADMIN',
            user_name VARCHAR(50),
            department VARCHAR(100),
            designation VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            bio TEXT,
            gender VARCHAR(20),
            date_of_birth DATE,
            marital_status VARCHAR(30),
            phone VARCHAR(20),
            alt_phone VARCHAR(20),
            address_line1 VARCHAR(100),
            address_line2 VARCHAR(100),
            city VARCHAR(50),
            state VARCHAR(50),
            postal_code VARCHAR(20),
            education VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mgmt_staff_user ON management_staff(user_id);
      `);

      await this.pool.query(`
        ALTER TABLE product_banner ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE product_banner ADD COLUMN IF NOT EXISTS background_color VARCHAR(50);
        ALTER TABLE product_banner ALTER COLUMN created_by TYPE VARCHAR(50) USING created_by::text;
        ALTER TABLE product_banner ALTER COLUMN updated_by TYPE VARCHAR(50) USING updated_by::text;
        
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(150);
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR(20);
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
        ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS residential_address TEXT;
      `);

      this.logger.log('dispatch_requirements, dispatch_balances, and delivery_partners profile columns verified.');
    } catch (err) {
      this.logger.error('Failed to create required tables dispatch_requirements or dispatch_balances', err);
    }
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
      this.logger.error('Query failed', {
        sql: normalizedSql.substring(0, 200),
        params,
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
