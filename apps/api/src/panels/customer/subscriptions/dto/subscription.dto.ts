import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WeeklyScheduleDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  day?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  day_of_week?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  m_quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  m_qty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  morning_qty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  e_quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  e_qty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  evening_qty?: number;
}

export class SubscriptionItemDto {
  @IsOptional()
  @IsString()
  product_variant_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unit_price?: number;


  @IsOptional()
  @IsString()
  discount_id?: string;

  @IsOptional()
  @IsString()
  coupon_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coupon_amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyScheduleDto)
  schedules?: WeeklyScheduleDto[];
}

export class CreateSubscriptionDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  schedule_type?: string;

  @IsOptional()
  @IsString()
  payment_type?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimated_total?: number;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  address_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionItemDto)
  items?: SubscriptionItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  custom_dates?: string[];
}