import { Module } from '@nestjs/common';
import { AppAssetsController } from './controllers/app_assets.controller';
import { AppAssetsService } from './ModuleServices/app_assets.service';

@Module({
  controllers: [AppAssetsController],
  providers: [AppAssetsService],
  exports: [AppAssetsService],
})
export class CustomerAppAssetsModule {}
