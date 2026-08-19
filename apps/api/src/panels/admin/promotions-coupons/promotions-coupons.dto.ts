import {
  IsString, IsOptional, IsBoolean, IsNumber, IsIn, Min, IsArray, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Create Promotion ──────────────────────────────────────────────────────────

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['percentage', 'fixed_amount'])
  promotion_type: 'percentage' | 'fixed_amount';

  @IsNumber()
  @Min(0)
  discount_value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimum_order_amount?: number;

  @IsOptional()
  @IsBoolean()
  first_order_only?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usage_limit_per_customer?: number;

  @IsOptional()
  @IsBoolean()
  auto_apply?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_subscription_orders?: boolean;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_to_all_products?: boolean;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status?: 'draft' | 'active' | 'paused' | 'expired';

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;
}

// ── Update Promotion ──────────────────────────────────────────────────────────

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['percentage', 'fixed_amount'])
  promotion_type?: 'percentage' | 'fixed_amount';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_value?: number;

  @IsOptional()
  @IsNumber()
  max_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  minimum_order_amount?: number;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status?: 'draft' | 'active' | 'paused' | 'expired';

  @IsOptional()
  @IsBoolean()
  first_order_only?: boolean;

  @IsOptional()
  @IsNumber()
  usage_limit?: number;

  @IsOptional()
  @IsNumber()
  usage_limit_per_customer?: number;

  @IsOptional()
  @IsBoolean()
  auto_apply?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_subscription_orders?: boolean;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_to_all_products?: boolean;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;
}

// ── Set Promotion Status ──────────────────────────────────────────────────────

export class SetPromotionStatusDto {
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status: 'draft' | 'active' | 'paused' | 'expired';
}

// ── Promotion Products ────────────────────────────────────────────────────────

export class AddPromotionProductsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variant_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category_ids?: string[];
}

// ── Create Coupon ─────────────────────────────────────────────────────────────

export class CreateCouponDto {
  @IsString()
  promotion_id: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status?: 'draft' | 'active' | 'paused' | 'expired';

  @IsOptional()
  @IsNumber()
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usage_limit_per_customer?: number;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;
}

// ── Update Coupon ─────────────────────────────────────────────────────────────

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  promotion_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status?: 'draft' | 'active' | 'paused' | 'expired';

  @IsOptional()
  @IsNumber()
  usage_limit?: number;

  @IsOptional()
  @IsNumber()
  usage_limit_per_customer?: number;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsDateString()
  end_at?: string;
}

// ── Set Coupon Status ─────────────────────────────────────────────────────────

export class SetCouponStatusDto {
  @IsIn(['draft', 'active', 'paused', 'expired'])
  status: 'draft' | 'active' | 'paused' | 'expired';
}
