import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class ContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  captchaToken: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
