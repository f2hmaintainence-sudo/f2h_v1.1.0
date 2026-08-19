import { Controller, Get } from '@nestjs/common';
import { AppAssetsService } from '../ModuleServices/app_assets.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('customer/assets')
export class AppAssetsController {
  constructor(private readonly service: AppAssetsService) {}

  @Public()
  @Get()
  async getAppAssets() {
    return this.service.getAppAssets();
  }
}
