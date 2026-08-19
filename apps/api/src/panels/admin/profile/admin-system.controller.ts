import { Controller, Get, Post, Patch, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AdminSystemService } from './admin-system.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/system', version: '1' })
export class AdminSystemController {
  constructor(private readonly systemService: AdminSystemService) {}

  // ── Admin Users ──

  @Get('admins')
  async getAdminUsers(@Query() query: any) {
    return this.systemService.getAdminUsers(query);
  }

  @Patch('admins/:id')
  async updateAdminUser(@Param('id') id: string, @Body() body: any) {
    return this.systemService.updateAdminUser(id, body);
  }

  // ── Roles & Permissions ──

  @Get('roles')
  async getRoles() {
    return this.systemService.getRoles();
  }

  @Post('roles')
  async createRole(@Body() body: any) {
    return this.systemService.createRole(body);
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() body: any) {
    return this.systemService.updateRole(id, body);
  }

  // ── Notification Settings ──

  @Get('notifications')
  async getNotificationSettings() {
    return this.systemService.getNotificationSettings();
  }

  @Post('notifications')
  async createNotificationSetting(@Body() body: any, @Req() req: any) {
    console.log('[AdminSystemController] 📥 createNotificationSetting endpoint called, req.user:', req.user);
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    console.log('[AdminSystemController] Resolved adminId:', adminId);
    return this.systemService.createNotificationSetting(body, adminId);
  }

  @Patch('notifications/:id')
  async updateNotificationSetting(
    @Param('id') id: string, @Body() body: any, @Req() req: any,
  ) {
    console.log('[AdminSystemController] 📥 updateNotificationSetting endpoint called, req.user:', req.user);
    const adminId = req.user?.user_id ?? req.user?.id ?? 'system';
    console.log('[AdminSystemController] login user id:', adminId);
    return this.systemService.updateNotificationSetting(id, body, adminId);
  }

  // ── Audit Logs ──

  @Get('audit')
  async getAuditLogs(@Query() query: any) {
    return this.systemService.getAuditLogs(query);
  }

  // ── Version Control ──

  @Get('version-control')
  async getAppConfigs() {
    return this.systemService.getAppConfigs();
  }

  @Patch('version-control/:platform')
  async updateAppConfig(@Param('platform') platform: string, @Body() body: any) {
    return this.systemService.updateAppConfig(platform, body);
  }

  // ── Site Settings (footer / contact) ──

  @Get('site-settings')
  async getSiteSettings() {
    return this.systemService.getSiteSettings();
  }

  @Post('site-settings')
  async upsertSiteSettings(@Body() body: Record<string, any>) {
    return this.systemService.upsertSiteSettings(body);
  }
}
