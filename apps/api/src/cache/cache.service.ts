import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DataService } from '../shared/database/Data.service';

/**
 * Production-grade caching service that handles non-critical operations asynchronously.
 * Caching is moved OUT of the critical auth path to prevent login latency.
 */
@Injectable()
export class CacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly Data: DataService,
  ) { }

  /*===============================================================================================
    cache User Data - Example of caching user data with role information
  ================================================================================================*/
  async buildUserCache(user_id: string): Promise<any> {
    const dbUser = await this.Data.query('users', {
      select: ['user_id', 'user_name', 'first_name', 'last_name', 'email', 'role_id'],
      where: [{ column: 'user_id', operator: '=', value: user_id }],
    });

    if (!dbUser?.status || !dbUser?.data?.length) {
      return null;
    }
    const userRecord = dbUser.data[0];
    const roleAssignments = await this.Data.query('role_assignments', {
      select: ['role_id'],
      where: [
        { column: 'user_id', operator: '=', value: user_id },
        { column: 'is_active', operator: '=', value: 1 },
      ],
    });
    let roles = [];
    let isAdmin = false;
    if (roleAssignments?.status && roleAssignments?.data?.length > 0) {
      const roleIds = roleAssignments.data.map((r) => r.role_id);
      const rolesData = await this.Data.query('roles', {
        select: ['role_id', 'name'],
        where: [
          { column: 'role_id', operator: 'IN', value: roleIds },
          { column: 'is_active', operator: '=', value: 1 },
        ],
      });
      if (rolesData?.status && rolesData?.data?.length > 0) {
        const seenRoleIds = new Set<string>();
        roles = rolesData.data.reduce((acc, role) => {
          if (!seenRoleIds.has(role.role_id)) {
            seenRoleIds.add(role.role_id);
            if (
              role.role_id === 'ADMIN' ||
              role.name?.toUpperCase() === 'ADMIN'
            ) {
              isAdmin = true;
            }
            acc.push({ role_id: role.role_id, name: role.name });
          }
          return acc;
        }, []);
      }
    }
    const cacheObject = {
      user_id: userRecord.user_id,
      username: userRecord.user_name,
      first_name: userRecord.first_name,
      last_name: userRecord.last_name,
      email: userRecord.email,
      roles,
      is_admin: isAdmin,
    };

    return cacheObject;
  }

  async get(key: string): Promise<any> {
    return this.redisService.fetch(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.redisService.put(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.redisService.forget(key);
  }
}
