import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import * as nodemailer from 'nodemailer';
import { ContactDto } from './dto/contact.dto';
import { DataService } from '../../shared/database/Data.service';
interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}
@Controller({ path: 'contact', version: '1' })
export class ContactController {
  constructor(private readonly dataService: DataService) {}

  @Post()
  async submit(@Body() body: ContactDto, @Req() req: Request) {
    try {
      console.log('Received contact form submission:', body);

      // Verify reCAPTCHA
      const verify = await fetch(
        `https://www.google.com/recaptcha/api/siteverify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: process.env.RECAPTCHA_SECRET_KEY ?? '',
            response: body.captchaToken ?? '',
          }),
        },
      );

      const data = (await verify.json()) as RecaptchaResponse;

      if (!data.success) {
        throw new BadRequestException('CAPTCHA failed');
      }

      // Get real browser info
      const userAgent = req.headers['user-agent'] || 'Unknown';

      // Save using DataService
      const submissionId = `cnt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      await this.dataService.insert('form_submissions', {
        submission_id: submissionId,
        submission_type: 'contact',
        name: body.name,
        email: body.email,
        phone: body.phone,
        subject: body.eventType,
        message: body.message,
        page_url: body.pageUrl || 'https://giftthem.com/contact',
        user_agent: userAgent,
        status: 'new',
      });

      // Send email
      const transporter = nodemailer.createTransport({
        host: process.env.INFO_MAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.INFO_MAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.INFO_MAIL_USERNAME as string,
          pass: process.env.INFO_MAIL_PASSWORD as string,
        },
      });

      await transporter.sendMail({
        from: process.env.INFO_MAIL_USERNAME,
        to: process.env.INFO_MAIL_USERNAME,
        subject: `New Enquiry: ${body.eventType} from ${body.name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><b>Name:</b> ${body.name}</p>
          <p><b>Email:</b> ${body.email}</p>
          <p><b>Phone:</b> ${body.phone}</p>
          <p><b>Event Type:</b> ${body.eventType}</p>
          <p><b>Message:</b> ${body.message}</p>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error('Contact form submission error:', error);
      throw error;
    }
  }
}
