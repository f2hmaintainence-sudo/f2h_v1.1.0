import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ContainersService } from './containers.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/catalog/containers', version: '1' })
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Get()
  async getContainers(@Query() query: any) {
    return this.containersService.getContainers(query);
  }

  @Get('dropdown')
  async getContainersDropdown() {
    return this.containersService.getContainersDropdown();
  }

  @Post()
  async createContainer(@Body() body: any) {
    return this.containersService.createContainer(body);
  }

  @Post('warehouse-stock')
  async adjustWarehouseStock(@Body() body: any) {
    return this.containersService.adjustWarehouseStock(body);
  }

  @Put(':id')
  async updateContainer(@Param('id') id: string, @Body() body: any) {
    return this.containersService.updateContainer(id, body);
  }
}
