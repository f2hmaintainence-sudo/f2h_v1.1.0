import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { getSensitiveColumns, isSensitiveField } from './sensitive-fields.map';
import { DeveloperService } from '../shared/logger/Developer.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const LEGACY_PREFIX = 'enc::';

@Injectable()
export class FieldEncryptionService {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private encryptionKey: Buffer | null = null;

  constructor(private readonly developer: DeveloperService) {}

  private getKey(): Buffer {
    if (this.encryptionKey) return this.encryptionKey;

    const secret =
      process.env.DATA_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error(
        'CRITICAL: DATA_ENCRYPTION_KEY or ENCRYPTION_SECRET environment variable is not set',
      );
    }
    if (secret.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
    this.encryptionKey = crypto.pbkdf2Sync(
      secret,
      'field-level-encryption-salt',
      100000,
      32,
      'sha512',
    );
    return this.encryptionKey;
  }

  private logEncryptionIssue(message: string, context: Record<string, any>) {
    this.logger.warn(message);
    this.developer.error(message, context);
  }

  private looksLikeEncrypted(value: string): boolean {
    if (typeof value !== 'string' || value.trim() === '') return false;

    const payload = value.startsWith(LEGACY_PREFIX)
      ? value.slice(LEGACY_PREFIX.length)
      : value;
    const parts = payload.split(':');
    if (parts.length !== 3) return false;

    const [ivHex, tagHex, encryptedHex] = parts;

    return (
      ivHex.length === IV_LENGTH * 2 &&
      tagHex.length === AUTH_TAG_LENGTH * 2 &&
      /^[0-9a-f]+$/i.test(ivHex) &&
      /^[0-9a-f]+$/i.test(tagHex) &&
      encryptedHex.length > 0 &&
      /^[0-9a-f]+$/i.test(encryptedHex)
    );
  }

  private inspectSensitiveValue(
    table: string,
    col: string,
    value: unknown,
  ): void {
    if (typeof value !== 'string' || value === '') return;
    if (this.isEncrypted(value)) return;

    this.logEncryptionIssue('Sensitive column fetched without decryption', {
      table,
      column: col,
      preview:
        value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value,
    });
  }

  encrypt(plaintext: string): string {
    if (!plaintext || typeof plaintext !== 'string') return plaintext;
    if (this.looksLikeEncrypted(plaintext)) return plaintext;

    const key = this.getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
    if (!this.looksLikeEncrypted(ciphertext)) return ciphertext;

    try {
      const payload = ciphertext.startsWith(LEGACY_PREFIX)
        ? ciphertext.slice(LEGACY_PREFIX.length)
        : ciphertext;
      const parts = payload.split(':');
      if (parts.length !== 3) return ciphertext;

      const [ivHex, tagHex, encrypted] = parts;
      const key = this.getKey();
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logEncryptionIssue('Failed to decrypt field value', {
        error: message,
        value_prefix: ciphertext.slice(0, 32),
      });
      return ciphertext;
    }
  }

  isEncrypted(value: string): boolean {
    return this.looksLikeEncrypted(value);
  }

  encryptRow(table: string, data: Record<string, any>): Record<string, any> {
    const sensitiveColumns = getSensitiveColumns(table);
    if (sensitiveColumns.length === 0) return data;

    const result = { ...data };
    for (const col of sensitiveColumns) {
      if (
        result[col] !== undefined &&
        result[col] !== null &&
        typeof result[col] === 'string' &&
        result[col] !== ''
      ) {
        result[col] = this.encrypt(result[col]);
      }
    }
    return result;
  }

  decryptRow(table: string, data: Record<string, any>): Record<string, any> {
    if (!data) return data;
    const sensitiveColumns = getSensitiveColumns(table);
    if (sensitiveColumns.length === 0) return data;

    const result = { ...data };
    for (const col of sensitiveColumns) {
      if (
        result[col] !== undefined &&
        result[col] !== null &&
        typeof result[col] === 'string'
      ) {
        this.inspectSensitiveValue(table, col, result[col]);
        result[col] = this.decrypt(result[col]);
      }
    }
    return result;
  }

  decryptRows(
    table: string,
    rows: Record<string, any>[],
  ): Record<string, any>[] {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    const sensitiveColumns = getSensitiveColumns(table);
    if (sensitiveColumns.length === 0) return rows;
    return rows.map((row) => this.decryptRow(table, row));
  }

  decryptJoinedRow(
    data: Record<string, any>,
    ...tables: string[]
  ): Record<string, any> {
    if (!data) return data;
    const result = { ...data };

    const allSensitiveColumns = new Set<string>();
    for (const table of tables) {
      const cols = getSensitiveColumns(table);
      cols.forEach((c) => allSensitiveColumns.add(c));
    }

    for (const col of allSensitiveColumns) {
      if (
        result[col] !== undefined &&
        result[col] !== null &&
        typeof result[col] === 'string'
      ) {
        const sourceTable =
          tables.find((t) => isSensitiveField(t, col)) ||
          tables[0] ||
          'unknown';
        this.inspectSensitiveValue(sourceTable, col, result[col]);
        result[col] = this.decrypt(result[col]);
      }
    }

    const aliasMap: Record<string, string> = {
      customer_phone: 'phone',
      customer_email: 'email',
      rider_phone: 'phone',
      rider_name: 'name',
      full_name: 'first_name',
    };

    for (const [alias, srcCol] of Object.entries(aliasMap)) {
      if (
        result[alias] !== undefined &&
        result[alias] !== null &&
        typeof result[alias] === 'string'
      ) {
        const sourceTable =
          tables.find((t) => isSensitiveField(t, srcCol)) ||
          tables[0] ||
          'unknown';
        this.inspectSensitiveValue(sourceTable, srcCol, result[alias]);
        result[alias] = this.decrypt(result[alias]);
      }
    }

    return result;
  }

  decryptJoinedRows(
    rows: Record<string, any>[],
    ...tables: string[]
  ): Record<string, any>[] {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    return rows.map((row) => this.decryptJoinedRow(row, ...tables));
  }

  hashForLookup(value: string): string {
    if (!value || typeof value !== 'string') return value;
    const key = this.getKey();
    return crypto
      .createHmac('sha256', key)
      .update(value.trim().toLowerCase())
      .digest('hex');
  }
}
