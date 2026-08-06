import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from 'src/shared/redis/redis.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notification.module';
import { EncryptionService } from './encryption.service';
import { TokenRevocationService } from './token-revocation.service';
import { AuditLoggerService } from './audit-logger.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { SecurityAlertsService } from './security-alerts.service';
import { PasswordSecurityService } from './password-security.service';
import { GoogleStrategy } from './social.strategies';
import { MailService } from 'src/mail/mail.service';
import { FieldEncryptionModule } from 'src/encryption/field-encryption.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    DatabaseModule,
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
          signOptions: { expiresIn: '100y' },
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
