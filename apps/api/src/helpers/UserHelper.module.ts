import { Global, Module } from '@nestjs/common';
import { UserHelper } from './UserHelper';
import { RedisModule } from '../shared/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [UserHelper],
  exports: [UserHelper],
})
export class UserHelperModule {}
