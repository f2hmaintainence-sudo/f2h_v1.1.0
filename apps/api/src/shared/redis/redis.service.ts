import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private redisPrefix: string;
  private prefixWarnLogged = false;
  private isConnected = false;
  private readonly logger = new Logger(RedisService.name);

  onModuleInit(): void {
    this.redisPrefix = process.env.REDIS_PREFIX || '';
    const redisUrl = process.env.REDIS_URL || '';
    try {
      if (redisUrl) {
        this.redis = new Redis(redisUrl);
      } else {
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        const password = process.env.REDIS_PASSWORD;
        const opts: RedisOptions = { host, port };
        if (password) opts.password = password;
        this.redis = new Redis(opts);
      }
      this.redis.on('error', (err) => {
        this.isConnected = false;
        this.logger.error(
          `Connection error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected successfully');
      });
      this.redis.on('close', () => {
        this.isConnected = false;
      });
    } catch (error) {
      this.logger.error(
        `Failed to initialize Redis: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Gracefully disconnect from Redis on module destruction.
   */
  onModuleDestroy(): void {
    if (this.redis) {
      this.redis.disconnect();
      this.isConnected = false;
    }
  }

  /*===============================================================================================
      Prefix Handling & JSON Parsing
    ================================================================================================*/
  /**
   * @param key
   * @returns
   */
  private prefixKey(key: string): string {
    if (!this.redisPrefix) {
      if (!this.prefixWarnLogged) {
        this.logger.warn(
          'REDIS_PREFIX not configured; using keys without prefix',
        );
        this.prefixWarnLogged = true;
      }
      return key;
    }
    if (key.startsWith(`${this.redisPrefix}:`)) return key;
    return `${this.redisPrefix}:${key}`;
  }

  /*===============================================================================================
       parseJSON - Robust JSON parsing with fallback
     ================================================================================================*/
  /**
   * @param data - String to parse as JSON
   * @returns Parsed object or raw string
   */
  private parseJSON<T = any>(data: string): T | string {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data;
    }
  }

  /*===============================================================================================
       Core Redis Operations
     ================================================================================================*/
  /**
   * @returns Redis instance
   */
  getRedis(): Redis {
    return this.redis;
  }

  /*===============================================================================================
       Health Check & Utility Methods
     ================================================================================================*/
  /**
   * @returns PONG on success, null on failure
   */
  async ping(): Promise<string | null> {
    try {
      if (!this.redis) return null;
      return await this.redis.ping();
    } catch (error) {
      this.logger.debug(
        `Ping failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  getIsConnected(): boolean {
    return this.isConnected && !!this.redis;
  }
  /*===============================================================================================
      Clear Pattern & Cache Operations
     ================================================================================================*/
  /**
   * @param pattern - Pattern to match (e.g., "user:*:data")
   * @param batchSize - Number of keys per scan iteration (default: 100)
   * @returns Number of keys deleted
   */
  async clearPattern(
    pattern: string,
    batchSize: number = 100,
  ): Promise<number> {
    try {
      if (!this.redis) return 0;
      const effectivePattern =
        this.redisPrefix && !pattern.startsWith(`${this.redisPrefix}:`)
          ? `${this.redisPrefix}:${pattern}`
          : pattern;
      let cursor = '0';
      let deleted = 0;
      const pipeline = this.redis.pipeline();
      do {
        const [nextCursor, keys] = (await this.redis.scan(
          cursor,
          'MATCH',
          effectivePattern,
          'COUNT',
          batchSize.toString(),
        )) as [string, string[]];
        if (keys.length > 0) {
          keys.forEach((key) => pipeline.del(key));
          deleted += keys.length;
        }
        cursor = nextCursor;
      } while (cursor !== '0');
      if ((pipeline as any).length > 0) {
        await pipeline.exec();
      }
      return deleted;
    } catch (error) {
      this.logger.error(
        `Error clearing pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /*===============================================================================================
      put the data in redis with json stringify and ttl
     ================================================================================================*/
  /**
   * @param key - Redis key
   * @param value - Value to store (object, array, primitive, or string)
   * @param ttl - Time to live in seconds (default: 3600 = 1 hour)
   */
  async put(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      const pKey = this.prefixKey(key);
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      await this.redis.setex(pKey, ttl, stringValue);
    } catch (error) {
      this.logger.error(
        `Error storing key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Alias for put() to match benchmark expectations.
   */
  async store(key: string, value: any, ttl: number = 3600): Promise<void> {
    return this.put(key, value, ttl);
  }

  /*===============================================================================================
       fetch the data from redis and parse it with json parse
     ================================================================================================*/
  /**
   * @param key - Redis key
   * @returns Typed value, string, or null if not found
   */
  async fetch<T = any>(key: string): Promise<T | string | null> {
    try {
      if (!this.redis) return null;
      const pKey = this.prefixKey(key);
      const data = await this.redis.get(pKey);
      if (data == null) return null;
      return this.parseJSON<T>(data);
    } catch (error) {
      this.logger.error(
        `Error fetching key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /*===============================================================================================
       Hash Operations
     ================================================================================================*/
  /**
   * @param key - Redis key
   * @returns All fields and values in the hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      if (!this.redis) return {};
      const pKey = this.prefixKey(key);
      return await this.redis.hgetall(pKey);
    } catch (error) {
      this.logger.error(
        `Error in hgetall("${key}"): ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  }

  /**
   * Set hash fields.
   * @param key - Redis key
   * @param data - Object containing field-value pairs
   */
  async hset(key: string, data: Record<string, any>): Promise<number> {
    try {
      if (!this.redis) return 0;
      const pKey = this.prefixKey(key);
      return await this.redis.hset(pKey, data);
    } catch (error) {
      this.logger.error(
        `Error in hset("${key}"): ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Get a single hash field.
   * @param key - Redis key
   * @param field - Field name
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      if (!this.redis) return null;
      const pKey = this.prefixKey(key);
      return await this.redis.hget(pKey, field);
    } catch (error) {
      this.logger.error(
        `Error in hget("${key}", "${field}"): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
  /*===============================================================================================
      has - Check if a key exists in Redis
    ================================================================================================*/
  /**
   * @param key - Redis key
   * @returns true if key exists, false otherwise
   */
  async has(key: string): Promise<boolean> {
    try {
      if (!this.redis) return false;
      const pKey = this.prefixKey(key);
      const exists = await this.redis.exists(pKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(
        `Error checking key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /*===============================================================================================
      forget - Delete a key from Redis
    ================================================================================================*/
  /**
   * @param key - Redis key
   */
  async forget(key: string): Promise<void> {
    try {
      if (!this.redis) return;
      const pKey = this.prefixKey(key);
      await this.redis.del(pKey);
    } catch (error) {
      this.logger.error(
        `Error deleting key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Alias for forget() to match benchmark expectations.
   */
  async delete(key: string): Promise<void> {
    return this.forget(key);
  }

  /*===============================================================================================
      Batch delete multiple keys from Redis
    ================================================================================================*/
  /**
   * @param keys - Array of Redis keys
   */
  async forgetMany(keys: string[]): Promise<number> {
    try {
      if (!this.redis || keys.length === 0) return 0;
      const pKeys = keys.map((k) => this.prefixKey(k));
      return await this.redis.del(...pKeys);
    } catch (error) {
      this.logger.error(
        `Error deleting multiple keys: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /*===============================================================================================
      ttl - Get remaining time-to-live for a key
    ================================================================================================*/
  /**
   * @param key - Redis key
   * @returns TTL in seconds, -1 if no expiry, -2 if not found, null on error
   */
  async ttl(key: string): Promise<number | null> {
    try {
      if (!this.redis) return null;
      const pKey = this.prefixKey(key);
      return await this.redis.ttl(pKey);
    } catch (error) {
      this.logger.error(
        `Error getting TTL for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /*===============================================================================================
       ttl - Get remaining time-to-live for a key
     ================================================================================================*/
  /**
   * @param key - Redis key
   * @param ttl - Time to live in seconds
   * @param factory - Function to compute value on cache miss
   * @returns Cached or computed value
   */
  async remember<T = any>(
    key: string,
    ttl: number,
    factory: () => Promise<T> | T,
  ): Promise<T | string | null> {
    try {
      if (!this.redis) {
        return await factory();
      }
      const existing = await this.fetch<T>(key);
      if (existing !== null) return existing as T;
      const value = await factory();
      await this.put(key, value, ttl);
      return value as T;
    } catch (error) {
      this.logger.error(
        `Error in remember("${key}"): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /*===============================================================================================
       increment & decrement - Atomic counter operations
     ================================================================================================*/
  /**
   * @param key - Redis key
   * @param increment - Amount to increment by (default: 1)
   * @returns New value after increment, null on error
   */
  async increment(key: string, increment: number = 1): Promise<number | null> {
    try {
      if (!this.redis) return null;
      const pKey = this.prefixKey(key);
      return await this.redis.incrby(pKey, increment);
    } catch (error) {
      this.logger.error(
        `Error incrementing key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * @param key - Redis key
   * @param decrement - Amount to decrement by (default: 1)
   * @returns New value after decrement, null on error
   */
  async decrement(key: string, decrement: number = 1): Promise<number | null> {
    try {
      if (!this.redis) return null;
      const pKey = this.prefixKey(key);
      return await this.redis.decrby(pKey, decrement);
    } catch (error) {
      this.logger.error(
        `Error decrementing key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

export * from './cache.constants';
