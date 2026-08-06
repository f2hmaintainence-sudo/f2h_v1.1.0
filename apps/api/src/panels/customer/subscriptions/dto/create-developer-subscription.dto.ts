import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DeveloperWeeklyScheduleDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  day: number;

  @IsNumber()
  @Min(0)
  m_quantity: number;

  @IsNumber()
  @Min(0)
  e_quantity: number;
}

export class DeveloperSubscriptionItemDto {
  @IsString()
  product_variant_id: string;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeveloperWeeklyScheduleDto)
  schedules: DeveloperWeeklyScheduleDto[];
}

export class CreateDeveloperSubscriptionDto {
  @IsString()
  customer_id: string;

  @IsIn(['weekly', 'custom_dates'])
  schedule_type: 'weekly' | 'custom_dates';

  @IsIn(['prepaid', 'postpaid'])
  payment_type: 'prepaid' | 'postpaid';

  @Matches(DATE_PATTERN)
  start_date: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  end_date?: string;

  @IsBoolean()
  auto_renew: boolean;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeveloperSubscriptionItemDto)
  items: DeveloperSubscriptionItemDto[];

  @IsArray()
  @IsString({ each: true })
  custom_dates: string[];
}