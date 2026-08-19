import { Injectable,
  Logger,
} from '@nestjs/common';
import { RedisService } from 'src/shared/redis/redis.service';
import { DataService } from 'src/shared/database/Data.service';
import { CACHE_KEYS, CACHE_TTL } from 'src/shared/redis/cache.constants';

/**
 * OTP Rate Limiting Service
 * Implements exponential backoff and progressive lockout for OTP requests
 *
 * Strategy:
 * - Allow 3 free attempts in 1 minute
 * - After 3 attempts: 5 minute lockout
 * - After 6 attempts: 30 minute lockout
 * - After 9 attempts: 1 hour lockout
 * - After 12 attempts: 24 hour lockout
 * - Max 15 attempts per day before permanent block
 */
@Injectable()
export class OtpRateLimitService {
  private readonly logger = new Logger(OtpRateLimitService.name);

  private readonly FREE_ATTEMPTS = 1000; // DEV: was 3
  private readonly DAILY_LIMIT = 10000; // DEV: was 15

  // Exponential backoff tiers (DEV: thresholds raised, durations reduced to 1s)
  private readonly LOCKOUT_TIERS = [
    { threshold: 1000, duration: 1, label: '1 second' },
    { threshold: 2000, duration: 1, label: '1 second' },
    { threshold: 3000, duration: 1, label: '1 second' },
    { threshold: 4000, duration: 1, label: '1 second' },
    { threshold: 5000, duration: 1, label: '1 second' },
  ];

  constructor(
    private readonly redisService: RedisService,
    private readonly Data: DataService,
  ) {}

  /**
   * Check if phone is rate limited for OTP requests
   * Returns: { allowed: boolean, reason?: string, remainingTime?: number }
   */
  async checkRequestLimit(phone: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingTime?: number;
  }> {
    const phone_normalized = phone.trim();
    const redisKey = CACHE_KEYS.OTP_RATE_LIMIT(phone_normalized);
    const dailyKey = CACHE_KEYS.OTP_DAILY_LIMIT(phone_normalized);

    try {
      // Get current rate limit state from Redis
      const limitState = await this.redisService.fetch<any>(redisKey);
      const dailyCountRaw = await this.redisService.fetch<any>(dailyKey);
      const dailyCount = Number(dailyCountRaw) || 0;

      // Check daily limit
      if (dailyCount >= this.DAILY_LIMIT) {
        const remainingSeconds = await this.redisService.ttl(dailyKey);
        return {
          allowed: false,
          reason: `Daily OTP limit (${this.DAILY_LIMIT}) exceeded. Please try again tomorrow.`,
          remainingTime: remainingSeconds || 0,
        };
      }

      // Check if currently in lockout
      if (limitState?.locked_until) {
        const lockedUntil = new Date(limitState.locked_until).getTime();
        const now = new Date().getTime();

        if (now < lockedUntil) {
          const remainingMs = lockedUntil - now;
          const remainingMinutes = Math.ceil(remainingMs / 60000);

          return {
            allowed: false,
            reason: `Too many OTP requests. Please try again in ${remainingMinutes} minutes.`,
            remainingTime: Math.ceil(remainingMs / 1000),
          };
        } else {
          // Lockout expired, reset
          await this.redisService.forget(redisKey);
          limitState.attempts = 0;
          limitState.locked_until = null;
        }
      }

      // Allow request
      return { allowed: true };
    } catch (error) {
      console.error('[OTP Rate Limit] Error checking limit:', error);
      // Fail-closed: deny request on Redis error to prevent bypass via disruption
      return {
        allowed: false,
        reason:
          'Rate limit service temporarily unavailable, please try again shortly',
      };
    }
  }

  /**
   * Record an OTP request attempt
   */
  async recordRequestAttempt(phone: string, ip?: string): Promise<void> {
    const phone_normalized = phone.trim();
    const redisKey = CACHE_KEYS.OTP_RATE_LIMIT(phone_normalized);
    const dailyKey = CACHE_KEYS.OTP_DAILY_LIMIT(phone_normalized);

    try {
      // Get current state
      let limitState = await this.redisService.fetch<any>(redisKey);

      if (!limitState) {
        limitState = {
          phone: phone_normalized,
          attempts: 1,
          first_attempt: new Date().toISOString(),
          last_attempt: new Date().toISOString(),
          locked_until: null,
          ips: [ip || 'unknown'],
        };
      } else {
        limitState.attempts++;
        limitState.last_attempt = new Date().toISOString();
        if (ip && !limitState.ips.includes(ip)) {
          limitState.ips.push(ip);
        }

        // Check if we need to apply lockout
        const tier = this.LOCKOUT_TIERS.find(
          (t) => t.threshold === limitState.attempts,
        );
        if (tier) {
          limitState.locked_until = new Date(
            Date.now() + tier.duration * 1000,
          ).toISOString();
          this.logger.log(
            `[OTP Rate Limit] Phone ${phone_normalized} locked for ${tier.label} after ${tier.threshold} attempts`,
          );
        }
      }

      // Store in Redis with 24-hour TTL
      await this.redisService.put(redisKey, limitState, CACHE_TTL.ONE_DAY);

      // Increment daily counter with 24-hour TTL
      const dailyCountRaw = await this.redisService.fetch<any>(dailyKey);
      const dailyCount = Number(dailyCountRaw) || 0;
      await this.redisService.put(dailyKey, dailyCount + 1, CACHE_TTL.ONE_DAY);

      // Log to database for security audit
      await this.logOtpAttempt({
        phone: phone_normalized,
        type: 'REQUEST',
        attempt_number: limitState.attempts,
        ip: ip || 'unknown',
      });
    } catch (error) {
      console.error('[OTP Rate Limit] Error recording request attempt:', error);
      throw error;
    }
  }

