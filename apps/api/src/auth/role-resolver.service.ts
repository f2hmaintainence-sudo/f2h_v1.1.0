import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { RedisService } from 'src/shared/redis/redis.service';

const ROLE_CACHE_KEY = (userId: string) => `f2h_user_roles_${userId}`;
const ROLE_CACHE_TTL_SECONDS = 5 * 60;

/**
 * Resolves the roles a user actually holds, from the database rather than from the
 * JWT. A token issued before a role was revoked must stop opening that role's
 * routes without waiting for the token to rotate, so the guard never trusts the
 * `role` claim on its own.
 *
 * Roles live in two places: `role_assignments` (explicitly granted, used for staff)
 * and `users.role_id` (the account's primary role). Both count.
 */
@Injectable()
export class RoleResolverService {
  private readonly logger = new Logger(RoleResolverService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async resolveRoles(userId: string): Promise<string[]> {
    if (!userId) return [];

    const cacheKey = ROLE_CACHE_KEY(userId);
    const cached = await this.redis.fetch<string[]>(cacheKey).catch(() => null);
    if (cached) {
      const parsed = typeof cached === 'string' ? this.parse(cached) : cached;
      if (Array.isArray(parsed)) return parsed;
    }

    const roles = await this.loadFromDatabase(userId);

    // A miss is cached too: without it, an unknown user id re-queries on every request.
    await this.redis
      .put(cacheKey, JSON.stringify(roles), ROLE_CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return roles;
  }

  /** Call after any change to `role_assignments` or `users.role_id`. */
  async invalidate(userId: string): Promise<void> {
    if (!userId) return;
    await this.redis.forget(ROLE_CACHE_KEY(userId)).catch(() => undefined);
  }

  private async loadFromDatabase(userId: string): Promise<string[]> {
    try {
      const rows = await this.db.query<{ role_id: string }>(
        `SELECT UPPER(ra.role_id) AS role_id
           FROM role_assignments ra
          WHERE ra.user_id = $1
            AND ra.is_active = 1
            AND ra.deleted_at IS NULL
          UNION
         SELECT UPPER(u.role_id) AS role_id
           FROM users u
          WHERE u.user_id = $1
            AND u.role_id IS NOT NULL
            AND u.deleted_at IS NULL`,
        [userId],
      );

      return Array.from(
        new Set(
          (rows ?? [])
            .map((row) => (row.role_id ?? '').trim().toUpperCase())
            .filter(Boolean),
        ),
      );
    } catch (error) {
      // Failing open would hand every route to every token, so an unreachable
      // database means "no roles" — the guard then denies.
      this.logger.error(
        `Role resolution failed for user ${userId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private parse(value: string): string[] | null {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
