import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class GenerateCustomerBillDto {
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'periodStart must be YYYY-MM-DD' })
  periodStart?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'periodEnd must be YYYY-MM-DD' })
  periodEnd?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string;
}


export class GetCustomerBillsQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
