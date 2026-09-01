import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { UpdateCompanyProfileDto } from './company-profile.dto';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/profile', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post(['photo', 'image', 'avatar'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadProfilePhoto(@Req() req: any, @UploadedFile() file: any) {
    const userId = req.user?.user_id || req.user?.sub || req.user?.email;
    if (!userId) return { status: false, message: 'Unauthorized' };
    return this.profileService.uploadProfilePhoto(userId, file);
  }

  // ── My Profile (logged-in admin) ──
  @Get('me')
  async getMyProfile(@Req() req: any) {
    const userId = req.user?.user_id || req.user?.sub || req.user?.email;
    if (!userId) return { status: false, message: 'Unauthorized' };
    return this.profileService.getMyProfile(userId);
  }

  @Put('me')
  async updateMyProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.user_id || req.user?.sub || req.user?.email;
    if (!userId) return { status: false, message: 'Unauthorized' };
    return this.profileService.updateMyProfile(userId, body);
  }

  @Put('email')
  async updateEmail(@Req() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    if (!userId) return { status: false, message: 'Unauthorized' };
    return this.profileService.updateEmail(userId, body);
  }

  // ── Company Profile ──
  @Get('company')
  async getCompanyProfile() {
    return this.profileService.getCompanyProfile();
  }

  @Put('company')
  async updateCompanyProfile(@Body() body: UpdateCompanyProfileDto) {
    return this.profileService.updateCompanyProfile(body);
  }

  @Get('admins')
  async getAdminUsers(@Query() query: any) {
    return this.profileService.getAdminUsers(query);
  }

  @Get('roles')
  async getRoles() {
    return this.profileService.getRoles();
  }

  @Get('notifications')
  async getNotificationSettings() {
    return this.profileService.getNotificationSettings();
  }

  @Put('notifications')
  async updateNotificationSettings(@Body() body: any) {
    return this.profileService.updateNotificationSettings(body);
  }

  @Post('change-password')
  async changePassword(@Req() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    if (!userId) return { status: false, message: 'Unauthorized' };
    return this.profileService.changePassword(userId, body);
  }
}
