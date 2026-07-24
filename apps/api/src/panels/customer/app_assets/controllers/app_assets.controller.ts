import { Controller, Get } from '@nestjs/common';
import { AppAssetsService } from '../ModuleServices/app_assets.service';

@Controller('customer/assets')
export class AppAssetsController {
  constructor(private readonly service: AppAssetsService) {}

  @Get()
  async getAppAssets() {
    return this.service.getAppAssets();
  }
}
