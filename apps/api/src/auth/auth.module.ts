import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from 'src/shared/redis/redis.module';
import { NotificationModule } from 'src/notifications/notification.module';
import { EncryptionService } from './encryption.service';
import { TokenRevocationService } from './token-revocation.service';
import { AuditLoggerService } from './audit-logger.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { SecurityAlertsService } from './security-alerts.service';
import { PasswordSecurityService } from './password-security.service';
import { GoogleStrategy } from './social.strategies';
import { GoogleOAuthService } from './google-oauth.service';
import { MailService } from 'src/mail/mail.service';
import { FieldEncryptionModule } from 'src/encryption/field-encryption.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    NotificationModule,
    FieldEncryptionModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('CRITICAL: JWT_SECRET environment variable is not set');
        }
        return {
          secret,
          // Short-lived by default. A long-lived access token cannot be revoked
          // except through the Redis session registry, so the token's own expiry
          // has to be the primary control. Refresh tokens carry the long life.
          signOptions: {
            expiresIn: configService.get<string>(
              'JWT_ACCESS_EXPIRES_IN',
              '15m',
            ) as SignOptions['expiresIn'],
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EncryptionService,
    TokenRevocationService,
    AuditLoggerService,
    OtpRateLimitService,
    DeviceFingerprintService,
    SecurityAlertsService,
    PasswordSecurityService,
    GoogleStrategy,
    GoogleOAuthService,
    MailService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    EncryptionService,
    TokenRevocationService,
    AuditLoggerService,
    OtpRateLimitService,
    DeviceFingerprintService,
    SecurityAlertsService,
    PasswordSecurityService,
    GoogleStrategy,
    MailService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
