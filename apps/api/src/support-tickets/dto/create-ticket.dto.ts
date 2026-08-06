import { IsNotEmpty, IsString, IsOptional, IsIn, IsArray } from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}
