/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  ONE_MINUTE: 60,
  TWO_MINUTES: 120,
  FIVE_MINUTES: 300,
  TEN_MINUTES: 600,
  FIFTEEN_MINUTES: 900,
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
  SIX_HOURS: 21600,
  TWELVE_HOURS: 43200,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
  ONE_MONTH: 2592000,
} as const;

/**
 * Cache Prefix constants for modularity
 */
export const CACHE_PREFIX = {
  AUTH: 'auth',
  USER: 'user',
  OTP: 'otp',
  TOKEN: 'token',
  PRODUCT: 'product',
  CATEGORY: 'category',
  ORDER: 'order',
  SESSION: 'session',
  RATE_LIMIT: 'rl',
} as const;

/**
 * Standardized Cache Keys
 * These functions ensure consistent key naming throughout the application.
 */
export const CACHE_KEYS = {
  // Auth & Session
  AUTH_USER_SESSION: (userId: string | number) => `f2h_user_jwt_${userId}`,
  AUTH_USER_EMAIL_SESSION: (email: string) => `f2h_user_jwt_email_${email}`,
  AUTH_REVOKED_TOKEN: (jti: string) => `token:revoked:${jti}`,
  AUTH_PASSWORD_RESET: (tokenHash: string) => `password_reset_${tokenHash}`,
  AUTH_MOBILE_OTP: (phone: string) => `otp_${phone}`,
  AUTH_WS_TICKET: (ticket: string) => `ws_ticket_${ticket}`,
  AUTH_EMAIL_VERIFY: (email: string) => `email_verify_${email}`,

  // OTP Rate Limiting (Matching existing implementations)
  OTP_RATE_LIMIT: (phone: string) => `otp_rate_limit_${phone}`,
  OTP_DAILY_LIMIT: (phone: string) => `otp_daily_limit_${phone}`,
  OTP_VERIFY_ATTEMPTS: (phone: string) => `otp_verify_attempts_${phone}`,

  // User Data
  USER_PROFILE: (userId: string | number) => `user:profile:${userId}`,
  USER_ROLES: (userId: string | number) => `user:roles:${userId}`,
  USER_PERMISSIONS: (userId: string | number) => `user:permissions:${userId}`,

  // Products & Categories
  PRODUCT_DETAILS: (id: string | number) => `product:details:${id}`,
  PRODUCT_LIST_ALL: 'product:list:all',
  PRODUCT_CATEGORY_LIST: (categoryId: string | number) =>
    `product:category:${categoryId}`,
  CATEGORY_LIST_ALL: 'category:list:all',

  // Settings
  SYSTEM_SETTINGS: 'system:settings',
  APP_CONFIG: 'app:config',
} as const;
