import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Audit Logger Service
 * Provides structured logging for security and compliance events
 * Logs are persisted to disk with daily rotation and 90-day retention
 */
@Injectable()
export class AuditLoggerService {
  private logger: winston.Logger;

  constructor() {
    // Setup daily rotate file transport
    const dailyRotateFileTransport = new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '90d', // Retain 90 days of logs
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }) as any;

    // Setup error log transport (critical events only)
    const errorFileTransport = new DailyRotateFile({
      filename: 'logs/auth-critical-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '180d', // Retain 180 days of critical events
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }) as any;

    // Create logger instance
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: {
        service: 'auth',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        dailyRotateFileTransport,
        errorFileTransport,
        // Also log to console in development
        ...(process.env.NODE_ENV !== 'production'
          ? [
              new winston.transports.Console({
                format: winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple(),
                ),
              }),
            ]
          : []),
      ],
    });
  }

  /**
   * Log successful login
   */
  logLoginSuccess(data: {
    userId: string;
    email: string;
    ip: string;
    userAgent: string;
    provider?: string; // 'local', 'google', 'github', etc.
  }): void {
    this.logger.info('LOGIN_SUCCESS', {
      event: 'LOGIN_SUCCESS',
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      userAgent: data.userAgent,
      provider: data.provider || 'local',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log failed login
   */
  logLoginFailure(data: {
    email?: string;
    identifier: string;
    ip: string;
    reason: string;
    attempt: number;
  }): void {
    this.logger.warn('LOGIN_FAILURE', {
      event: 'LOGIN_FAILURE 1',
      identifier: data.identifier,
      email: data.email,
      ip: data.ip,
      reason: data.reason,
      attempt: data.attempt,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log account lockout
   */
  logAccountLockout(data: {
    userId: string;
    email: string;
    ip: string;
    reason: string;
  }): void {
    this.logger.error('ACCOUNT_LOCKOUT', {
      event: 'ACCOUNT_LOCKOUT',
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      reason: data.reason,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
    });
  }

  /**
   * Log token operations (generation, refresh, revocation)
   */
  logTokenOperation(data: {
    operation: 'GENERATED' | 'REVOKED' | 'REFRESHED' | 'VERIFICATION_FAILED';
    userId: string;
    email?: string;
    jti?: string;
    jtis?: { access?: string; refresh?: string };
    tokenType?: 'access' | 'refresh';
    ip?: string;
    reason?: string;
  }): void {
    const event =
      data.operation === 'VERIFICATION_FAILED'
        ? 'TOKEN_VERIFICATION_FAILED'
        : `TOKEN_${data.operation}`;

    this.logger.info('TOKEN_OPERATION', {
      event: event,
      userId: data.userId,
      email: data.email,
      jti: data.jti ? data.jti.substring(0, 8) + '...' : undefined,
      accessJti: data.jtis?.access
        ? data.jtis.access.substring(0, 8) + '...'
        : undefined,
      refreshJti: data.jtis?.refresh
        ? data.jtis.refresh.substring(0, 8) + '...'
        : undefined,
      tokenType: data.tokenType,
      ip: data.ip,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log logout
   */
  logLogout(data: {
    userId: string;
    email: string;
    ip: string;
    accessTokenJti?: string;
    refreshTokenJti?: string;
  }): void {
    this.logger.info('LOGOUT', {
      event: 'LOGOUT',
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      accessTokenJti: data.accessTokenJti?.substring(0, 8),
      refreshTokenJti: data.refreshTokenJti?.substring(0, 8),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log password change / reset
   */
  logPasswordChange(data: {
    userId?: string;
    email: string;
    ip?: string;
    method: 'reset' | 'change' | 'oauth_auto_generated' | 'secure_link';
  }): void {
    this.logger.info('PASSWORD_CHANGED', {
      event: 'PASSWORD_CHANGED',
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      method: data.method,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log password reset request
   */
  logPasswordResetRequested(data: {
    email: string;
    ip?: string;
    found: boolean; // Was the email found in system
  }): void {
    this.logger.warn('PASSWORD_RESET_REQUESTED', {
      event: 'PASSWORD_RESET_REQUESTED',
      email: data.email,
      ip: data.ip,
      userFound: data.found,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log OTP and Reset Link operations
   */
  logOtpOperation(data: {
    operation:
      | 'SENT'
      | 'VERIFIED'
      | 'VERIFICATION_FAILED'
      | 'EXPIRED'
      | 'RESET_LINK_SENT'
      | 'RESET_LINK_SENT_SMS'
      | 'RESET_TOKEN_INVALID'
      | 'RESET_TOKEN_EMAIL_MISMATCH'
      | 'RESET_TOKEN_VERIFIED';
    phone?: string;
    email?: string;
    ip?: string;
    attempt?: number;
  }): void {
    this.logger.info('OTP_OPERATION', {
      event: `OTP_${data.operation}`,
      phone: data.phone,
      email: data.email,
      ip: data.ip,
      attempt: data.attempt,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log OTP brute force attempt / lockout
   */
  logOtpBruteForceAttempt(data: {
    phone?: string;
    email?: string;
    ip: string;
    attemptCount: number;
  }): void {
    this.logger.error('OTP_BRUTE_FORCE_ATTEMPT', {
      event: 'OTP_BRUTE_FORCE_ATTEMPT',
      phone: data.phone,
      email: data.email,
      ip: data.ip,
      attemptCount: data.attemptCount,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    });
  }

  /**
   * Log OAuth operations
   */
  logOAuthOperation(data: {
    operation: 'LOGIN' | 'AUTO_REGISTER' | 'LINK_ACCOUNT';
    provider: string;
    email: string;
    userId?: string;
    ip?: string;
    newUser?: boolean;
  }): void {
    this.logger.info('OAUTH_OPERATION', {
      event: `OAUTH_${data.operation}`,
      provider: data.provider,
      email: data.email,
      userId: data.userId,
      ip: data.ip,
      newUser: data.newUser,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log suspicious activity / potential attacks
   */
  logSuspiciousActivity(data: {
    activity: string;
    details: Record<string, any>;
    userId?: string;
    email?: string;
    ip?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): void {
    this.logger.warn('SUSPICIOUS_ACTIVITY', {
      event: 'SUSPICIOUS_ACTIVITY',
      activity: data.activity,
      details: data.details,
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      severity: data.severity,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log permission or role changes
   */
  logPermissionChange(data: {
    userId: string;
    email: string;
    action:
      | 'ROLE_ASSIGNED'
      | 'ROLE_REMOVED'
      | 'PERMISSION_GRANTED'
      | 'PERMISSION_REVOKED';
    targetUserId?: string;
    targetRole?: string;
    changedBy: string; // User who made the change
    ip?: string;
  }): void {
    this.logger.info('PERMISSION_CHANGE', {
      event: 'PERMISSION_CHANGE',
      action: data.action,
      userId: data.userId,
      email: data.email,
      targetUserId: data.targetUserId,
      targetRole: data.targetRole,
      changedBy: data.changedBy,
      ip: data.ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log API errors and exceptions
   */
  logAuthError(data: {
    error: string;
    errorCode?: string;
    userId?: string;
    email?: string;
    ip?: string;
    endpoint?: string;
    stack?: string;
  }): void {
    this.logger.error('AUTH_ERROR', {
      event: 'AUTH_ERROR',
      error: data.error,
      errorCode: data.errorCode,
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      endpoint: data.endpoint,
      stack: data.stack,
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM',
    });
  }

  /**
   * Get audit log statistics
   */
  getStats(): Record<string, any> {
    return {
      message: 'Audit logging active',
      logsLocation: 'logs/',
      retention: '90 days for audit logs, 180 days for critical events',
      timestamp: new Date().toISOString(),
    };
  }
}
