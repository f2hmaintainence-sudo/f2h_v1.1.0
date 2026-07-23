// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api-integrations.controller.ts
// Description : Controller for developer API integrations configurations & DLT templates
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiIntegrationsService } from './api-integrations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller({ path: 'admin/developer/api-integrations', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApiIntegrationsController {
  constructor(private readonly apiIntegrationsService: ApiIntegrationsService) {}

  // ── Dedicated SMS DLT Templates Endpoints (must precede :category wildcard) ──
  @Get('sms/templates')
  async getSmsTemplates() {
    return this.apiIntegrationsService.getSmsTemplates();
  }

  @Post('sms/templates')
  async createSmsTemplate(@Body() body: any) {
    return this.apiIntegrationsService.saveSmsTemplate(body);
  }

  @Put('sms/templates/:id')
  async updateSmsTemplate(@Param('id') id: string, @Body() body: any) {
    return this.apiIntegrationsService.saveSmsTemplate({ ...body, id });
  }

  @Delete('sms/templates/:id')
  async deleteSmsTemplate(@Param('id') id: string) {
    return this.apiIntegrationsService.deleteSmsTemplate(id);
  }

  // ── Configs by Category (email, sms, firebase, payment-gateway) ──
  @Get(':category')
  async getConfigs(@Param('category') category: string) {
    if (category === 'templates') {
      return this.apiIntegrationsService.getSmsTemplates();
    }
    return this.apiIntegrationsService.getConfigsByCategory(category);
  }

  @Post(':category')
  async saveConfig(@Param('category') category: string, @Body() body: any) {
    if (category === 'templates') {
      return this.apiIntegrationsService.saveSmsTemplate(body);
    }
    return this.apiIntegrationsService.saveConfig(category, body);
  }

  @Put(':category/:id')
  async updateConfig(@Param('category') category: string, @Param('id') id: string, @Body() body: any) {
    if (category === 'templates') {
      return this.apiIntegrationsService.saveSmsTemplate({ ...body, id });
    }
    return this.apiIntegrationsService.saveConfig(category, { ...body, id });
  }

  @Delete(':category/:id')
  async deleteConfig(@Param('category') category: string, @Param('id') id: string) {
    if (category === 'templates') {
      return this.apiIntegrationsService.deleteSmsTemplate(id);
    }
    return this.apiIntegrationsService.deleteConfig(category, id);
  }
}
