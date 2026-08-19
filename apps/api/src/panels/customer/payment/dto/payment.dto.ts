// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment.dto.ts
// Description : Request payloads for the customer payment endpoints
//
// ============================================================================

import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentOrderDto {
  @IsOptional()
  @IsIn(['wallet_topup', 'bill', 'order', 'subscription'])
  purpose?: 'wallet_topup' | 'bill' | 'order' | 'subscription';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  bill_id?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsObject()
  notes?: Record<string, any>;
}

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_signature?: string;

  /** Legacy field retained for older app builds. */
  @IsOptional()
  @IsString()
  bill_id?: string;
}

export class PayBillFromWalletDto {
  @IsString()
  bill_id: string;
}
