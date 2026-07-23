import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/shared/redis/redis.service';
import { CACHE_KEYS } from 'src/shared/redis/cache.constants';

/**
 * Token Revocation Service
 * Manages the revocation of JWT tokens (access & refresh)
 * Tokens are stored in Redis with TTL matching token expiration
 */
@Injectable()
export class TokenRevocationService {
  // In-memory fallback for development (will migrate to Redis)
  private revokedTokens = new Map<string, number>();

  constructor(private readonly redisService: RedisService) {
    // Cleanup revoked tokens periodically (every 1 hour)
    setInterval(() => this.cleanupExpiredTokens(), 3600 * 1000);
  }

  /**
   * Revoke a token by its JTI (JWT ID)
   * @param jti - Unique token identifier
   * @param expiresAt - Token expiration time (for TTL calculation)
   */
  async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    try {
      // Calculate TTL in seconds (ensure at least 1 second)
      const ttl = Math.max(
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
        1,
      );

      // Store in Redis with TTL
      const redisKey = CACHE_KEYS.AUTH_REVOKED_TOKEN(jti);
      await this.redisService.put(redisKey, true, ttl);

      // Also store in memory for development
      this.revokedTokens.set(jti, Date.now() + ttl * 1000);

      console.log(
        `[TokenRevocation] Token revoked: ${jti.substring(0, 8)}... (TTL: ${ttl}s)`,
      );
    } catch (error) {
      console.error(`[TokenRevocation] Failed to revoke token ${jti}:`, error);
      // Fallback to in-memory storage
      this.revokedTokens.set(jti, Date.now() + 3600 * 1000);
    }
  }

  /**
   * Check if a token has been revoked
   * @param jti - Unique token identifier
   * @returns true if token is revoked, false otherwise
   */
  async isRevoked(jti: string): Promise<boolean> {
    try {
      // Check Redis first
      const redisKey = CACHE_KEYS.AUTH_REVOKED_TOKEN(jti);
      const revokedInRedis = await this.redisService.fetch(redisKey);

      if (revokedInRedis) {
        return true;
      }

      // Fallback to in-memory check
      if (this.revokedTokens.has(jti)) {
        const expiresAt = this.revokedTokens.get(jti);
        if (expiresAt && expiresAt > Date.now()) {
          return true;
        } else {
          // Remove expired entry
          this.revokedTokens.delete(jti);
        }
      }

      return false;
    } catch (error) {
      console.error(
        `[TokenRevocation] Error checking revocation for ${jti}:`,
        error,
      );
      // Conservative approach: treat as revoked on error
      return true;
    }
  }

  /**
   * REMOVED: revokeAllUserTokens() and areAllUserTokensRevoked()
   * These methods created user:revoked_all:{userId} keys that were never checked.
   * Use NotificationService.forceLogoutUser() instead, which properly:
   * - Deletes giftthem_user_jwt_{userId} from Redis
   * - Broadcasts force_logout event via WebSocket
   * - Disconnects all user sockets
   * JWT validation checks giftthem_user_jwt_{userId} existence, so no separate revocation key needed.
   */

  /**
   * Cleanup expired revoked tokens from memory
   * Called periodically to prevent memory leaks
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [jti, expiresAt] of this.revokedTokens.entries()) {
      if (expiresAt < now) {
        this.revokedTokens.delete(jti);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(
        `[TokenRevocation] Cleaned up ${cleaned} expired tokens from memory`,
      );
    }
  }

  /**
   * Get revocation stats for monitoring
   */
  getStats(): { revokedInMemory: number } {
    return {
      revokedInMemory: this.revokedTokens.size,
    };
  }
}
