import { IsEmail, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePersonalDto {
  @IsString()
  @IsOptional()
  full_name?: string;
  @IsEmail()
  @IsOptional()
  email?: string;
  @IsString()
  @IsOptional()
  phone?: string;
  @IsString()
  @IsOptional()
  date_of_birth?: string;
  @IsString()
  @IsOptional()
  gender?: string;
  @IsString()
  @IsOptional()
  residential_address?: string;
  @IsString()
  @IsOptional()
  emergency_contact?: string;
  @IsString()
  @IsOptional()
  emergency_contact_number?: string;
}

export class CreateDocumentDto {
  @IsString()
  document_type: string; // aadhaar, pan, driving_license, police_verification, other
  @IsString()
  @IsOptional()
  document_number?: string;
  @IsString()
  @IsOptional()
  issue_date?: string;
  @IsString()
  @IsOptional()
  expiry_date?: string;
}

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  document_number?: string;
  @IsString()
  @IsOptional()
  issue_date?: string;
  @IsString()
  @IsOptional()
  expiry_date?: string;
}

export class CreateVehicleDto {
  @IsString()
  vehicle_type: string;
  @IsString()
  registration_number: string;
  @IsString()
  @IsOptional()
  brand?: string;
  @IsString()
  @IsOptional()
  model?: string;
  @IsString()
  @IsOptional()
  color?: string;
  @IsString()
  @IsOptional()
  rc_number?: string;
  @IsString()
  @IsOptional()
  insurance_number?: string;
  @IsString()
  @IsOptional()
  insurance_expiry?: string;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  is_primary?: boolean;
}

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  vehicle_type?: string;
  @IsString()
  @IsOptional()
  registration_number?: string;
  @IsString()
  @IsOptional()
  brand?: string;
  @IsString()
  @IsOptional()
  model?: string;
  @IsString()
  @IsOptional()
  color?: string;
  @IsString()
  @IsOptional()
  rc_number?: string;
  @IsString()
  @IsOptional()
  insurance_number?: string;
  @IsString()
  @IsOptional()
  insurance_expiry?: string;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  is_primary?: boolean;
}

export class CreateBankAccountDto {
  @IsString()
  account_holder_name: string;
  @IsString()
  bank_name: string;
  @IsString()
  account_number: string;
  @IsString()
  ifsc_code: string;
  @IsString()
  @IsOptional()
  branch_name?: string;
  @IsString()
  @IsOptional()
  upi_id?: string;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  is_primary?: boolean;
}

export class UpdateBankAccountDto {
  @IsString()
  @IsOptional()
  account_holder_name?: string;
  @IsString()
  @IsOptional()
  bank_name?: string;
  @IsString()
  @IsOptional()
  account_number?: string;
  @IsString()
  @IsOptional()
  ifsc_code?: string;
  @IsString()
  @IsOptional()
  branch_name?: string;
  @IsString()
  @IsOptional()
  upi_id?: string;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  is_primary?: boolean;
}

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  push_notifications?: boolean;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  email_notifications?: boolean;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  sms_notifications?: boolean;
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  promotional_notifications?: boolean;
  @IsString()
  @IsOptional()
  language_preference?: string;
}

export class ChangePasswordDto {
  @IsString()
  current_password: string;
  @IsString()
  new_password: string;
  @IsString()
  confirm_password: string;
}

export class CreateLeaveRequestDto {
  @IsString()
  leave_date: string; // ISO date string e.g. "2026-07-20"

  @IsString()
  @IsOptional()
  end_date?: string; // ISO date string e.g. "2026-07-22"

  @IsString()
  @IsOptional()
  leave_type?: string; // 'full_day' | 'half_day'  (default: 'full_day')

  @IsString()
  @IsOptional()
  half_day_shift?: string; // 'morning' | 'evening'

  @IsString()
  @IsOptional()
  reason?: string;
}
