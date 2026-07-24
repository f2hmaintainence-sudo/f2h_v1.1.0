import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from './Database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
// mysql2 types replaced by pg-compatible wrapper types
type PoolConnection = any;
type ResultSetHeader = { insertId: number; affectedRows: number };
import * as crypto from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { DeveloperService } from '../logger/Developer.service';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';
export const CACHE_TTL = 86_400;
export const ENCRYPTION_METHOD = 'aes-256-cbc';
export const MARKER = '~@';
export const FIXED_IV = Buffer.alloc(16, 0);
export const SALT_LENGTH = 16;
export const MAX_PARALLEL_JOBS = 100;
export const WORKER_THRESHOLD = 3;
export const CHUNK_SIZE = 1000;
export const BULK_CHUNK_SIZE = 500;
export const AVOID_DELETED_AT = [
  'user_documents',
  'user_vehicles',
  'zones',
  'zone_hexagons',
  'branch_zone_hexes',
  'branch_sectors',
  'branches',
  'permissions',
  'permission_for_roles',
  'permission_for_users',
  'user_devices',
  'delivery_partners',
  'orders',
  'order_items',
  'order_schedule',
  'password_history',
  'sessions',
  'otp_rate_limit_logs',
  'central_settings',
  'category_units',
  'cache',
  'cache_locks',
  'migrations',
  'jobs',
  'failed_jobs',
  'download_logs',
  'vendor',
  'subscriptions',
  'subscription_items',
  'subscription_weekly_schedules',
  'subscription_custom_schedule',
  'subscription_overrides',
  'subscription_pauses',
  'subscription_daily_snapshots',
  'subscription_billing_lines',
  'subscription_logs',
  'customers',
  'customer_addresses',
  'customer_wallet_transactions',
  'container_transactions',
  'delivery_container_lines',
  'customer_container_balances',
  'customer_feedback',
  'packaging_types',
  'product_images',
];
export const AVOID_DATACHANGE_TABLES = [
  'notifications',
  'notification_recipients',
];

// write-operation.types.ts

export enum WriteOperationType {
  INSERT = 'insert',
  UPDATE = 'update',
  UPSERT = 'upsert',
  DELETE = 'delete',
  SOFT_DELETE = 'softDelete',
}

export interface UpsertParams {
  data?: Record<string, any>;
  update?: Record<string, any>;
  conflict?: Record<string, any>;
}

export interface WriteOperationParams {
  insert?: Record<string, any> | Record<string, any>[];
  update?: Record<string, any>;
  delete?: Record<string, any>;
  softDelete?: Record<string, any>;
  upsert?: UpsertParams;
}

export interface WriteOperationResult {
  op: WriteOperationType;
  type: WriteOperationType;
  key: keyof WriteOperationParams;
  updateData?: Record<string, any>;
}
export interface WhereCondition {
  column: string;
  operator?: string;
  value?: any;
  boolean?: 'AND' | 'OR';
  nested?: WhereCondition[];
}

export type JsonSelectParams = Record<string, string>;
export type WindowFunction =
  | 'ROW_NUMBER'
  | 'RANK'
  | 'DENSE_RANK'
  | 'SUM'
  | 'COUNT'
  | 'AVG'
  | 'MIN'
  | 'MAX';

export interface WindowOrder {
  col: string;
  dir?: 'ASC' | 'DESC';
}

export interface WindowOptions {
  column?: string;
  partition?: string[];
  order?: WindowOrder[];
}

export type WindowParams = Record<WindowFunction | string, WindowOptions>;

export type FullTextMode = 'NATURAL' | 'BOOLEAN' | 'QUERY_EXPANSION';

export interface FullTextParams {
  columns: string[];
  query: string;
  mode?: FullTextMode;
}

interface QueryResponse<T = any> {
  status: boolean;
  data: T[];
  message: string;
  query: string;
  bindings: any[];
}

interface QualifiedSelectResult {
  columns: string[];
  bindings: any[];
  alias_map: Record<string, string>;
  source_map: Record<string, { table: string; col: string }>;
}

interface JoinConfig {
  table: string;
  type?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' | 'SELF' | 'NATURAL';
  on?: any[];
  where?: any[];
  useIndex?: string;
}

interface JoinOnClause {
  left: string;
  operator: string;
  right: string | number;
}

