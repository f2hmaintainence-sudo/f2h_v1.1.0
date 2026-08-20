import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  admin_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  target_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from_date must be YYYY-MM-DD' })
  @IsDateString({}, { message: 'from_date must be a valid date' })
  from_date?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to_date must be YYYY-MM-DD' })
  @IsDateString({}, { message: 'to_date must be a valid date' })
  to_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
