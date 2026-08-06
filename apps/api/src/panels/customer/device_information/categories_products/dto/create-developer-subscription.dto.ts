import { IsString, IsOptional } from 'class-validator';

export class CreateDeviceInformationDto {
  @IsString()
  device_id: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  hardware?: string;

  @IsString()
  @IsOptional()
  os_version?: string;

  @IsString()
  app_version: string;
}
