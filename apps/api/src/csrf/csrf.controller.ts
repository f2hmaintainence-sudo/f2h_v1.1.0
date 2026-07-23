import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CsrfService } from './csrf.service';
import { CSRF_COOKIE_NAME } from './csrf.constants';

@Controller({ path: 'csrf', version: '1' })
export class CsrfController {
  constructor(private readonly csrfService: CsrfService) {}

  @Get('token')
  getToken(@Res({ passthrough: true }) res: Response) {
    const token = this.csrfService.generateToken();

    const isProduction = process.env.NODE_ENV?.trim() === 'production';
    const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,   // ← 'as const' narrows string → 'strict' literal
  maxAge: 60 * 60 * 1000,
  path: '/',
};

    res.cookie(CSRF_COOKIE_NAME, token, cookieOptions);
    return { csrfToken: token };
  }
}
