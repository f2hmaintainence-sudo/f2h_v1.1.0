import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';
import { DeveloperService } from '../shared/logger/Developer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FieldEncryptionService, DeveloperService],
  exports: [FieldEncryptionService],
})
export class FieldEncryptionModule {}
