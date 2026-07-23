import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  SubscriptionsController,
} from './controllers/subscriptions.controller';
import { SubscriptionsService } from './ModuleServices/subscriptions.service';

@Module({
  imports: [ConfigModule],
  controllers: [SubscriptionsController],
  providers: [DeveloperService, SubscriptionsService],
})
export class CustomerSubscriptionsModule { }