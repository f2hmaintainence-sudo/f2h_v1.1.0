// import {
//   Controller,
//   Post,
//   Body,
//   HttpCode,
//   HttpStatus,
//   Req,
// } from '@nestjs/common';
// import { Request } from 'express';
// import { AuthService } from './auth.service';
// import { Public } from 'src/auth/decorators/public.decorator';
// import { SendEmailOtpDto, VerifyEmailOtpDto } from 'src/auth/dto/auth.dto';

// @Controller({ path: 'DeliveryPartner/auth', version: '1' })
// export class AuthController {
//   constructor(private readonly authService: AuthService) {}

//   @Public()
//   @Post('send-email-otp')
//   @HttpCode(HttpStatus.OK)
//   async sendEmailOtp(@Body() body: SendEmailOtpDto) {
//     return this.authService.requestMobileOtp({ email: body.email });
//   }

//   @Public()
//   @Post('verify-email-otp')
//   @HttpCode(HttpStatus.OK)
//   async verifyEmailOtp(@Body() body: VerifyEmailOtpDto, @Req() req: Request) {
//     const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
//     return this.authService.verifyMobileOtp({ email: body.email, otp: body.otp }, ip);
//   }
// }
