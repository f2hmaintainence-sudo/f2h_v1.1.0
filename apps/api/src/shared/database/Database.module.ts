import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './Database.service';
import { DataService } from './Data.service';
import { DeveloperService } from '../logger/Developer.service';

@Global()
@Module({
  providers: [DatabaseService, DataService, DeveloperService],
  exports: [DatabaseService, DataService, DeveloperService],
})
export class SharedDatabaseModule {}
