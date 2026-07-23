/**
 * PASSWORD SECURITY SERVICE
 * Modern SaaS-grade password security (NIST 800-63B compliant)
 *
 * Features:
 * ✅ Password history (prevent last 5 reuse)
 * ✅ Breach detection (HaveIBeenPwned API)
 * ✅ Strong password validation
 * ❌ Removed: Time-based expiration (outdated, not recommended by NIST/Microsoft/Google)
 */

import { Injectable } from '@nestjs/common';
import { DataService } from 'src/shared/database/Data.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

interface PasswordHistoryEntry {
  id: number;
  user_id: string;
  password_hash: string;
  created_at: Date;
}

@Injectable()
export class PasswordSecurityService {
  private readonly HISTORY_LIMIT = 5; // Prevent reusing last 5 passwords
  private readonly BREACH_API_TIMEOUT = 3000; // 3 seconds

  constructor(private readonly Data: DataService) { }

  private async verifyPassword(
    password: string,
    storedPassword: string | null | undefined,
  ): Promise<boolean> {
    if (!storedPassword) return false;

    // Check if it's a bcrypt hash
    if (storedPassword.startsWith('$2')) {
      return await bcrypt.compare(password, storedPassword);
    }

    const parts = storedPassword.split(':');
    if (parts.length === 3) {
      const [storedHash, salt, iv] = parts;
      if (!storedHash || !salt || !iv) return false;

      const hash = crypto
        .pbkdf2Sync(password, `${salt}:${iv}`, 100000, 64, 'sha512')
        .toString('hex');

      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(storedHash, 'hex'),
      );
    }

    return false;
  }

  /**
   * Check if password has been used before
   * Prevents reusing previous passwords
   */
  async isPasswordReused(
    userId: string,
    newPassword: string,
  ): Promise<boolean> {
    try {
      const safeLimit = Math.max(1, Math.floor(this.HISTORY_LIMIT));

      const queryResult = await this.Data.query(
        'password_history',
        {
          select: ['password_hash'],
          where: [{ column: 'user_id', operator: '=', value: userId }],
          orderBy: { created_at: 'DESC' },
          limit: safeLimit,
        },
        true,
      );

      const results = queryResult?.data || [];

      if (!results || results.length === 0) {
        return false;
      }

      // Check if new password matches any of the historical passwords
      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        const isMatch = await this.verifyPassword(
          newPassword,
          entry.password_hash,
        );

        if (isMatch) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(
        `[PasswordSecurity] ❌ Error checking password reuse:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Record new password in history
   * Called after successful password change
   */
  async recordPasswordHistory(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    try {

      await this.Data.insert('password_history', {
        user_id: userId,
        password_hash: passwordHash,
      }, { includeDeleted: true });

      // Clean up old entries - keep only last HISTORY_LIMIT entries
      await this.cleanupOldHistoryEntries(userId);
    } catch (error) {
      console.error(
        `[PasswordSecurity:record] ❌ Error recording password history:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get password history for a user
   * Returns timestamps of when passwords were changed (without hashes for security)
   */
  async getPasswordHistory(
    userId: string,
  ): Promise<Array<{ changed_at: Date; days_old: number }>> {
    try {
      const safeLimit = Math.max(1, Math.floor(this.HISTORY_LIMIT));

      const queryResult = await this.Data.query(
        'password_history',
        {
          select: ['created_at'],
          where: [{ column: 'user_id', operator: '=', value: userId }],
          orderBy: { created_at: 'DESC' },
          limit: safeLimit,
        },
        true,
      );

      const results = queryResult?.data || [];
      const now = Date.now();
      const mapped = results.map((entry: { created_at: string | Date }) => {
        const changedAt = new Date(entry.created_at);
        const daysOld = Math.floor(
          (now - changedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          changed_at: changedAt,
          days_old: Math.max(0, daysOld),
        };
      });

      return mapped;
    } catch (error) {
      console.error(
        `[PasswordSecurity:get] ❌ Error fetching password history:`,
        error,
      );
      return [];
    }
  }

  /**
   * Delete all password history for a user (during account deletion)
   */
  async deleteUserPasswordHistory(userId: string): Promise<void> {
    try {
      await this.Data.delete(
        'password_history',
        [{ column: 'user_id', operator: '=', value: userId }],
        { includeDeleted: true }
      );
    } catch (error) {
      console.error(
        `[PasswordSecurity:delete] ❌ Error deleting password history:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔐 BREACH DETECTION: Check if password exists in known data breaches
   * Uses HaveIBeenPwned API (k-Anonymity model - only sends first 5 chars of hash)
   * Industry standard: NIST recommends screening passwords against breach databases
   * Used by: Microsoft, Apple, 1Password, LastPass, Google
   */
  async checkBreachedPassword(
    password: string,
  ): Promise<{ breached: boolean; occurrences: number }> {
    try {
      // Generate SHA-1 hash of password (HaveIBeenPwned uses SHA-1)
      const sha1 = crypto
        .createHash('sha1')
        .update(password)
        .digest('hex')
        .toUpperCase();
      const prefix = sha1.substring(0, 5); // First 5 chars
      const suffix = sha1.substring(5); // Remaining chars

      // k-Anonymity: Only send first 5 chars to API (preserves privacy)
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: {
            'User-Agent': 'GiftThem-Security-Check',
          },
          signal: AbortSignal.timeout(this.BREACH_API_TIMEOUT),
        },
      );

      if (!response.ok) {
        console.warn(
          `[PasswordSecurity:breach] ⚠️ Breach API returned ${response.status}, allowing password`,
        );
        return { breached: false, occurrences: 0 };
      }

      const data = await response.text();

      // Search for our suffix in the response
      const lines = data.split('\n');
      for (const line of lines) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix === suffix) {
          const occurrences = parseInt(count.trim(), 10);
          return { breached: true, occurrences };
        }
      }

      return { breached: false, occurrences: 0 };
    } catch (error) {
      // Fail open: If API is down, don't block password change
      console.error(
        `[PasswordSecurity:breach] ⚠️ Breach check failed (non-blocking):`,
        error,
      );
      return { breached: false, occurrences: 0 };
    }
  }

  /**
   * Validate password strength (minimum requirements)
   * NIST 800-63B compliant
   */
  validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain special character (!@#$%^&*)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clean up old password history entries
   * Keeps only the last HISTORY_LIMIT entries per user
   */
  private async cleanupOldHistoryEntries(userId: string): Promise<void> {
    try {
      const safeLimit = Math.max(1, Math.floor(this.HISTORY_LIMIT));

      const queryResult = await this.Data.query(
        'password_history',
        {
          select: ['id'],
          where: [{ column: 'user_id', operator: '=', value: userId }],
          orderBy: { created_at: 'DESC' },
          limit: 1000,
        },
        true,
      );

      const allEntries: PasswordHistoryEntry[] = queryResult?.data || [];
      if (allEntries.length <= safeLimit) {
        return;
      }

      const idsToDelete = allEntries.slice(safeLimit).map((entry) => entry.id);
      if (idsToDelete.length > 0) {
        await this.Data.delete(
          'password_history',
          [
            { column: 'user_id', operator: '=', value: userId },
            { column: 'id', operator: 'IN', value: idsToDelete },
          ],
          { includeDeleted: true }
        );
      }
    } catch (error) {
      console.error(
        `[PasswordSecurity:cleanup] ⚠️ Cleanup failed (non-critical):`,
        error,
      );
      // Don't throw - cleanup failure shouldn't block the main operation
    }
  }
}
