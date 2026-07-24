import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number, and special character',
  })
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Please provide a valid mobile number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'OTP must be 6 characters' })
  otp?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  user_name?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  verification_token?: string;

  @IsString()
  @IsOptional()
  fcm_token?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  referral_code?: string;
}

export class LoginDto {
  @IsString()
  @MaxLength(255, { message: 'Identifier too long' })
  identifier: string; // Can be email or user_name

  @IsString()
  @MaxLength(128, { message: 'Password too long' })
  password: string;

  @IsOptional()
  fingerprintData?: any;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  fcm_token?: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  fingerprintData?: any; // Device fingerprint from browser for security binding
}

export class ForgotPasswordSmsDto {
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Please provide a valid mobile number' })
  phone: string;

  @IsOptional()
  fingerprintData?: any;
}

export class ResetPasswordDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6, { message: 'Invalid reset token/OTP' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number, and special character',
  })
  newPassword: string;

  @IsOptional()
  fingerprintData?: any; // Device fingerprint from browser for security verification
}

export class SendOtpDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Please provide a valid mobile number' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  purpose?: 'registration' | 'forgot_password' | 'email_change';

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  user_name?: string;

  @IsString()
  @IsOptional()
  ip?: string;
}

export class VerifyOtpDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Please provide a valid mobile number' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  purpose?: 'registration' | 'forgot_password' | 'email_change';

  @IsString()
  @MinLength(6, { message: 'OTP must be 6 characters' })
  otp: string;
}

export class DeviceFingerprintDto {
  @IsString()
  @IsOptional()
  screenResolution?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  canvas?: string;

  @IsOptional()
  plugins?: string[];
}

export class RevokeDeviceDto {
  @IsString()
  deviceId: string;
}

export class SendEmailOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'OTP must be 6 digits' })
  otp: string;
}
