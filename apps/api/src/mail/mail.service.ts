import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  forgotPasswordOtpTemplate,
  passwordChangedTemplate,
  registrationOtpTemplate,
  welcomeEmailTemplate,
} from './auth-email.templates';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.INFO_MAIL_HOST,
      port: Number(process.env.INFO_MAIL_PORT),
      secure: process.env.INFO_MAIL_ENCRYPTION === 'ssl',
      auth: {
        user: process.env.INFO_MAIL_USERNAME,
        pass: process.env.INFO_MAIL_PASSWORD,
      },
    });
  }

  async sendOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, forgotPasswordOtpTemplate(otp));
  }

  async sendRegistrationOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, registrationOtpTemplate(otp));
  }

  async sendForgotPasswordOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, forgotPasswordOtpTemplate(otp));
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.sendAuthTemplate(email, welcomeEmailTemplate(name));
  }

  async sendPasswordChangedAlert(email: string) {
    await this.sendAuthTemplate(email, passwordChangedTemplate());
  }

  /**
   * Send a generic email with custom subject and HTML content
   * Used for security alerts, notifications, etc.
   */
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      console.log(`[MailService] Sending email to ${options.to}...`);
      const info = await this.transporter.sendMail({
        from: `"f2hfresh.com Security" <${process.env.INFO_MAIL_USERNAME}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
      });
      console.log(
        '[MailService] Email sent successfully. Message ID:',
        info.messageId,
      );
      return info;
    } catch (error) {
      console.error('[MailService] CRITICAL: Failed to send email:', error);
      throw error;
    }
  }

  private async sendAuthTemplate(
    to: string,
    template: { subject: string; text: string; html: string },
  ) {
    return this.sendMail({ to, ...template });
  }
}
