import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { DeviceInformationController } from './controllers/device_information.controller';
import { DeviceInformationService } from './ModuleServices/device_information.service';

@Module({
  imports: [ConfigModule],
  controllers: [DeviceInformationController],
  providers: [  DeveloperService, DeviceInformationService],
  exports: [DeviceInformationService],
})
export class DeviceInformationModule { }
