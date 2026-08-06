import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RedisModule } from '../shared/redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { DataService } from '../shared/database/Data.service';
import { DatabaseService } from '../shared/database/Database.service';
import { DeveloperService } from '../shared/logger/Developer.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [JwtModule, RedisModule, DatabaseModule, EventEmitterModule],
  controllers: [NotificationController],
  providers: [
    NotificationGateway,
    NotificationService,
    
    
    DeveloperService],
  exports: [NotificationGateway, NotificationService],
})
export class NotificationModule {}
