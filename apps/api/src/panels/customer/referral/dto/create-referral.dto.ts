import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateReferralDto {
  @IsNotEmpty()
  @IsString()
  referee_name: string;

  @IsNotEmpty()
  @IsString()
  referee_phone: string;

  @IsOptional()
  @IsString()
  referral_code?: string;
}
