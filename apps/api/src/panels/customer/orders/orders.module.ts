import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { RedisModule } from 'src/shared/redis/redis.module';
import { CustomerOrderController } from './controllers/customer.order.controller';

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [CustomerOrderController],
  providers: [DeveloperService],
})
export class CustomerOrdersModule { }