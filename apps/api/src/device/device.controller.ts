// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : device.controller.ts
// Description : Device registry intake.
//
//               The customer app has always posted a device fingerprint here on
//               launch (core/utils/version_checker.dart) and the
//               `device_information` table has always existed, but the route was
//               never written — so every call 404'd. The app swallows that
//               failure, which is why nobody noticed the table stayed empty.
// ============================================================================

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { DeviceService, type DeviceInfoPayload } from './device.service';

@Controller({ path: 'device', version: '1' })
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Records (or refreshes) what the app is running on.
   *
   * Public because it fires before sign-in, on first launch. It carries no
   * credential and is keyed on a client-supplied device id, so it is treated as
   * telemetry — never as an identity.
   */
  @Public()
  @Post('deviceInformation')
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async recordDeviceInformation(@Body() body: DeviceInfoPayload) {
    return this.deviceService.recordDevice(body);
  }
}
