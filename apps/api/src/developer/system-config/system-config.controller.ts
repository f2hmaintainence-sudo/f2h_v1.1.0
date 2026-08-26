// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : system-config.controller.ts
// Description : Controller for developer system configurations & rules
// ============================================================================

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './system-config.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller({ path: 'admin/developer/config', version: '1' })
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  /**
   * Public endpoint for customer app & web to fetch fee rules, slot cutoffs, and thresholds.
   */
  @Public()
  @Get('public')
  async getPublicConfig() {
    return this.configService.getPublicConfig();
  }

  /**
   * Returns all system configuration sections (admin only).
   */
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllConfigs() {
    return this.configService.getAllConfigs();
  }

  /**
   * Returns a single configuration section by its key (admin only).
   */
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard)
  @Get(':key')
  async getConfigByKey(@Param('key') key: string) {
    return this.configService.getConfigByKey(key);
  }

  /**
   * Updates a configuration section (admin only).
   */
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard)
  @Put(':key')
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @Request() req: any,
  ) {
    const updatedBy = req.user?.user_id || req.user?.email || 'admin';
    return this.configService.updateConfig(key, dto, updatedBy);
  }
}
