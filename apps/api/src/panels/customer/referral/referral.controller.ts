import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { IReferralService } from './interfaces/referral.service.interface';
import { CreateReferralDto } from './dto/create-referral.dto';
import { RequireIntegrity } from 'src/shared/play-integrity/decorators/require-integrity.decorator';

@Controller('customer/referrals')
export class ReferralController {
  constructor(
    @Inject('IReferralService')
    private readonly referralService: IReferralService,
  ) {}

  @Get('details')
  @UseGuards(AuthGuard('jwt'))
  async getDetails(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid session');
    }
    return this.referralService.getReferralDetails(userId);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  async getHistory(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid session');
    }
    return this.referralService.getReferralHistory(userId);
  }

  @Public()
  @Post('validate')
  async validateCode(@Req() req: Request, @Body('code') code: string) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    return this.referralService.validateReferralCode(userId, code);
  }

  @Public()
  @Get('validate/:code')
  async validateCodeGet(@Req() req: Request, @Param('code') code: string) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    return this.referralService.validateReferralCode(userId, code);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getRootDashboard(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid session');
    }
    return this.referralService.getReferralDashboard(userId);
  }

  @Get('dashboard')
  @UseGuards(AuthGuard('jwt'))
  async getDashboard(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid session');
    }
    return this.referralService.getReferralDashboard(userId);
  }

  @RequireIntegrity('customer')
  @Post('add')
  @UseGuards(AuthGuard('jwt'))
  async addReferral(@Req() req: Request, @Body() dto: CreateReferralDto) {
    const user = req.user as any;
    const userId = user?.customer_id || user?.user_id || user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Invalid session');
    }
    return this.referralService.createReferral(userId, dto);
  }
}