interface JoinOnBuildResult {
  sql: string;
  bindings: any[];
}

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);
  constructor(
    private readonly Database: DatabaseService,
    private readonly events: EventEmitter2,
    private readonly Developer: DeveloperService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) { }

  private readonly tokenMap: Record<
    string,
    {
      module: string;
      table: string;
      actions: string[];
    }
  > = {
      administration: {
        module: 'administration',
        table: 'administration_users',
        actions: ['create', 'update', 'delete'],
      },
      users: {
        module: 'users',
        table: 'users',
        actions: ['create', 'update', 'delete'],
      },
    };

  resolveToken(token: string) {
    const parts = token.split('_');

    if (parts.length < 2) {
      return null;
    }

    const [key, action] = parts;

    const config = this.tokenMap[key];

    if (!config) {
      return null;
    }
    return {
      key,
      module: config.module,
      table: config.table,
      action,
    };
  }

  /**
   * Get a shared DB connection (caller is responsible for releasing it).
   * Use this when you need to run multiple queries on the same connection
   * to avoid connection pool overhead per query.
   */
  async getSharedConnection(): Promise<any> {
    const conn = await this.Database.getConnection();
    if (!conn) {
      throw new ServiceUnavailableException(
        'Database connection could not be established',
      );
    }
    return conn;
  }

  /**
   * Execute a query using an externally-provided connection (no auto-release).
   * Same logic as query() but skips getConnection/release since caller manages it.
   */
  async queryWithConnection(
    conn: any,
    table: string,
    params: Record<string, any> = {},
    includeDeleted = false,
  ): Promise<any> {
    let sql = '';
    let bindings: any[] = [];

    try {
      const op = this.detectWriteOperation(params);
      const businessId = 'central';
      const hasGroupBy =
        Array.isArray(params.groupBy) && params.groupBy.length > 0;
      const hasHaving =
        typeof params.having === 'string' && params.having.trim() !== '';
      const hasOrderBy =
        params.orderBy &&
        typeof params.orderBy === 'object' &&
        Object.keys(params.orderBy).length > 0;
      const hasLimit = typeof params.limit === 'number';
      const hasOffset = typeof params.offset === 'number';
      const hasUnion = Array.isArray(params.union) && params.union.length > 0;
      const hasCte = Array.isArray(params.with) && params.with.length > 0;

      if (op) {
        // Encrypt sensitive fields before writing to database
        const writeData = params[op.key] ?? {};
        const encryptedData = Array.isArray(writeData)
          ? writeData.map((row) => this.fieldEncryption.encryptRow(table, row))
          : this.fieldEncryption.encryptRow(table, writeData);
        const encryptedUpdateData = op.updateData
          ? this.fieldEncryption.encryptRow(table, op.updateData)
          : {};

        validateWriteOperation(op, params);
        const result = await handleWriteOperation(
          op.op,
          conn,
          table,
          encryptedData,
          params.where ?? params.upsert?.conflict ?? [],
          businessId,
          encryptedUpdateData,
        );
        return result;
      }

      sql = '';
      bindings = [];
      let usedTables = [table];
      const select = params.select ?? ['*'];
      const isCount = typeof select === 'object' && 'count' in select;

      const baseWhere: any[] = [];
      if (!includeDeleted && !AVOID_DELETED_AT.includes(table)) {
        baseWhere.push({
          column: `${table}.deleted_at`,
          operator: 'IS',
          value: null,
        });
      }

      if (isCount) {
        sql = `SELECT COUNT(*) AS count FROM ${table}`;
      } else {
        const selectResult = await qualifySelect(select, table, conn);
        sql = `SELECT ${selectResult.columns.join(', ')} FROM ${table}`;
        bindings.push(...selectResult.bindings);
      }

      if (params.distinct) {
        sql = sql.replace(/^SELECT/i, 'SELECT DISTINCT');
      }

      if (params.fullText) {
        const ftExpr = FullTextExprBuilder.build(params.fullText, table);
        sql += ` AND ${ftExpr.sql}`;
        bindings.push(...ftExpr.bindings);
      }

      ({ sql, bindings, usedTables } = applyJoins(
        sql,
        params.joins ?? [],
        table,
        usedTables,
        bindings,
      ));

      const finalWhere = [...baseWhere, ...(params.where ?? [])];
      ({ sql, bindings } = applyWhere(sql, finalWhere, table, bindings));
      ({ sql, bindings } = applySubqueryWhere(
        sql,
        params.subquery ?? null,
        table,
        bindings,
      ));

      if (hasGroupBy) {
        ({ sql, bindings } = applyGroupBy(
          sql,
          params.groupBy,
          table,
          bindings,
        ));
      }
      if (hasGroupBy && hasHaving) {
        ({ sql, bindings } = applyHaving(sql, params.having, table, bindings));
      }
      ({ sql, bindings } = applyOrderBy(
        sql,
        hasOrderBy ? params.orderBy : null,
        table,
        bindings,
      ));

      if (hasLimit) {
        ({ sql, bindings } = applyLimitOffset(
          sql,
          params.limit,
          params.offset,
          bindings,
        ));
      }

      if (hasUnion) {
        ({ sql, bindings } = await applyUnion(
          sql,
          params.union,
          conn,
          table,
          businessId,
          usedTables,
          bindings,
        ));
      }

      if (hasCte) {
        ({ sql, bindings } = applyCte(params.with ?? null, sql, bindings));
      }

      if (isCount) {
        const [rows] = await conn.query(sql, bindings);
        const count = rows?.[0]?.count ?? 0;
        return {
          status: true,
          data: [{ count }],
          message: 'Count query executed',
          query: sql,
          bindings,
        };
      }

      const chunkSize = CHUNK_SIZE;
      let rows: any[] = [];

      if (hasLimit && params.limit <= chunkSize) {
        const [result] = await conn.query(sql, bindings);
        rows = result as any[];
      } else {
        let offset = 0;
        while (true) {
          const pagedSql = `${sql} LIMIT ${chunkSize} OFFSET ${offset}`;
          const [chunkRows] = await conn.query(pagedSql, bindings);
          if (!chunkRows.length) break;
          rows.push(...chunkRows);
          offset += chunkSize;
        }
      }

      // Decrypt sensitive fields in returned rows
      const joinedTables = (params.joins ?? [])
        .map((j: any) => j.table)
        .filter(Boolean);
      const decryptedRows =
        joinedTables.length > 0
          ? this.fieldEncryption.decryptJoinedRows(rows, table, ...joinedTables)
          : this.fieldEncryption.decryptRows(table, rows);

      return {
        status: true,
        data: decryptedRows,
        message: 'Dynamic query executed',
      } as QueryResponse;
    } catch (error: any) {
      console.error('[DataService] Database query error!', error);
      this.Developer.error('Database Error (shared conn)', {
        table,
        sql,
        bindings,
        error: error?.message,
      });
      return {
        status: false,
        data: [],
        message: 'Database query failed',
        query: sql,
        bindings: bindings,
      } as unknown as QueryResponse;
    }
    // NOTE: No finally/release â€” caller manages the connection lifecycle
  }

  async query(
    table: string,
    params: Record<string, any> = {},
    includeDeleted = false,
  ): Promise<any> {
    let conn: any;
    const sql = '';
    const bindings: any[] = [];

    try {
      conn = await this.Database.getConnection();
      if (!conn) {
        throw new ServiceUnavailableException(
          'Database connection could not be established',
        );
      }
      const op = this.detectWriteOperation(params);
      const businessId = 'central';
      const hasGroupBy =
        Array.isArray(params.groupBy) && params.groupBy.length > 0;
      const hasHaving =
        typeof params.having === 'string' && params.having.trim() !== '';
      const hasOrderBy =
        params.orderBy &&
        typeof params.orderBy === 'object' &&
        Object.keys(params.orderBy).length > 0;
      const hasLimit = typeof params.limit === 'number';
      const hasOffset = typeof params.offset === 'number';
      const hasUnion = Array.isArray(params.union) && params.union.length > 0;
      const hasCte = Array.isArray(params.with) && params.with.length > 0;
      const hasWindow = params.window && Object.keys(params.window).length > 0;
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // WRITE OPERATION
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (op) {
        // Encrypt sensitive fields before writing to database
        const writeData = params[op.key] ?? {};
        const encryptedData = Array.isArray(writeData)
          ? writeData.map((row) => this.fieldEncryption.encryptRow(table, row))
          : this.fieldEncryption.encryptRow(table, writeData);
        const encryptedUpdateData = op.updateData
          ? this.fieldEncryption.encryptRow(table, op.updateData)
          : {};

        validateWriteOperation(op, params);
        const result = await handleWriteOperation(
          op.op,
          conn,
          table,
          encryptedData,
          params.where ?? params.upsert?.conflict ?? [],
          businessId,
          encryptedUpdateData,
        );
        return result;
      }

      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // READ OPERATION
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let sql = '';
      let bindings: any[] = [];
      let usedTables = [table];
      const select = params.select ?? ['*'];
      const isCount = typeof select === 'object' && 'count' in select;
      // base WHERE conditions (DO NOT WRITE SQL YET)
      const baseWhere: any[] = [];
      if (!includeDeleted && !AVOID_DELETED_AT.includes(table)) {
        baseWhere.push({
          column: `${table}.deleted_at`,
          operator: 'IS',
          value: null,
        });
      }

      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // SELECT + FROM
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (isCount) {
        sql = `SELECT COUNT(*) AS count FROM ${table}`;
      } else {
        const selectResult = await qualifySelect(select, table, conn);
        sql = `
        SELECT ${selectResult.columns.join(', ')}
        FROM ${table}
      `;
        bindings.push(...selectResult.bindings);
      }
      // DISTINCT
      if (params.distinct) {
        sql = sql.replace(/^SELECT/i, 'SELECT DISTINCT');
      }
      // window expressions
      // if (params.window && Object.keys(params.window).length > 0) {
      //   selectColumns.push(
      //     WindowExprBuilder.build(params.window, table),
      //   );
      // }
      if (params.fullText) {
        const ftExpr = FullTextExprBuilder.build(params.fullText, table);

        sql += ` AND ${ftExpr.sql}`;
        bindings.push(...ftExpr.bindings);
      }
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // JOINs (MUST COME BEFORE WHERE)
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      ({ sql, bindings, usedTables } = applyJoins(
        sql,
        params.joins ?? [],
        table,
        usedTables,
        bindings,
      ));
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // WHERE (base + user conditions)
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const finalWhere = [...baseWhere, ...(params.where ?? [])];
      // WHERE
      ({ sql, bindings } = applyWhere(sql, finalWhere, table, bindings));
      // RAW SUBQUERY WHERE (optional)
      ({ sql, bindings } = applySubqueryWhere(
        sql,
        params.subquery ?? null,
        table,
        bindings,
      ));
      // GROUP BY (optional)
      if (hasGroupBy) {
        ({ sql, bindings } = applyGroupBy(
          sql,
          params.groupBy,
          table,
          bindings,
        ));
      }
      // HAVING (depends on GROUP BY)
      if (hasGroupBy && hasHaving) {
        ({ sql, bindings } = applyHaving(sql, params.having, table, bindings));
      }
      // ORDER BY (always safe)
      ({ sql, bindings } = applyOrderBy(
        sql,
        hasOrderBy ? params.orderBy : null,
        table,
        bindings,
      ));

      if (hasLimit) {
        ({ sql, bindings } = applyLimitOffset(
          sql,
          params.limit,
          params.offset,
          bindings,
        ));
      }

      if (hasUnion) {
        ({ sql, bindings } = await applyUnion(
          sql,
          params.union,
          conn,
          table,
          businessId,
          usedTables,
          bindings,
        ));
      }

      // UNION already applied here (if any)

      // CTE must wrap the final SQL
      if (hasCte) {
        ({ sql, bindings } = applyCte(params.with ?? null, sql, bindings));
      }

      // if (params.json) {
      //   selectParts.push(
      //     JsonExprBuilder.build(params.json, table),
      //   );
      // }
      if (isCount) {
        const [rows] = await conn.query(sql, bindings);
        const count = rows?.[0]?.count ?? 0;

        return {
          status: true,
          data: [{ count }],
          message: 'Count query executed',
          query: sql,
          bindings,
        };
      }
      async function executeInChunks(
        conn: any,
        baseSql: string,
        bindings: any[],
        chunkSize: number,
      ): Promise<any[]> {
        let offset = 0;
        const allRows: any[] = [];

        while (true) {
          const pagedSql = `${baseSql} LIMIT ${chunkSize} OFFSET ${offset}`;
          const [rows] = await conn.query(pagedSql, bindings);

          if (!rows.length) break;

          allRows.push(...rows);
          offset += chunkSize;
        }

        return allRows;
      }

      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // EXECUTION + RESULT HANDLING
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const chunkSize = CHUNK_SIZE;

      let rows: any[] = [];

      if (hasLimit && params.limit <= chunkSize) {
        // Small result set â†’ single query
        const [result] = await conn.query(sql, bindings);
        rows = result as any[];
      } else {
        // Large result set â†’ chunked execution
        rows = await executeInChunks(conn, sql, bindings, chunkSize);
      }

      // this.logger.debug('SQL query executed', {
      //   sql,
      //   bindings,
      //   rowCount: rows.length,
      // });

      // Decrypt sensitive fields in returned rows
      const joinedTables = (params.joins ?? [])
        .map((j: any) => j.table)
        .filter(Boolean);
      const decryptedRows =
        joinedTables.length > 0
          ? this.fieldEncryption.decryptJoinedRows(rows, table, ...joinedTables)
          : this.fieldEncryption.decryptRows(table, rows);

      return {
        status: true,
        data: decryptedRows,
        message: 'Dynamic query executed',
        // query: `${sql} --- ${bindings.join(', ')}`,
        // bindings,
      } as QueryResponse;
    } catch (error: any) {
      this.Developer.error('Database Error', {
        table,
        sql,
        bindings,
        error: error?.message,
      });
      return {
        status: false,
        data: [],
        message: error?.message ?? 'Unexpected dynamic error',
        query: sql,
        bindings,
      };
    } finally {
      conn?.release?.();
    }
  }
  // 1. ADD this new method after the query() method (around line 716)
  async executeTransaction<T>(
    work: (transaction: any) => Promise<T>
  ): Promise<T> {
    const connection = await this.getSharedConnection();
    try {
      await connection.query('SET statement_timeout = 10000'); // Safety timeout
      await connection.query('BEGIN');

      const result = await work(connection);

      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      this.Developer.error('Transaction Error', { message: error.message });
      throw error;
    } finally {
      connection.release();
    }
  }

  // 2. REPLACE your existing insert, update, upsert, delete with these:

  async insert(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    if (options.transaction) {
      return this.queryWithConnection(options.transaction, table, { insert: data }, options.includeDeleted);
    }
    return this.query(table, { insert: data }, options.includeDeleted);
  }

  async update(
    table: string,
    data: Record<string, any>,
    where: any[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    if (options.transaction) {
      return this.queryWithConnection(options.transaction, table, { update: data, where }, options.includeDeleted);
    }
    return this.query(table, { update: data, where }, options.includeDeleted);
  }

  async upsert(
    table: string,
    data: Record<string, any>,
    conflict: Record<string, any>,
    update: Record<string, any>,
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    const params = { upsert: { data, conflict, update } };
    if (options.transaction) {
      return this.queryWithConnection(options.transaction, table, params, options.includeDeleted);
    }
    return this.query(table, params, options.includeDeleted);
  }

  async delete(
    table: string,
    where: any[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    const params = { delete: true, where };
    if (options.transaction) {
      return this.queryWithConnection(options.transaction, table, params, options.includeDeleted);
    }
    return this.query(table, params, options.includeDeleted);
  }

  async softDelete(
    table: string,
    where: any[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    const params = { softDelete: true, where };
    if (options.transaction) {
      return this.queryWithConnection(options.transaction, table, params, options.includeDeleted);
    }
    return this.query(table, params, options.includeDeleted);
  }

  async permanentDelete(
    table: string,
    where: any[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    // permanentDelete is just an alias for the new delete method
    return this.delete(table, where, options);
  }

  async edit(
    table: string,
    data: Record<string, any>,
    where: any[],
    options: { transaction?: any; includeDeleted?: boolean } = {}
  ): Promise<any> {
    // edit is just an alias for the new update method
    return this.update(table, data, where, options);
  }


  // async insert(
  //   table: string,
  //   data: Record<string, any> | Record<string, any>[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.query(
  //     table,
  //     { insert: data },
  //     includeDeleted,
  //   );
  // }

  // async update(
  //   table: string,
  //   data: Record<string, any>,
  //   where: any[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.query(
  //     table,
  //     { update: data, where },
  //     includeDeleted,
  //   );
  // }


  // async upsert(
  //   table: string,
  //   data: Record<string, any>,
  //   conflict: Record<string, any>,
  //   update: Record<string, any>,
  //   async = false, 
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.query(
  //     table,
  //     {
  //       upsert: {
  //         data,
  //         conflict,
  //         update,
  //       },
  //     },
  //     includeDeleted,
  //   );
  // }

  // async delete(
  //   table: string,
  //   where: any[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.query(
  //     table,
  //     {
  //       delete: true,
  //       where,
  //     },
  //     includeDeleted,
  //   );
  // }

  // async softDelete(
  //   table: string,
  //   where: any[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.query(
  //     table,
  //     {
  //       softDelete: true,
  //       where
  //     },
  //     includeDeleted,
  //   );
  // }

  // async permanentDelete(
  //   table: string,
  //   where: any[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.delete(
  //     table,
  //     where,
  //     async,
  //     includeDeleted,
  //   );
  // }


  // async edit(
  //   table: string,
  //   data: Record<string, any>,
  //   where: any[],
  //   async = false,
  //   includeDeleted = false,
  // ): Promise<any> {
  //   return this.update(
  //     table,
  //     data,
  //     where,
  //     async,
  //     includeDeleted,
  //   );
  // }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // WriteOperationDetector
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private detectWriteOperation(
    params: Record<string, any> = {},
  ): WriteOperationResult | null {
    const writeKeys: (keyof typeof WriteOperationType | string)[] = [
      'insert',
      'update',
      'upsert',
      'delete',
      'softDelete',
    ];
    const providedOps = writeKeys.filter((key) => params[key] !== undefined);
    if (providedOps.length > 1) {
      this.Developer.error('MULTIPLE_WRITE_OPERATIONS_DETECTED', {
        providedOps,
        paramsKeys: Object.keys(params),
      });
      throw new BadRequestException(
        `Multiple write operations detected: ${providedOps.join(', ')}. Only one is allowed per request.`,
      );
    }
    if (providedOps.length === 0) {
      return null;
    }
    const key = providedOps[0];
    switch (key) {
      case 'insert':
        return {
          op: WriteOperationType.INSERT,
          type: WriteOperationType.INSERT,
          key,
        };

      case 'update':
        return {
          op: WriteOperationType.UPDATE,
          type: WriteOperationType.UPDATE,
          key,
        };

      case 'upsert':
        const { update, data } = params.upsert ?? {};
        // this.Developer.error('MULTIPLE_WRITE_OPERATIONS_DETECTED', {
        //   providedOps,
        //   paramsKeys: Object.keys(params),
        // });
        return {
          op: WriteOperationType.UPSERT,
          type: WriteOperationType.UPSERT,
          key,
          updateData: update ?? data ?? {},
        };
      case 'delete':
        return {
          op: WriteOperationType.DELETE,
          type: WriteOperationType.DELETE,
          key,
        };
      case 'softDelete':
        return {
          op: WriteOperationType.SOFT_DELETE,
          type: WriteOperationType.SOFT_DELETE,
          key,
        };
    }
    return null;
  }
}

export function validateWriteOperation(
  op: WriteOperationResult,
  params: Record<string, any> = {},
): void {
  const dataKey = op.key;
  const data = (params as any)[dataKey] ?? {};
  const where = (params as any).where ?? params.upsert?.conflict ?? {};

  if (
    ['insert', 'update', 'upsert'].includes(op.op) &&
    Object.keys(data).length === 0
  ) {
    throw new BadRequestException(`Data cannot be empty for ${op.op}`);
  }

  if (
    ['update', 'delete', 'softDelete', 'upsert'].includes(op.op) &&
    Object.keys(where).length === 0
  ) {
    throw new BadRequestException(
      `Where conditions cannot be empty for ${op.op}`,
    );
  }
}

interface WriteResult {
  status: true;
  id?: number | string;
  affected?: number;
  message: string;
}

export async function handleWriteOperation(
  op: 'insert' | 'update' | 'upsert' | 'delete' | 'softDelete',
  conn: PoolConnection,
  table: string,
  data: any,
  where: any[],
  businessId: string,
  updateData: Record<string, any> = {},
): Promise<WriteResult> {
  switch (op) {
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // INSERT (single + bulk)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'insert': {
      const isBulk =
        Array.isArray(data) && data.length > 0 && typeof data[0] === 'object';

      if (isBulk) {
        if (!data.length) {
          throw new BadRequestException('Data cannot be empty for bulk insert');
        }
        const prepared = data.map((row) => prepareData(businessId, row));
        const chunkSize = Number(
          process.env.DB_BULK_CHUNK_SIZE ?? BULK_CHUNK_SIZE,
        );
        let affected = 0;
        for (let i = 0; i < prepared.length; i += chunkSize) {
          const chunk = prepared.slice(i, i + chunkSize);
          const keys = Object.keys(chunk[0]);
          // Build individual value rows: ($1,$2), ($3,$4), ...
          const allValues: any[] = [];
          const rowPlaceholders: string[] = [];
          let paramIdx = 1;
          for (const row of chunk) {
            const placeholders = keys.map(() => `$${paramIdx++}`);
            rowPlaceholders.push(`(${placeholders.join(', ')})`);
            allValues.push(...keys.map((k) => row[k]));
          }
          const sql = `
            INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')})
            VALUES ${rowPlaceholders.join(', ')}
            ON CONFLICT DO NOTHING
          `;
          const [result] = await conn.query(sql, allValues);
          affected += result.affectedRows;
        }

        return {
          status: true,
          affected,
          message: `Bulk insert completed, ${affected} records affected`,
        };
      }
      const prepared = prepareData(businessId, data);
      const keys = Object.keys(prepared);
      const placeholders = keys.map(() => '?').join(', ');

      const sql = `
        INSERT INTO ${table} ("${keys.join('", "')}")
        VALUES (${placeholders})
        RETURNING *
      `;

      const [result] = await conn.query(sql, Object.values(prepared));

      return {
        status: true,
        id:
          result && result.length > 0
            ? (Object.values(result[0])[0] as any)
            : null,
        message: 'Record created',
      };
    }

    case 'update': {
      const prepared = prepareData(businessId, data);
      if (!where || where.length === 0) {
        throw new BadRequestException(
          'Write operations require WHERE condition',
        );
      }
      const qualifiedWhere = qualifyWhere(where, table);
      const setSql = Object.keys(prepared)
        .map((k) => `"${k}" = ?`)
        .join(', ');

      const { sql: whereSql, bindings: whereBindings } =
        buildDynamicWhereClause(qualifiedWhere, table);

      const softDeleteCondition = AVOID_DELETED_AT.includes(table)
        ? ''
        : `AND ${table}.deleted_at IS NULL`;
      const sql = `
        UPDATE ${table}
        SET ${setSql}
        WHERE ${whereSql}
          ${softDeleteCondition}
      `;

      const bindings = [...Object.values(prepared), ...whereBindings];
      let result;
      try {
        [result] = await conn.query(sql, bindings);
      } catch (err: any) {
        require('fs').appendFileSync('src/logs.log', `\n[DEBUG SQL] SQL: ${sql} \n[DEBUG BINDINGS] ${JSON.stringify(bindings)}\n`);
        throw err;
      }
      return {
        status: true,
        affected: result.affectedRows,
        message: 'Records updated',
      };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // UPSERT
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'upsert': {
      const actualData = data && data.data !== undefined ? data.data : data;
      const insertData = prepareData(businessId, actualData);
      const updateD = prepareData(businessId, updateData);

      const qualifiedConflict = qualifyWhere(where, table);
      const whereCols: Record<string, any> = {};

      for (const c of qualifiedConflict) {
        if ((c.operator ?? '=') !== '=') {
          throw new BadRequestException(
            'Upsert supports only equality conflicts',
          );
        }
        const col = c.column.split('.').pop()!;
        whereCols[col] = c.value;
      }

      const updateSql = `
        UPDATE ${table}
        SET ${Object.keys(updateD)
          .map((k) => `"${k}" = ?`)
          .join(', ')}
        WHERE ${Object.keys(whereCols)
          .map((k) => `"${k}" = ?`)
          .join(' AND ')}
          AND deleted_at IS NULL
        RETURNING *
      `;

      const [updateResult] = await conn.query(updateSql, [
        ...Object.values(updateD),
        ...Object.values(whereCols),
      ]);

      let id: any;
      let affected = updateResult ? updateResult.length : 0;

      if (affected === 0) {
        const keys = Object.keys(insertData);
        const placeholders = keys.map(() => '?').join(', ');

        const insertSql = `
          INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')})
          VALUES (${placeholders})
          RETURNING *
        `;

        const [insertResult] = await conn.query(
          insertSql,
          Object.values(insertData),
        );

        id =
          insertResult && insertResult.length > 0
            ? (insertResult[0].id !== undefined ? insertResult[0].id : Object.values(insertResult[0])[0])
            : null;
        affected = 1;
      } else {
        const row = updateResult[0];
        id = row.id !== undefined ? row.id : Object.values(row)[0];
      }

      return {
        status: true,
        id,
        affected,
        message: 'Upsert completed',
      };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DELETE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'delete': {
      if (!where || where.length === 0) {
        throw new BadRequestException(
          'Write operations require WHERE condition',
        );
      }
      const qualifiedWhere = qualifyWhere(where, table);
      const whereSql = buildDynamicWhereClause(qualifiedWhere, table);

      let sql = `DELETE FROM ${table}`;
      let bindings: any[] = [];
      const finalWhere = [...where];
      if (!AVOID_DELETED_AT.includes(table)) {
        finalWhere.push({
          column: `${table}.deleted_at`,
          operator: 'IS',
          value: null,
        });
      }
      ({ sql, bindings } = applyWhere(sql, finalWhere, table, bindings));
      const [result] = await conn.query(sql, bindings);
      return {
        status: true,
        affected: result.affectedRows,
        message: 'Records deleted',
      };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SOFT DELETE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'softDelete': {
      if (!where || where.length === 0) {
        throw new BadRequestException(
          'Write operations require WHERE condition',
        );
      }
      const qualifiedWhere = qualifyWhere(where, table);
      const whereSql = buildDynamicWhereClause(qualifiedWhere, table);

      let sql = `UPDATE ${table} SET deleted_at = NOW()`;
      let bindings: any[] = [];

      const finalWhere = [
        ...(where ?? []),
        {
          column: `${table}.deleted_at`,
          operator: 'IS',
          value: null,
        },
      ];

      ({ sql, bindings } = applyWhere(sql, finalWhere, table, bindings));

      const [result] = await conn.query(sql, bindings);

      return {
        status: true,
        affected: result.affectedRows,
        message: 'Records soft deleted',
      };
    }
  }
  throw new BadRequestException(`Invalid operation: '${op}'`);
}

/**
 * Prepare data for insert/update.
 * (Encryption removed)
 */
export function prepareData(
  businessId: string,
  data: Record<string, any>,
): Record<string, any> {
  const prepared: Record<string, any> = { ...data };
  const now = new Date();

  // if (!('created_at' in prepared)) {
  //   prepared.created_at = now;
  // }

  // if (!('updated_at' in prepared)) {
  //   prepared.updated_at = now;
  // }

  return prepared;
}

export function qualifyWhere(
  where: any[],
  table: string,
  joinTable?: string,
): WhereCondition[] {
  const structured = convertToStructuredWhere(where);
  return structured.map((cond: any) => {
    if (typeof cond === 'object' && cond !== null) {
      const column = cond.column ?? (Array.isArray(cond) ? cond[0] : null);

      if (column && !column.includes('.')) {
        cond.column = joinTable
          ? `${joinTable}.${column}`
          : `${table}.${column}`;
      }
      if (cond.operator === 'BETWEEN' || cond.operator === 'IN') {
        cond.value = Array.isArray(cond.value) ? cond.value : [cond.value];
      }
      cond.boolean = (cond.boolean ?? 'AND').toUpperCase();
      return cond;
    }
    return cond;
  });
}

export function buildDynamicWhereClause(
  conditions: WhereCondition[],
  table: string,
): { sql: string; bindings: any[] } {
  const bindings: any[] = [];

  const build = (conds: WhereCondition[]): string => {
    const parts: string[] = [];
    const ALLOWED_OPERATORS = [
      '=',
      '!=',
      '<>',
      '<',
      '>',
      '<=',
      '>=',
      'LIKE',
      'IN',
      'NOT IN',
      'BETWEEN',
      'IS NULL',
      'IS NOT NULL',
    ];
    for (const cond of conds) {
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // NESTED GROUP
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (cond.nested && Array.isArray(cond.nested)) {
        const bool = (cond.boolean ?? 'AND').toUpperCase();
        const nestedSql = build(cond.nested);
        if (nestedSql) {
          parts.push(`${bool} (${nestedSql})`);
        }
        continue;
      }

      const col = cond.column;
      if (!col) continue;
      const op = (cond.operator ?? '=').toUpperCase();
      // if (!ALLOWED_OPERATORS.includes(op)) {
      //   throw new Error(`Invalid operator: ${op}`);
      // }
      const bool = (cond.boolean ?? 'AND').toUpperCase();
      const colTable = col.includes('.') ? col.split('.')[0] : table;
      const plainCol = col.includes('.') ? col.split('.').pop()! : col;
      const identifierRegex = /^[a-zA-Z0-9_]+$/;
      if (!identifierRegex.test(plainCol)) {
        throw new Error(`Invalid column name: ${plainCol}`);
      }
      if (!identifierRegex.test(colTable)) {
        throw new Error(`Invalid table name: ${colTable}`);
      }
      const colName = `"${colTable}"."${plainCol}"`;
      let sqlPart = '';
      switch (op) {
        case 'BETWEEN': {
          const values = Array.isArray(cond.value)
            ? cond.value
            : [cond.value, cond.value];

          if (values.length !== 2) {
            throw new Error('BETWEEN requires 2 values');
          }
          sqlPart = `${colName} BETWEEN ? AND ?`;
          bindings.push(values[0], values[1]);
          break;
        }
        case 'IN': {
          const values = Array.isArray(cond.value) ? cond.value : [cond.value];
          if (!values.length) {
            sqlPart = '1 = 0';
          } else {
            sqlPart = `${colName} IN (${values.map(() => '?').join(', ')})`;
            bindings.push(...values);
          }
          break;
        }
        case 'NOT IN': {
          const values = Array.isArray(cond.value) ? cond.value : [cond.value];

          if (!values.length) {
            sqlPart = '1 = 1';
          } else {
            sqlPart = `${colName} NOT IN (${values.map(() => '?').join(', ')})`;
            bindings.push(...values);
          }
          break;
        }

        case 'LIKE': {
          const values = Array.isArray(cond.value) ? cond.value : [cond.value];

          const likeParts = values.map((v) => {
            bindings.push(`%${v}%`);
            // PostgreSQL: CAST to TEXT for non-text columns (id, date, timestamp)
            // Use ILIKE for case-insensitive search
            return `CAST(${colName} AS TEXT) ILIKE ?`;
          });

          sqlPart = likeParts.join(' OR ');
          break;
        }

        case 'IS NULL':
          sqlPart = `${colName} IS NULL`;
          if (op === 'IS NULL' && cond.value !== undefined) {
            throw new Error(`${op} should not have a value`);
          }
          break;

        case 'IS NOT NULL':
          sqlPart = `${colName} IS NOT NULL`;
          if (op === 'IS NOT NULL' && cond.value !== undefined) {
            throw new Error(`${op} should not have a value`);
          }
          break;

        case 'IS':
          if (cond.value === null) {
            sqlPart = `${colName} IS NULL`;
          } else {
            sqlPart = `${colName} IS ?`;
            bindings.push(cond.value);
          }
          break;

        case 'IS NOT':
          if (cond.value === null) {
            sqlPart = `${colName} IS NOT NULL`;
          } else {
            sqlPart = `${colName} IS NOT ?`;
            bindings.push(cond.value);
          }
          break;

        default:
          sqlPart = `${colName} ${op} ?`;
          bindings.push(cond.value);
          break;
      }
      parts.push(`${bool} ${sqlPart}`);
    }

    // Remove leading AND/OR
    return parts.join(' ').replace(/^(AND|OR)\s+/i, '');
  };

  const sql = build(conditions);
  return { sql, bindings };
}

/**
 * Convert to structured WHERE conditions.
 */

export function convertToStructuredWhere(condition: any): any[] {
  if (!condition) return [];

  // If already structured
  if (Array.isArray(condition)) {
    if (!condition.every((c) => typeof c === 'object' && c !== null)) {
      throw new Error('Invalid where array format');
    }
    return condition;
  }

  if (typeof condition !== 'object') {
    throw new Error('Invalid where format');
  }

  const structured: any[] = [];

  for (const [col, val] of Object.entries(condition)) {
    if (typeof col !== 'string') {
      throw new Error('Invalid column name');
    }

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      throw new Error(`Invalid value for column: ${col}`);
    }

    structured.push({
      column: col,
      operator: '=',
      value: val,
    });
  }

  return structured;
}

// export async function getEncryptedColumns(
//   tables: string[],
//   centralDb: Pool,
//   cache: Cache,
//   logger = new Logger('EncryptedColumns'),
// ): Promise<Record<string, string[]>> {
//   let allColumns: Record<string, string[]> = {};

//   try {
//     allColumns =
//       (await cache.get<Record<string, string[]>>(
//         'enc_columns',
//       )) ?? {};

//     if (!Object.keys(allColumns).length) {
//       const [rows] = await centralDb.query<any[]>(
//         `
//         SELECT \`table\`, \`columns\`
//         FROM skeleton_columns
//         WHERE is_active = 1
//         `,
//       );

//       allColumns = {};

//       for (const row of rows) {
//         allColumns[row.table] = row.columns
//           .split(',')
//           .map((c: string) => c.trim())
//           .filter(Boolean);
//       }

//       await cache.set('enc_columns', allColumns, CACHE_TTL);
//     }
//   } catch (err: any) {
//     logger.error('Failed to fetch encrypted columns', {
//       error: err?.message,
//       stack: err?.stack,
//     });

//     // Fallback: empty map (matches PHP behavior)
//     allColumns = {};
//   }

//   // Return only requested tables
//   const map: Record<string, string[]> = {};

//   for (const table of tables) {
//     map[table] = allColumns[table] ?? [];
//   }

//   return map;
// }

export async function qualifySelect(
  select: any[],
  table: string,
  conn: any,
): Promise<QualifiedSelectResult> {
  const bindings: any[] = [];
  const qualified: string[] = [];
  const aliasMap: Record<string, string> = {};
  const sourceMap: Record<string, { table: string; col: string }> = {};
  const identifierRegex = /^[a-zA-Z0-9_.*]+$/;
  for (const col of select) {
    let alias: string | null = null;
    let rawCol = col;
    // Handle "column AS alias"
    if (typeof col === 'string') {
      const match = col.match(/^(.+)\s+AS\s+`?([^`]+)`?$/i);
      if (match) {
        rawCol = match[1].trim();
        alias = match[2].trim();
      }
    }
    let colTable = table;
    if (!identifierRegex.test(colTable)) {
      throw new Error(`Invalid table name: ${colTable}`);
    }
    let plainCol = rawCol;
    if (plainCol !== '*' && !identifierRegex.test(plainCol)) {
      throw new Error(`Invalid column name: ${plainCol}`);
    }
    // Handle table.column
    if (typeof rawCol === 'string' && rawCol.includes('.')) {
      const [t, c] = rawCol.split('.', 2);
      colTable = t.replace(/`/g, '').replace(/"/g, '').trim();
      plainCol = c.replace(/`/g, '').replace(/"/g, '').trim();
    }

    // Handle wildcard (*)
    if (plainCol === '*') {
      const schemaCols = await getTableColumns(conn, colTable);

      for (const schCol of schemaCols) {
        const qualifiedCol = `"${colTable}"."${schCol}"`;
        qualified.push(qualifiedCol);

        sourceMap[schCol] = {
          table: colTable,
          col: schCol,
        };
        aliasMap[schCol] = schCol;
      }
      continue;
    }

    // Normal column
    const qualifiedCol = `"${colTable}"."${plainCol}"`;
    const resultKey = alias ?? plainCol;

    if (alias) {
      qualified.push(`${qualifiedCol} AS "${resultKey}"`);
    } else {
      qualified.push(qualifiedCol);
    }

    sourceMap[resultKey] = {
      table: colTable,
      col: plainCol,
    };
    aliasMap[plainCol] = resultKey;
  }

  return {
    columns: qualified,
    bindings,
    alias_map: aliasMap,
    source_map: sourceMap,
  };
}

export async function getTableColumns(
  conn: any,
  table: string,
): Promise<string[]> {
  const [rows] = await conn.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?`,
    [table],
  );

  return rows.map((r: any) => r.column_name);
}

/**
 * Apply WHERE conditions to SQL query.
 */
export function applyWhere(
  sql: string,
  where: any[],
  table: string,
  bindings: any[],
): { sql: string; bindings: any[] } {
  if (!where || where.length === 0) {
    return { sql, bindings };
  }

  const qualifiedWhere = qualifyWhere(where, table);
  const whereResult = buildDynamicWhereClause(qualifiedWhere, table);

  // Append WHERE or AND depending on existing clause
  if (/where\s+/i.test(sql)) {
    sql += ` AND ${whereResult.sql}`;
  } else {
    sql += ` WHERE ${whereResult.sql}`;
  }

  bindings.push(...whereResult.bindings);

  return { sql, bindings };
}

export function applyJoins(
  sql: string,
  joins: JoinConfig[],
  table: string,
  usedTables: string[],
  bindings: any[],
): {
  sql: string;
  bindings: any[];
  usedTables: string[];
} {
  if (!joins || joins.length === 0) {
    return { sql, bindings, usedTables };
  }

  for (const join of joins) {
    if (!join.table) {
      throw new Error("Join must specify a 'table' key");
    }

    const joinTable = join.table;
    const joinType = (join.type ?? 'INNER').toUpperCase();

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // JOIN TABLE EXPRESSION
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tableExpr = joinTable;
    // PostgreSQL does not support USE INDEX hints - removed

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ON CLAUSE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let onSql = '';
    const onBindings: any[] = [];

    if (join.on?.length) {
      const qualifiedOn = qualifyJoinOn(join.on, table, joinTable);

      const onResult = buildDynamicJoinOnClause(qualifiedOn, joinTable);

      onSql = ` ON ${onResult.sql}`;
      onBindings.push(...onResult.bindings);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SOFT DELETE (JOIN SCOPE, SAFE)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!AVOID_DELETED_AT.includes(joinTable)) {
      if (onSql) {
        onSql += ` AND ${joinTable}.deleted_at IS NULL`;
      } else {
        onSql = ` ON ${joinTable}.deleted_at IS NULL`;
      }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // JOIN TYPE HANDLING
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    switch (joinType) {
      case 'INNER':
      case 'LEFT':
      case 'RIGHT':
        sql += ` ${joinType} JOIN ${tableExpr}${onSql}`;
        break;

      case 'FULL':
        sql += `
          LEFT JOIN ${tableExpr}${onSql}
          UNION
          SELECT *
          FROM ${table}
          RIGHT JOIN ${tableExpr}${onSql}
        `;
        break;

      case 'CROSS':
        sql += ` CROSS JOIN ${tableExpr}`;
        break;

      case 'SELF':
        sql += ` INNER JOIN ${table} AS ${joinTable}${onSql}`;
        break;

      case 'NATURAL':
        sql += ` NATURAL JOIN ${tableExpr}`;
        break;

      default:
        throw new Error(`Invalid join type: '${joinType}'`);
    }

    bindings.push(...onBindings);

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // JOIN-SCOPED WHERE (ADVANCED)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (join.where?.length) {
      const joinWhere = qualifyWhere(join.where, joinTable);

      const whereResult = buildDynamicWhereClause(joinWhere, joinTable);

      sql += ` AND ${whereResult.sql}`;
      bindings.push(...whereResult.bindings);
    }

    usedTables.push(joinTable);
  }

  return {
    sql,
    bindings,
    usedTables: Array.from(new Set(usedTables)),
  };
}

/**
 * Qualify JOIN ON conditions.
 *
 * Supports:
 * - ['users.id', 'profiles.user_id']
 * - ['id', 'user_id'] (auto-qualified)
 * - [[ 'id', 'user_id' ], [ 'org_id', 'org_id' ]]
 * - structured conditions { column, operator, value }
 */
export function qualifyJoinOn(
  on: any[],
  table: string,
  joinTable: string,
): any[] {
  const qualified: any[] = [];

  for (const cond of on) {
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Simple ON: ['a', 'b']
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      Array.isArray(cond) &&
      cond.length === 2 &&
      typeof cond[0] === 'string' &&
      typeof cond[1] === 'string'
    ) {
      const leftCol = cond[0].includes('.') ? cond[0] : `${table}.${cond[0]}`;

      const rightCol = cond[1].includes('.')
        ? cond[1]
        : `${joinTable}.${cond[1]}`;

      qualified.push([leftCol, rightCol]);
      continue;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Multiple simple ONs:
    // [ ['a','b'], ['c','d'] ]
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (Array.isArray(cond) && Array.isArray(cond[0]) && cond[0].length === 2) {
      for (const simpleCond of cond) {
        if (!Array.isArray(simpleCond) || simpleCond.length !== 2) {
          throw new Error("Invalid multiple simple join 'on' clause");
        }

        const leftCol = simpleCond[0].includes('.')
          ? simpleCond[0]
          : `${table}.${simpleCond[0]}`;

        const rightCol = simpleCond[1].includes('.')
          ? simpleCond[1]
          : `${joinTable}.${simpleCond[1]}`;

        qualified.push([leftCol, rightCol]);
      }
      continue;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Structured condition:
    // { column, operator, value }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (typeof cond === 'object' && cond !== null) {
      const column = cond.column ?? cond[0] ?? null;

      if (column && !column.includes('.')) {
        cond.column = `${table}.${column}`;
      }

      if (
        cond.value &&
        typeof cond.value === 'string' &&
        !cond.value.includes('.') &&
        joinTable
      ) {
        cond.value = `${joinTable}.${cond.value}`;
      }

      qualified.push(cond);
      continue;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Invalid
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    throw new Error("Invalid join 'on' clause");
  }

  return qualified;
}

/**
 * Build dynamic JOIN ON clause.
 *
 * Supports:
 * - ['table.col', 'other.col']
 * - [['a','b'], ['c','d']]
 * - structured { column, operator, value }
 */
export function buildDynamicJoinOnClause(
  conditions: any[],
  joinTable: string,
): JoinOnBuildResult {
  const clauses: JoinOnClause[] = [];
  const bindings: any[] = [];

  for (let index = 0; index < conditions.length; index++) {
    const cond = conditions[index];

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Simple pair: ['a', 'b']
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      Array.isArray(cond) &&
      cond.length === 2 &&
      typeof cond[0] === 'string' &&
      typeof cond[1] === 'string'
    ) {
      const [leftCol, rightCol] = cond;

      const [leftTable, leftPlain] = leftCol.includes('.')
        ? leftCol.split('.', 2)
        : [joinTable, leftCol];

      const [rightTable, rightPlain] = rightCol.includes('.')
        ? rightCol.split('.', 2)
        : [joinTable, rightCol];

      clauses.push({
        left: `"${leftTable}"."${leftPlain}"`,
        operator: '=',
        right: `"${rightTable}"."${rightPlain}"`,
      });

      continue;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Multiple simple pairs
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (Array.isArray(cond) && Array.isArray(cond[0]) && cond[0].length === 2) {
      for (const simple of cond) {
        if (
          !Array.isArray(simple) ||
          simple.length !== 2 ||
          typeof simple[0] !== 'string' ||
          typeof simple[1] !== 'string'
        ) {
          throw new Error(
            `Invalid multiple simple join condition at index ${index}`,
          );
        }

        const [leftCol, rightCol] = simple;

        const [leftTable, leftPlain] = leftCol.includes('.')
          ? leftCol.split('.', 2)
          : [joinTable, leftCol];

        const [rightTable, rightPlain] = rightCol.includes('.')
          ? rightCol.split('.', 2)
          : [joinTable, rightCol];

        clauses.push({
          left: `"${leftTable}"."${leftPlain}"`,
          operator: '=',
          right: `"${rightTable}"."${rightPlain}"`,
        });
      }

      continue;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Structured condition
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (typeof cond === 'object' && cond !== null) {
      const leftCol = cond.column ?? cond[0];
      const operator = (cond.operator ?? cond[1] ?? '=').toUpperCase();
      const rightCol = cond.value ?? cond[2];

      if (!leftCol || typeof leftCol !== 'string') {
        throw new Error(
          `Invalid join condition at index ${index}: missing left column`,
        );
      }

      const [leftTable, leftPlain] = leftCol.includes('.')
        ? leftCol.split('.', 2)
        : [joinTable, leftCol];

      let rightSql: string;

      if (typeof rightCol === 'string' && rightCol.includes('.')) {
        const [rt, rc] = rightCol.split('.', 2);
        rightSql = `"${rt}"."${rc}"`;
      } else {
        rightSql = '?';
        bindings.push(rightCol);
      }

      clauses.push({
        left: `"${leftTable}"."${leftPlain}"`,
        operator,
        right: rightSql,
      });

      continue;
    }

    throw new Error(`Invalid join condition at index ${index}`);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Build SQL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sql = clauses
    .map((c) => `${c.left} ${c.operator} ${c.right}`)
    .join(' AND ');

  return { sql, bindings };
}

/**
 * Apply GROUP BY clause to SQL query
 *
 * @param sql       Current SQL string
 * @param groupBy   Group by columns
 * @param table     Base table name
 * @param bindings  SQL bindings
 */
export function applyGroupBy(
  sql: string,
  groupBy: string[] = [],
  table: string,
  bindings: any[] = [],
): { sql: string; bindings: any[] } {
  if (!groupBy || groupBy.length === 0) {
    return { sql, bindings };
  }

  const columns = groupBy.map((col) =>
    col.includes('.') ? col : `${table}.${col}`,
  );

  sql += ` GROUP BY ${columns.join(', ')}`;

  return { sql, bindings };
}

/**
 * Qualify multiple columns with table name
 *
 * @param columns  Column names
 * @param table    Base table name
 * @returns        Qualified column names
 */
export function qualifyColumns(
  columns: string[] = [],
  table: string,
): string[] {
  if (!columns || columns.length === 0) {
    return [];
  }

  return columns.map((col) => (col.includes('.') ? col : `${table}.${col}`));
}

/**
 * Qualify a single column with table name
 *
 * @param col    Column name
 * @param table  Base table name
 * @returns      Qualified column name
 */
export function qualifyColumn(col: string, table: string): string {
  return col.includes('.') ? col : `${table}.${col}`;
}

/**
 * Apply HAVING clause (raw SQL)
 *
 * @param sql       Current SQL string
 * @param having    Raw HAVING condition
 * @param table     Base table name
 * @param bindings  SQL bindings
 */
export function applyHaving(
  sql: string,
  having: string | null,
  table: string,
  bindings: any[] = [],
): { sql: string; bindings: any[] } {
  if (!having) {
    return { sql, bindings };
  }

  const qualifiedHaving = qualifyRaw(having, table);

  sql += ` HAVING ${qualifiedHaving}`;

  return { sql, bindings };
}

/**
 * Qualify raw SQL by backticking table.column references
 *
 * @param raw    Raw SQL string
 * @param table  Base table name (kept for parity, not required)
 * @returns      Qualified raw SQL
 */
export function qualifyRaw(raw: string, table: string): string {
  if (!raw) {
    return raw;
  }

  return raw.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
    (_, tbl, col) => `"${tbl}"."${col}"`,
  );
}

type OrderByItem = {
  column: string;
  direction?: 'ASC' | 'DESC' | string;
};
/**
 * Apply ORDER BY clause to SQL query
 */
export function applyOrderBy(
  sql: string,
  orderBy: any | null,
  table: string,
  bindings: any[] = [],
): { sql: string; bindings: any[] } {
  // Skip ORDER BY entirely when null (used for COUNT queries)
  if (orderBy === null) {
    return { sql, bindings };
  }

  // Robust parsing: convert single object to array
  const items = Array.isArray(orderBy)
    ? orderBy
    : (orderBy && typeof orderBy === 'object' && Object.keys(orderBy).length > 0)
      ? [orderBy]
      : [];

  // Default ORDER BY if empty array/null/undefined provided
  if (items.length === 0) {
    const defaultColumn = table === 'users' ? 'sno' : 'id';
    sql += ` ORDER BY "${table}"."${defaultColumn}" ASC`;
    return { sql, bindings };
  }

  const clauses: string[] = [];

  for (const item of items) {
    if (!item?.column) continue;

    const qualifiedCol = qualifyColumn(item.column, table);

    const direction =
      String(item.direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    clauses.push(`${qualifiedCol} ${direction}`);
  }

  // Safety: only append if valid clauses exist
  if (clauses.length > 0) {
    sql += ` ORDER BY ${clauses.join(', ')}`;
  }

  return { sql, bindings };
}

/**
 * Apply LIMIT and OFFSET to SQL query
 *
 * @param sql      Current SQL string
 * @param limit    Limit value
 * @param offset   Offset value
 * @param bindings SQL bindings
 */
export function applyLimitOffset(
  sql: string,
  limit?: number | null,
  offset?: number | null,
  bindings: any[] = [],
): { sql: string; bindings: any[] } {
  if (typeof limit === 'number') {
    sql += ` LIMIT ?`;
    bindings.push(limit);
  }

  if (typeof offset === 'number') {
    sql += ` OFFSET ?`;
    bindings.push(offset);
  }

  return { sql, bindings };
}

/**
 * Apply UNION / UNION ALL / INTERSECT / EXCEPT to SQL query
 *
 * @param sql         Base SQL query
 * @param union       Union configuration
 * @param conn        DB connection
 * @param table       Base table
 * @param businessId  Business ID
 * @param usedTables  Tables used so far
 * @param bindings    SQL bindings
 */
export async function applyUnion(
  sql: string,
  union: any | null,
  conn: any,
  table: string,
  businessId: string,
  usedTables: string[],
  bindings: any[],
): Promise<{
  sql: string;
  bindings: any[];
  usedTables: string[];
}> {
  if (!union || Object.keys(union).length === 0) {
    return { sql, bindings, usedTables };
  }

  const unionType = String(union.type ?? 'UNION').toUpperCase();

  // Build union subquery (Laravel: buildUnionSubquery)
  const unionResult = await buildUnionSubquery(union, conn, table, businessId);

  // Track used tables
  if (Array.isArray(union.tables)) {
    usedTables.push(...union.tables);
  } else if (union.table) {
    usedTables.push(union.table);
  } else {
    usedTables.push('unknown_union_table');
  }

  let finalSql = `(${sql})`;

  switch (unionType) {
    case 'UNION':
      finalSql += ` UNION (${unionResult.sql})`;
      break;

    case 'UNION ALL':
      finalSql += ` UNION ALL (${unionResult.sql})`;
      break;

    case 'INTERSECT':
      finalSql += ` INTERSECT (${unionResult.sql})`;
      break;

    case 'EXCEPT':
      finalSql += ` EXCEPT (${unionResult.sql})`;
      break;

    default:
      throw new Error(`Invalid union type: '${unionType}'`);
  }

  bindings.push(...unionResult.bindings);

  return {
    sql: finalSql,
    bindings,
    usedTables: Array.from(new Set(usedTables)),
  };
}

/**
 * Build UNION subquery (Laravel-equivalent)
 *
 * @param unionParams  Union parameters
 * @param conn         DB connection
 * @param table        Base table
 * @param businessId   Business ID
 */
export async function buildUnionSubquery(
  unionParams: Record<string, any>,
  conn: any,
  table: string,
  businessId: string,
): Promise<{ sql: string; bindings: any[] }> {
  const unionTable = unionParams.table ?? table;

  let sql = `SELECT `;
  const bindings: any[] = [];

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SELECT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (Array.isArray(unionParams.select) && unionParams.select.length > 0) {
    const selectResult = await qualifySelect(
      unionParams.select,
      unionTable,
      conn,
    );

    sql += selectResult.columns.join(', ');
    bindings.push(...selectResult.bindings);
  } else {
    sql += '*';
  }

  sql += ` FROM ${unionTable}`;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // WHERE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (Array.isArray(unionParams.where) && unionParams.where.length > 0) {
    const qualifiedWhere = qualifyWhere(unionParams.where, unionTable);

    const whereResult = buildDynamicWhereClause(qualifiedWhere, unionTable);

    sql += ` WHERE ${whereResult.sql}`;
    bindings.push(...whereResult.bindings);
  }

  return { sql, bindings };
}

/**
 * Apply CTE (WITH clause) to final SQL
 *
 * @param withDefs  CTE definitions
 * @param sql       Final SQL query
 * @param bindings  SQL bindings
 */
export function applyCte(
  withDefs: any[] | null,
  sql: string,
  bindings: any[],
): { sql: string; bindings: any[] } {
  if (!Array.isArray(withDefs) || withDefs.length === 0) {
    return { sql, bindings };
  }

  const cteSql = buildCteSql(withDefs);

  return {
    sql: `WITH ${cteSql} ${sql}`,
    bindings,
  };
}

/**
 * Build CTE SQL
 *
 * @param withDefs CTE definitions
 */
export function buildCteSql(withDefs: any[]): string {
  const clauses: string[] = [];

  for (const cte of withDefs) {
    if (!cte.name || !cte.query) {
      throw new Error('Invalid CTE definition');
    }
    clauses.push(`${cte.name} AS (${cte.query})`);
  }
  return clauses.join(', ');
}

/**
 * Apply raw subquery WHERE condition
 *
 * @param sql        Current SQL string
 * @param subquery   Raw subquery condition
 * @param table      Base table name
 * @param bindings   SQL bindings
 */
export function applySubqueryWhere(
  sql: string,
  subquery?: string | null,
  table?: string,
  bindings: any[] = [],
): { sql: string; bindings: any[] } {
  if (!subquery || typeof subquery !== 'string') {
    return { sql, bindings };
  }

  const qualified = qualifyRaw(subquery, table ?? '');

  // If WHERE already exists, append with AND
  if (/\bWHERE\b/i.test(sql)) {
    sql += ` AND ${qualified}`;
  } else {
    sql += ` WHERE ${qualified}`;
  }

  return { sql, bindings };
}

export class SqlHelper {
  static qualifyColumn(column: string, table?: string): string {
    if (!table) return `"${column}"`;
    return `"${table}"."${column}"`;
  }
}

export class JsonExprBuilder {
  static build(json: JsonSelectParams, table?: string): string {
    const expressions: string[] = [];

    for (const [column, path] of Object.entries(json)) {
      const qualifiedCol = SqlHelper.qualifyColumn(column, table);

      // PostgreSQL: use ->> for text extraction from jsonb
      expressions.push(`${qualifiedCol}->>'${path}' AS "${column}_json"`);
    }

    return expressions.join(', ');
  }
}

export class WindowExprBuilder {
  static build(window: WindowParams, table?: string): string {
    const expressions: string[] = [];

    for (const [func, opts] of Object.entries(window)) {
      const column = opts.column ?? '*';
      const qualifiedCol =
        column === '*' ? '*' : SqlHelper.qualifyColumn(column, table);

      const partitionBy =
        opts.partition && opts.partition.length
          ? `PARTITION BY ${opts.partition
            .map((p) => SqlHelper.qualifyColumn(p, table))
            .join(', ')}`
          : '';

      const orderBy =
        opts.order && opts.order.length
          ? `ORDER BY ${opts.order
            .map(
              (o) =>
                `${SqlHelper.qualifyColumn(
                  o.col,
                  table,
                )} ${(o.dir ?? 'ASC').toUpperCase()}`,
            )
            .join(', ')}`
          : '';

      expressions.push(
        `
        ${func}(${qualifiedCol})
        OVER (${[partitionBy, orderBy].filter(Boolean).join(' ')})
        AS "${func.toLowerCase()}_${column}"
      `.trim(),
      );
    }

    return expressions.join(', ');
  }
}

export class FullTextExprBuilder {
  static build(
    ft: FullTextParams,
    table?: string,
  ): { sql: string; bindings: any[] } {
    if (!ft.columns?.length) {
      throw new Error('Full-text search requires columns');
    }
    // PostgreSQL full-text search using to_tsvector / plainto_tsquery
    const columns = ft.columns
      .map(
        (col) => `coalesce(${SqlHelper.qualifyColumn(col, table)}::text, '')`,
      )
      .join(` || ' ' || `);
    const sql = `
      to_tsvector('english', ${columns})
      @@ plainto_tsquery('english', ?)
    `.trim();
    return {
      sql,
      bindings: [ft.query],
    };
  }
}
