import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from 'src/database/database.module';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { NotificationModule } from 'src/notifications/notification.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    DatabaseModule,
    NotificationModule,
  ],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    DataService,
    DatabaseService,
    DeveloperService,
  ],
  exports: [ProfileService],
})
export class DeliveryPartnerProfileModule {}
