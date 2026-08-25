import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RedisModule } from '../shared/redis/redis.module';
import { DataService } from '../shared/database/Data.service';
import { DatabaseService } from '../shared/database/Database.service';
import { DeveloperService } from '../shared/logger/Developer.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RoleResolverService } from '../auth/role-resolver.service';

@Module({
  imports: [JwtModule, RedisModule, EventEmitterModule],
  controllers: [NotificationController],
  providers: [
    NotificationGateway,
    NotificationService,
    RoleResolverService,
    DeveloperService,
    DatabaseService,
    DataService,
  ],
  exports: [NotificationGateway, NotificationService],
})
export class NotificationModule {}
