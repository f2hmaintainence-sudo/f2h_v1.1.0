import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class RegisterVendorDto {
  @IsString()
  @IsNotEmpty({ message: 'Business or Farm Name is required' })
  @MaxLength(150)
  businessName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Contact Person Name is required' })
  @MaxLength(100)
  contactPerson!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mobile Phone number is required' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Please provide a valid 10-digit Indian mobile number' })
  phone!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  email?: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  @MaxLength(100)
  category!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  pincode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  gstin?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  fssaiLicense?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  supplyCapacity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  experienceYears?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  products?: Array<{ product_id?: string; name: string; category?: string }> | string[];
}

