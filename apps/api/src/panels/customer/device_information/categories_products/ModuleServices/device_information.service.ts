import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CreateDeviceInformationDto } from '../dto/create-developer-subscription.dto';

@Injectable()
export class DeviceInformationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
    private readonly developer: DeveloperService,
  ) { }

  async registerOrUpdateDevice(dto: CreateDeviceInformationDto) {

    // Check if device exists
    const existing = await this.Data.query('device_information', {
      select: ['device_id'],
      where: [{ column: 'device_id', operator: '=', value: dto.device_id }]
    });

    if (existing && existing.data && existing.data.length > 0) {
      // Update existing device record
      await this.db.query(`
        UPDATE device_information 
        SET brand = $1, model = $2, hardware = $3, os_version = $4, current_version = $5, updated_at = NOW()
        WHERE device_id = $6
      `, [dto.brand, dto.model, dto.hardware, dto.os_version, dto.app_version, dto.device_id]);
    } else {
      // Insert new device record
      // The default target_version is set to whatever the global latest is, so it doesn't force update instantly on first open
      const targetVersion = process.env.LATEST_APK_VERSION || dto.app_version;
      await this.db.query(`
        INSERT INTO device_information (device_id, brand, model, hardware, os_version, current_version, target_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [dto.device_id, dto.brand, dto.model, dto.hardware, dto.os_version, dto.app_version, targetVersion]);
    }

    return { status: true, message: 'Device registered/updated successfully' };
  }

  // This will be called to check if the specific device needs an update
  async checkDeviceVersion(deviceId: string) {
    const response = await this.Data.query('device_information', {
      select: ['target_version'],
      where: [{ column: 'device_id', operator: '=', value: deviceId }]
    });

    if (response && response.data && response.data.length > 0) {
      return {
        version: response.data[0].target_version,
        url: 'https://dev.f2hfresh.com/appapk'
      };
    }

    // Fallback if device not found for some reason
    return {
      version: process.env.LATEST_APK_VERSION || '1.0.1+5',
      url: 'https://dev.f2hfresh.com/appapk'
    };
  }
}
