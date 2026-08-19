import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CreateDeviceInformationDto } from '../dto/create-developer-subscription.dto';
import { DeviceInformationService } from '../ModuleServices/device_information.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller({ version: '1' })
export class DeviceInformationController {
  constructor(private readonly service: DeviceInformationService) { }

  @Public()
  @Post(['device/device-information', 'device/deviceInformation'])
  async registerDevice(@Body() dto: CreateDeviceInformationDto) {
    return this.service.registerOrUpdateDevice(dto);
  }

  @Public()
  @Get(['device-information/check-version/:deviceId', 'deviceInformation/check-version/:deviceId'])
  async checkVersion(@Param('deviceId') deviceId: string) {
    return this.service.checkDeviceVersion(deviceId);
  }
}
