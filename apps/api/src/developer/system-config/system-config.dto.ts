// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : system-config.dto.ts
// Description : Data transfer objects for developer system configurations
// ============================================================================

import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsObject()
  config_data!: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
