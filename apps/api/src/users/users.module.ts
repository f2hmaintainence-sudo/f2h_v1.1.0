import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { DatabaseService } from '../shared/database/Database.service';
import { RedisModule } from '../shared/redis/redis.module';
import { UsersController } from './users.controller';
import { DeveloperService } from 'src/shared/logger/Developer.service';
@Module({
  imports: [RolesModule, RedisModule],
  controllers: [UsersController],
  providers: [ DeveloperService],
})
export class UsersModule {}
