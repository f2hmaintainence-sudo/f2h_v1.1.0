import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { DatabaseService } from '../../shared/database/Database.service';
import { DataService } from '../../shared/database/Data.service';
import { DeveloperService } from '../../shared/logger/Developer.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [ContactController],
  providers: [ DeveloperService],
})
export class ContactModule {}
