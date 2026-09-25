import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { NotificationModule } from 'src/notifications/notification.module';
import { RedisModule } from 'src/shared/redis/redis.module';
import { MailService } from 'src/mail/mail.service';
import { SmsService } from 'src/shared/sms/sms.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    NotificationModule,
    RedisModule,
  ],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    DataService,
    DatabaseService,
    DeveloperService,
    MailService,
    SmsService,
  ],
  exports: [ProfileService],
})
export class DeliveryPartnerProfileModule {}

