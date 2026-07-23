import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AdminSystemController } from './admin-system.controller';
import { AdminSystemService } from './admin-system.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { RedisModule } from '../../../shared/redis/redis.module';

@Module({
  imports: [HelpersModule, RedisModule],
  controllers: [ProfileController, AdminSystemController],
  providers: [ProfileService, AdminSystemService, DeveloperService],
  exports: [ProfileService, AdminSystemService],
})
export class ProfileManagementModule {}
