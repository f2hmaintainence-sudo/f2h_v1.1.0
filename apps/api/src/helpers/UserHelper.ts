import {
  Injectable,
  Scope,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';

/**
 * Interface for cached user data structure
 */
export interface CachedUserData {
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  roles: Array<{
    role_id: string;
    name: string;
  }>;
  is_admin: boolean;
  navigations?: Array<{
    role_id: string;
    role_name: string;
    navigation: Array<{
      name: string;
      icon: string;
      sections: Array<{
        name: string;
        route: string;
        icon: string;
        items: Array<{
          name: string;
          route: string;
          icon: string;
        }>;
      }>;
    }>;
  }>;
}

/**
 * UserHelper Service - Universal helper to fetch current user data from Redis
 *
 * Usage in any service/controller:
 * 1. Inject UserHelper in constructor
 * 2. Call await this.userHelper.getCurrentUser('field_name')
 *
 * @example
 * constructor(private readonly userHelper: UserHelper) {}
 *
 * async someMethod() {
 *   const userId = await this.userHelper.getCurrentUser('user_id');
 *   const email = await this.userHelper.getCurrentUser('email');
 *   const userData = await this.userHelper.getCurrentUser();
 * }
 */
@Injectable({ scope: Scope.REQUEST })
export class UserHelper {
  constructor(
    @Inject(REQUEST) private readonly request: any,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get current user data from Redis cache
   * Automatically fetches user_id from JWT request and retrieves cached data
   *
   * @param field - Field name to return (e.g., 'user_id', 'username', 'email', 'first_name', 'last_name', 'roles', 'is_admin')
   *                If not provided, returns the full user object
   * @returns Specific field value or full user object
   * @throws UnauthorizedException if user is not authenticated or data not found
   *
   * @example
   * const userId = await this.userHelper.getCurrentUser('user_id');
   * const username = await this.userHelper.getCurrentUser('username');
   * const email = await this.userHelper.getCurrentUser('email');
   * const firstName = await this.userHelper.getCurrentUser('first_name');
   * const fullData = await this.userHelper.getCurrentUser();
   */
  async getCurrentUser(field?: string): Promise<any> {
    const env = (globalThis as any).process?.env ?? {};
    // Step 1: Extract user_id from JWT request
    const userId =
      this.request.user?.user_id ||
      this.request.user?.sub ||
      this.request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Step 2: Fetch user data from Redis using key: {prefix}_user_data_{user_id}
    const redisPrefix = env.REDIS_PREFIX || 'giftthem';
    const cacheKey = `${redisPrefix}_user_data_${userId}`;
    const cachedUser = await this.redisService.fetch<CachedUserData>(cacheKey);

    if (!cachedUser) {
      throw new UnauthorizedException('User data not found in cache');
    }

    // Step 3: Parse cached data if it's a string
    let userData: CachedUserData;
    if (typeof cachedUser === 'string') {
      try {
        userData = JSON.parse(cachedUser);
      } catch (error) {
        throw new UnauthorizedException('Invalid user data format');
      }
    } else {
      userData = cachedUser;
    }

    // Step 4: Return specific field if requested, otherwise return full user data
    if (field && field in userData) {
      return userData[field as keyof CachedUserData];
    }

    if (field) {
      // Field requested but not found in user data
      return null;
    }

    // Return full user data
    return userData;
  }

  /**
   * Get user data by specific user_id (not from JWT, but by provided user_id)
   * Useful for admin operations or fetching other users' data
   *
   * @param userId - User ID to fetch
   * @param field - Field name to return (e.g., 'user_id', 'username', 'email', etc.)
   *                If not provided, returns the full user object
   * @returns Specific field value or full user object
   * @throws Error if user data not found
   *
   * @example
   * const otherUserData = await this.userHelper.getUserById('USRJK8XWYPQN');
   * const otherUserEmail = await this.userHelper.getUserById('USRJK8XWYPQN', 'email');
   */
  async getUserById(userId: string, field?: string): Promise<any> {
    const env = (globalThis as any).process?.env ?? {};
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Fetch user data from Redis using key: giftthem_user_data_{user_id}
    const redisPrefix = env.REDIS_PREFIX || 'giftthem';
    const cacheKey = `${redisPrefix}_user_data_${userId}`;
    const cachedUser = await this.redisService.fetch<CachedUserData>(cacheKey);

    if (!cachedUser) {
      throw new Error(`User data not found for user_id: ${userId}`);
    }

    // Parse cached data if it's a string
    let userData: CachedUserData;
    if (typeof cachedUser === 'string') {
      try {
        userData = JSON.parse(cachedUser);
      } catch (error) {
        throw new Error('Invalid user data format');
      }
    } else {
      userData = cachedUser;
    }

    // Return specific field if requested, otherwise return full user data
    if (field && field in userData) {
      return userData[field as keyof CachedUserData];
    }

    if (field) {
      // Field requested but not found in user data
      return null;
    }

    // Return full user data
    return userData;
  }
}
