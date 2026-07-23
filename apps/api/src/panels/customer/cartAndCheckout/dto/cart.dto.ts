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

// ── Weekly Schedule DTO ──
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

// ── Subscription Details DTO (for cart sync) ──
export class SubscriptionDetailsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeveloperWeeklyScheduleDto)
  schedules: DeveloperWeeklyScheduleDto[];

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  start_date?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;
}

// ── One-Time Details DTO (for cart sync) ──
export class OnetimeDetailsDto {
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @Matches(DATE_PATTERN)
  delivery_date: string;

  @IsString()
  @IsIn(['Morning', 'Evening'])
  delivery_slot: string;
}

// ── Individual Sync Item DTO ──
export class CartSyncItemDto {
  @IsString()
  product_id: string;

  @IsString()
  product_variant_id: string;

  @IsString()
  @IsIn(['onetime', 'subscription'])
  purchase_type: 'onetime' | 'subscription';

  @IsOptional()
  @ValidateNested()
  @Type(() => OnetimeDetailsDto)
  onetime_details?: OnetimeDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SubscriptionDetailsDto)
  subscription_details?: SubscriptionDetailsDto;
}

// ── Cart Sync API Request DTO ──
export class CartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartSyncItemDto)
  items: CartSyncItemDto[];

  @IsString()
  @IsOptional()
  customer_id?: string;
}

// ── Subscription Creation / Checkout Item DTO ──
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

// ── Subscription Creation / Checkout Request DTO ──
export class CreateCartDto {
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

// ── Checkout Item DTOs ──
export abstract class CheckoutItemDto {
  @IsString()
  product_id: string;

  @IsString()
  product_variant_id: string;

  @IsString()
  purchase_type: string;
}

export class OnetimeCheckoutItemDto extends CheckoutItemDto {
  @IsString()
  @IsIn(['onetime'])
  declare purchase_type: 'onetime';

  @ValidateNested()
  @Type(() => OnetimeDetailsDto)
  onetime_details: OnetimeDetailsDto;
}

export class SubscriptionCheckoutItemDto extends CheckoutItemDto {
  @IsString()
  @IsIn(['subscription'])
  declare purchase_type: 'subscription';

  @ValidateNested()
  @Type(() => SubscriptionDetailsDto)
  subscription_details: SubscriptionDetailsDto;
}

export class CheckOutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'purchase_type',
      subTypes: [
        { value: OnetimeCheckoutItemDto, name: 'onetime' },
        { value: SubscriptionCheckoutItemDto, name: 'subscription' },
      ],
    },
  })
  items: (OnetimeCheckoutItemDto | SubscriptionCheckoutItemDto)[];

  @IsString()
  @IsOptional()
  customer_id?: string;

  @IsString()
  @IsOptional()
  address_id?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsOptional()
  @IsIn(['prepaid', 'postpaid'])
  payment_type?: 'prepaid' | 'postpaid';
}

