import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const validateWhenProvided = (_object: unknown, value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

export class UpdateCompanyProfileDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legal_name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gst_number?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(15)
  pan_number?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @ValidateIf(validateWhenProvided)
  @IsEmail()
  email?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf(validateWhenProvided)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf(validateWhenProvided)
  @Matches(PHONE_PATTERN, {
    message: 'secondary_phone must be a valid phone number',
  })
  secondary_phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf(validateWhenProvided)
  @Matches(PHONE_PATTERN, {
    message: 'whatsapp must be a valid phone number',
  })
  whatsapp?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(validateWhenProvided)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  logo_url?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ValidateIf(validateWhenProvided)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  website?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(validateWhenProvided)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  instagram_url?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(validateWhenProvided)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  facebook_url?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf(validateWhenProvided)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  youtube_url?: string;
}
