import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ProfileService } from './profile.service';
import {
  UpdatePersonalDto,
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  UpdatePreferencesDto,
  ChangePasswordDto,
  CreateLeaveRequestDto,
} from './dto/profile.dto';

@Roles(ROLE.DELIVERY_PARTNER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: ['delivery-partner/profile', 'DeliveryPartner/profile'], version: '1' })
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('personal')
  async getPersonalInfo(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getPersonalInfo(deliveryPartnerId);
  }

  @Patch('personal')
  async updatePersonalInfo(@Req() req: Request, @Body() dto: UpdatePersonalDto) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.updatePersonalInfo(deliveryPartnerId, dto);
  }

  @Post('personal/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadProfilePhoto(@Req() req: Request, @UploadedFile() file: any) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.uploadProfilePhoto(deliveryPartnerId, file);
  }

  @Get('documents')
  async getDocuments(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getDocuments(deliveryPartnerId);
  }

  @Post('documents')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front_image', maxCount: 1 },
        { name: 'back_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async createDocument(
    @Req() req: Request,
    @Body() dto: CreateDocumentDto,
    @UploadedFiles() files: { front_image?: any[]; back_image?: any[] },
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    const frontFile = files?.front_image?.[0];
    const backFile = files?.back_image?.[0];
    return this.profileService.createDocument(deliveryPartnerId, dto, {
      front_image: frontFile,
      back_image: backFile,
    });
  }

  @Patch('documents/:id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front_image', maxCount: 1 },
        { name: 'back_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async updateDocument(
    @Req() req: Request,
    @Param('id') docId: string,
    @Body() dto: UpdateDocumentDto,
    @UploadedFiles() files: { front_image?: any[]; back_image?: any[] },
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    const frontFile = files?.front_image?.[0];
    const backFile = files?.back_image?.[0];
    return this.profileService.updateDocument(deliveryPartnerId, docId, dto, {
      front_image: frontFile,
      back_image: backFile,
    });
  }

  @Delete('documents/:id')
  async deleteDocument(@Req() req: Request, @Param('id') docId: string) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.deleteDocument(deliveryPartnerId, docId);
  }

  @Get('vehicles')
  async getVehicles(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getVehicles(deliveryPartnerId);
  }

  @Post('vehicles')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rc_front_image', maxCount: 1 },
        { name: 'rc_back_image', maxCount: 1 },
        { name: 'insurance_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async createVehicle(
    @Req() req: Request,
    @Body() dto: CreateVehicleDto,
    @UploadedFiles()
    files: { rc_front_image?: any[]; rc_back_image?: any[]; insurance_image?: any[] },
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.createVehicle(deliveryPartnerId, dto, {
      rc_front_image: files?.rc_front_image?.[0],
      rc_back_image: files?.rc_back_image?.[0],
      insurance_image: files?.insurance_image?.[0],
    });
  }

  @Patch('vehicles/:id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rc_front_image', maxCount: 1 },
        { name: 'rc_back_image', maxCount: 1 },
        { name: 'insurance_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async updateVehicle(
    @Req() req: Request,
    @Param('id') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
    @UploadedFiles()
    files: { rc_front_image?: any[]; rc_back_image?: any[]; insurance_image?: any[] },
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.updateVehicle(deliveryPartnerId, vehicleId, dto, {
      rc_front_image: files?.rc_front_image?.[0],
      rc_back_image: files?.rc_back_image?.[0],
      insurance_image: files?.insurance_image?.[0],
    });
  }

  @Delete('vehicles/:id')
  async deleteVehicle(@Req() req: Request, @Param('id') vehicleId: string) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.deleteVehicle(deliveryPartnerId, vehicleId);
  }

  @Get('bank-accounts')
  async getBankAccounts(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getBankAccounts(deliveryPartnerId);
  }

  @Post('bank-accounts')
  @UseInterceptors(
    FileInterceptor('cancelled_cheque_image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async createBankAccount(
    @Req() req: Request,
    @Body() dto: CreateBankAccountDto,
    @UploadedFile() file: any,
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.createBankAccount(deliveryPartnerId, dto, file);
  }

  @Patch('bank-accounts/:id')
  @UseInterceptors(
    FileInterceptor('cancelled_cheque_image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async updateBankAccount(
    @Req() req: Request,
    @Param('id') bankId: string,
    @Body() dto: UpdateBankAccountDto,
    @UploadedFile() file: any,
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.updateBankAccount(deliveryPartnerId, bankId, dto, file);
  }

  @Delete('bank-accounts/:id')
  async deleteBankAccount(@Req() req: Request, @Param('id') bankId: string) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.deleteBankAccount(deliveryPartnerId, bankId);
  }

  @Get('preferences')
  async getPreferences(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getPreferences(deliveryPartnerId);
  }

  @Patch('preferences')
  async updatePreferences(@Req() req: Request, @Body() dto: UpdatePreferencesDto) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.updatePreferences(deliveryPartnerId, dto);
  }

  @Get('activity')
  async getActivity(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getActivity(deliveryPartnerId);
  }

  @Post('security/change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.changePassword(deliveryPartnerId, dto);
  }

  @Post('security/logout-all')
  async logoutAllDevices(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.logoutAllDevices(deliveryPartnerId);
  }

  @Get('attendance')
  async getAttendance(
    @Req() req: Request,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    return this.profileService.getAttendance(deliveryPartnerId, y, m);
  }

  @Get('attendance/day-details')
  async getAttendanceDayDetails(
    @Req() req: Request,
    @Query('date') date: string,
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    if (!date) {
      throw new BadRequestException('Date query parameter is required');
    }
    return this.profileService.getAttendanceDayDetails(deliveryPartnerId, date);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Req() req: Request,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const deliveryPartnerId = (req.user as any).user_id;
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    return this.profileService.getLeaderboard(deliveryPartnerId, y, m);
  }

  // ─── Leave Requests ────────────────────────────────────────────────────────

  @Post('leave-requests')
  async createLeaveRequest(@Req() req: Request, @Body() dto: CreateLeaveRequestDto) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.createLeaveRequest(deliveryPartnerId, dto);
  }

  @Get('leave-requests')
  async getLeaveRequests(@Req() req: Request) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.getLeaveRequests(deliveryPartnerId);
  }

  @Delete('leave-requests/:id')
  async cancelLeaveRequest(@Req() req: Request, @Param('id') id: string) {
    const deliveryPartnerId = (req.user as any).user_id;
    return this.profileService.cancelLeaveRequest(deliveryPartnerId, id);
  }
}
