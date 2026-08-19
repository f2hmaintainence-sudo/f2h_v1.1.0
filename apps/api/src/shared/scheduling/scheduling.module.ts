import { Global, Module } from '@nestjs/common';
import { RedisModule } from 'src/shared/redis/redis.module';
import { CronLockService } from './cron-lock.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [CronLockService],
  exports: [CronLockService],
})
export class SchedulingModule {}
