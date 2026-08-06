import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ── One-Time Details DTO (for cart sync & checkout) ──
export class OnetimeDetailsDto {
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  delivery_date?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Morning', 'Evening'])
  delivery_slot?: string;
}

// ── Individual Sync Item DTO ──
export class CartSyncItemDto {
  @IsString()
  product_id: string;

  @IsString()
  product_variant_id: string;

  @IsOptional()
  @IsString()
  purchase_type?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnetimeDetailsDto)
  onetime_details?: OnetimeDetailsDto;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

// ── Cart Sync API Request DTO ──
export class CartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartSyncItemDto)
  items: CartSyncItemDto[];

  @IsOptional()
  @IsString()
  customer_id?: string;
}

export { CartDto as CreateCartDto };

// ── Checkout Item DTO ──
export class OnetimeCheckoutItemDto {
  @IsString()
  product_id: string;

  @IsString()
  product_variant_id: string;

  @IsOptional()
  @IsString()
  purchase_type?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnetimeDetailsDto)
  onetime_details?: OnetimeDetailsDto;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class CheckOutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnetimeCheckoutItemDto)
  items: OnetimeCheckoutItemDto[];

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
