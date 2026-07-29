import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { SendEmailOtpDto, VerifyEmailOtpDto } from 'src/auth/dto/auth.dto';

@Controller({ path: 'DeliveryPartner/auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('shift-toggle')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async toggleShiftStatus(
    @Req() req: Request,
    @Body() body?: { is_active?: boolean },
  ) {
    const userId = (req.user as any)?.user_id;
    if (!userId) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }
    return this.authService.toggleShiftStatus(userId, body?.is_active);
  }

  @Public()
  @Post('send-email-otp')
  @HttpCode(HttpStatus.OK)
  async sendEmailOtp(@Body() body: SendEmailOtpDto & { purpose?: string }) {
    if (body.purpose === 'forgot_password') {
      return this.authService.forgotPassword(body.email);
    }
    return this.authService.requestMobileOtp({ email: body.email, phone: (body as any).phone });
  }

  @Public()
  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(@Body() body: VerifyEmailOtpDto & { purpose?: string }, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const purpose = (body.purpose as 'registration' | 'forgot_password' | 'email_change') || 'forgot_password';
    return this.authService.verifyMobileOtp(
      { email: body.email, otp: body.otp, purpose },
      ip,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: { email?: string; phone?: string; identifier?: string },
    @Req() req: Request,
  ) {
    const rawClientRole = req.headers['x-role'] || 'DELIVERY_PARTNER';
    const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : 'DELIVERY_PARTNER';
    const identifier = body.email || body.phone || body.identifier || '';
    return this.authService.forgotPassword(identifier, clientRole);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body()
    body: {
      email?: string;
      phone?: string;
      identifier?: string;
      token?: string;
      otp?: string;
      newPassword?: string;
      password?: string;
    },
  ) {
    return this.authService.resetPassword(body);
  }
}

