import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Controller({ path: ['delivery-partner/auth', 'DeliveryPartner/auth'], version: '1' })
@UseGuards(AuthGuard('jwt'))
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('shift-toggle')
  @HttpCode(HttpStatus.OK)
  async toggleShiftStatus(
    @Req() req: Request,
    @Body() body: { is_active?: boolean },
  ) {
    const userId = (req.user as any)?.user_id;
    return this.authService.toggleShiftStatus(userId, body.is_active);
  }
}
