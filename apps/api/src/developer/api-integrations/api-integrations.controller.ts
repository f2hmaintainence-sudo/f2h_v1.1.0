// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api-integrations.controller.ts
// Description : Controller for developer API integrations configurations & DLT templates
//
// ============================================================================

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiIntegrationsService } from './api-integrations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/developer/api-integrations', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApiIntegrationsController {
  constructor(private readonly apiIntegrationsService: ApiIntegrationsService) { }

  // ── DLT / Message Templates by Category (e.g. sms/templates) ──
  @Get(':category/templates')
  async getTemplates(@Param('category') category: string) {
    return this.apiIntegrationsService.getTemplatesByCategory(category);
  }

  @Post(':category/templates')
  async saveTemplate(@Param('category') category: string, @Body() body: any) {
    return this.apiIntegrationsService.saveTemplate(category, body);
  }

  @Put(':category/templates/:id')
  async updateTemplate(
    @Param('category') category: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.apiIntegrationsService.saveTemplate(category, { ...body, id });
  }

  @Delete(':category/templates/:id')
  async deleteTemplate(
    @Param('category') category: string,
    @Param('id') id: string,
  ) {
    return this.apiIntegrationsService.deleteTemplate(category, id);
  }

  // ── Configs by Category (email, sms, firebase, payment-gateway) ──
  @Get(':category')
  async getConfigs(@Param('category') category: string) {
    return this.apiIntegrationsService.getConfigsByCategory(category);
  }

  @Post(':category')
  async saveConfig(@Param('category') category: string, @Body() body: any) {
    return this.apiIntegrationsService.saveConfig(category, body);
  }

  @Put(':category/:id')
  async updateConfig(@Param('category') category: string, @Param('id') id: string, @Body() body: any) {
    return this.apiIntegrationsService.saveConfig(category, { ...body, id });
  }

  @Delete(':category/:id')
  async deleteConfig(@Param('category') category: string, @Param('id') id: string) {
    return this.apiIntegrationsService.deleteConfig(category, id);
  }
}
