import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from 'src/database/database.module';
import { RedisModule } from 'src/shared/redis/redis.module';
import { RolesModule } from 'src/roles/roles.module';
import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';
import { CustomerBootstrapController } from './customer-bootstrap.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MailService } from 'src/mail/mail.service';
import { NotificationModule } from 'src/notifications/notification.module';
import { CacheService } from 'src/cache/cache.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret)
          throw new Error(
            'CRITICAL: JWT_SECRET environment variable is not set',
          );
        return {
          secret,
          signOptions: { expiresIn: '100y' },
        };
      },
      inject: [ConfigService],
    }),
    NotificationModule,
    DatabaseModule,
    RedisModule,
    RolesModule,
    AuthModule,
  ],
  controllers: [CustomerBootstrapController],
  providers: [
    AuthService,
    MailService,
    DeveloperService,
    CacheService,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    CacheService,
    AuthModule,
  ],
})
export class CustomerAuthModule { }