  /**
   * Record an OTP verification attempt (correct or incorrect OTP)
   */
  async recordVerificationAttempt(
    phone: string,
    success: boolean,
    ip?: string,
  ): Promise<void> {
    const phone_normalized = phone.trim();
    const verifyKey = CACHE_KEYS.OTP_VERIFY_ATTEMPTS(phone_normalized);

    try {
      let verifyState = await this.redisService.fetch<any>(verifyKey);

      if (!verifyState) {
        verifyState = {
          phone: phone_normalized,
          attempts: 1,
          failures: success ? 0 : 1,
          last_attempt: new Date().toISOString(),
          ips: [ip || 'unknown'],
        };
      } else {
        verifyState.attempts++;
        if (!success) {
          verifyState.failures++;
        }
        verifyState.last_attempt = new Date().toISOString();
        if (ip && !verifyState.ips.includes(ip)) {
          verifyState.ips.push(ip);
        }

        // If too many verification failures (brute force), apply additional lockout
        if (verifyState.failures >= 5) {
          const requestLimitKey = CACHE_KEYS.OTP_RATE_LIMIT(phone_normalized);
          const limitState =
            (await this.redisService.fetch<any>(requestLimitKey)) || {};
          limitState.locked_until = new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(); // 30 min lockout
          await this.redisService.put(
            requestLimitKey,
            limitState,
            CACHE_TTL.ONE_DAY,
          );

          this.logger.log(
            `[OTP Rate Limit] Phone ${phone_normalized} locked for 30 minutes due to ${verifyState.failures} failed verifications`,
          );
        }
      }

      // Store verification attempts with 1-hour TTL
      await this.redisService.put(verifyKey, verifyState, CACHE_TTL.ONE_HOUR);

      // Log to database
      await this.logOtpAttempt({
        phone: phone_normalized,
        type: success ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILURE',
        attempt_number: verifyState.attempts,
        ip: ip || 'unknown',
      });
    } catch (error) {
      console.error(
        '[OTP Rate Limit] Error recording verification attempt:',
        error,
      );
      throw error;
    }
  }

  /**
   * Reset rate limits for a phone (admin function or after successful verification)
   */
  async resetLimits(phone: string): Promise<void> {
    const phone_normalized = phone.trim();
    const redisKey = CACHE_KEYS.OTP_RATE_LIMIT(phone_normalized);
    const verifyKey = CACHE_KEYS.OTP_VERIFY_ATTEMPTS(phone_normalized);
    const dailyKey = CACHE_KEYS.OTP_DAILY_LIMIT(phone_normalized);

    try {
      await this.redisService.forget(redisKey);
      await this.redisService.forget(verifyKey);
      // Don't reset daily key - it's meant to persist for 24 hours
      this.logger.log(
        `[OTP Rate Limit] Reset limits for phone ${phone_normalized}`,
      );
    } catch (error) {
      console.error('[OTP Rate Limit] Error resetting limits:', error);
      throw error;
    }
  }

  /**
   * Get current rate limit status (for frontend)
   */
  async getStatus(phone: string): Promise<{
    is_limited: boolean;
    attempts_made: number;
    daily_attempts_made: number;
    locked_until?: string;
    remaining_daily: number;
  }> {
    const phone_normalized = phone.trim();
    const redisKey = CACHE_KEYS.OTP_RATE_LIMIT(phone_normalized);
    const dailyKey = CACHE_KEYS.OTP_DAILY_LIMIT(phone_normalized);

    try {
      const limitState = await this.redisService.fetch<any>(redisKey);
      const dailyCountRaw = await this.redisService.fetch<any>(dailyKey);
      const dailyCount = Number(dailyCountRaw) || 0;

      return {
        is_limited: limitState?.locked_until
          ? new Date(limitState.locked_until).getTime() > Date.now()
          : false,
        attempts_made: limitState?.attempts || 0,
        daily_attempts_made: dailyCount,
        locked_until: limitState?.locked_until,
        remaining_daily: Math.max(0, this.DAILY_LIMIT - dailyCount),
      };
    } catch (error) {
      console.error('[OTP Rate Limit] Error getting status:', error);
      return {
        is_limited: false,
        attempts_made: 0,
        daily_attempts_made: 0,
        remaining_daily: this.DAILY_LIMIT,
      };
    }
  }

  /**
   * Log OTP attempts to database for audit trail
   */
  private async logOtpAttempt(data: {
    phone: string;
    type: 'REQUEST' | 'VERIFICATION_SUCCESS' | 'VERIFICATION_FAILURE';
    attempt_number: number;
    ip: string;
  }): Promise<void> {
    try {
      await this.Data.query('otp_rate_limit_logs', {
        insert: {
          phone: data.phone,
          type: data.type,
          attempt_number: data.attempt_number,
          ip_address: data.ip,
          created_at: new Date(),
        },
      });
    } catch (error) {
      // Fail silently - don't break main flow for logging errors
      console.error('[OTP Rate Limit] Error logging attempt:', error);
    }
  }
}
