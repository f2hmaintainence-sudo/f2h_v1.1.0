import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
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
  @Get('products')
  async getProductsList() {
    return this.vendorsService.getProductsList();
  }

  @Public()
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerVendor(@Body() dto: RegisterVendorDto) {
    return this.vendorsService.registerVendor(dto);
  }

  // =========================================================================
  // VENDOR COLLECTIONS & INTAKE ENDPOINTS
  // =========================================================================

  @Public()
  @Get('collections')
  async getCollections(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('shift') shift?: string,
    @Query('vendorId') vendorId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('summary') summary?: string,
  ) {
    return this.vendorsService.getCollections({
      date,
      startDate,
      endDate,
      type,
      shift,
      vendorId,
      category,
      search,
      status,
      summary: summary === 'true',
    });
  }

  @Public()
  @Post('collections')
  async createCollection(@Body() body: any) {
    return this.vendorsService.createCollection(body);
  }

  @Public()
  @Get('collections/:id')
  async getCollectionById(@Param('id') id: string) {
    return this.vendorsService.getCollectionById(id);
  }

  @Public()
  @Patch('collections/:id')
  async updateCollection(@Param('id') id: string, @Body() body: any) {
    return this.vendorsService.updateCollection(id, body);
  }

  @Public()
  @Delete('collections/:id')
  async deleteCollection(@Param('id') id: string) {
    return this.vendorsService.deleteCollection(id);
  }

  // =========================================================================
  // SINGLE VENDOR PROFILE CRUD (BY ID OR VENDOR_ID)
  // =========================================================================

  @Public()
  @Get(':id')
  async getVendorById(@Param('id') id: string) {
    return this.vendorsService.getVendorById(id);
  }

  @Public()
  @Patch(':id')
  async updateVendor(@Param('id') id: string, @Body() body: any) {
    return this.vendorsService.updateVendor(id, body);
  }

  @Public()
  @Delete(':id')
  async deleteVendor(@Param('id') id: string) {
    return this.vendorsService.deleteVendor(id);
  }
}


