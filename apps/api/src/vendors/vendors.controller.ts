import { Controller, Get, Post, Body, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller({ path: 'vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Public()
  @Get('public')
  async getPublicVendors(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.vendorsService.getPublicVendors(category, search);
  }

  @Public()
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerVendor(@Body() dto: RegisterVendorDto) {
    return this.vendorsService.registerVendor(dto);
  }
}
