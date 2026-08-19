import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CsrfService } from './csrf.service';
import { CSRF_COOKIE_NAME } from './csrf.constants';
import { Public } from '../auth/decorators/public.decorator';

@Controller({ path: 'csrf', version: '1' })
export class CsrfController {
  constructor(private readonly csrfService: CsrfService) {}

  @Public()
  @Get('token')
  getToken(@Res({ passthrough: true }) res: Response) {
    const token = this.csrfService.generateToken();

    res.cookie(CSRF_COOKIE_NAME, token, {
      // Deliberately readable by JavaScript: the double-submit pattern requires the
      // client to echo this value in a header, and the token is not a credential on
      // its own — it only proves the request originated from our own page.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 60 * 60 * 1000,
      path: '/',
    });

    return { csrfToken: token };
  }
}
