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
    const roleId = (userRecord.role_id || 'CUSTOMER').toString().toUpperCase().trim();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(roleId);
    const roles = [{ role_id: roleId, name: roleId }];

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
