import { Module, Global } from '@nestjs/common';
import { DiscountEngineService } from './discount-engine.service';
import { DatabaseService } from '../database/Database.service';

@Global()
@Module({
  providers: [DatabaseService, DiscountEngineService],
  exports: [DiscountEngineService],
})
export class DiscountEngineModule {}
