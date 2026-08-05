import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsIn,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  branch_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  branch_code: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allow_buffer_order?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['hexagon', 'circle', 'square'])
  hex_shape?: string;

  // ─── H3 Sector-Split Fields ──────────────────────────────────

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  @Type(() => Number)
  delivery_radius_km?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  buffer_zone?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(10)
  @Type(() => Number)
  h3_resolution?: number;

  // Legacy field (kept for backward compat, no longer used for new branches)
  @IsString()
  @IsOptional()
  geo_bounds?: string;
}
