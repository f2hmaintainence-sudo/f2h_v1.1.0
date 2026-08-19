// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : device.service.ts
// Description : Upserts rows in `device_information`, keyed on its primary key.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../shared/database/Database.service';

export interface DeviceInfoPayload {
  device_id?: string;
  brand?: string;
  model?: string;
  hardware?: string;
  os_version?: string;
  app_version?: string;
}

/** Column width in `device_information`; anything longer is a client bug. */
const MAX_FIELD = 255;

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly db: DatabaseService) {}

  private clamp(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text.slice(0, MAX_FIELD) : null;
  }

  /**
   * Records the device, keyed on `device_id` (the table's primary key).
   *
   * Telemetry must never break app start-up, so a bad payload or a write
   * failure comes back as an unsuccessful result rather than an exception —
   * the client fires this on launch and ignores the response either way.
   */
  async recordDevice(payload: DeviceInfoPayload) {
    const deviceId = this.clamp(payload?.device_id);
    if (!deviceId) {
      return { success: false, message: 'device_id is required' };
    }

    try {
      await this.db.query(
        `INSERT INTO public.device_information
             (device_id, brand, model, hardware, os_version, current_version,
              created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (device_id) DO UPDATE
         SET brand           = EXCLUDED.brand,
             model           = EXCLUDED.model,
             hardware        = EXCLUDED.hardware,
             os_version      = EXCLUDED.os_version,
             current_version = EXCLUDED.current_version,
             deleted_at      = NULL,
             updated_at      = NOW()`,
        [
          deviceId,
          this.clamp(payload.brand),
          this.clamp(payload.model),
          this.clamp(payload.hardware),
          this.clamp(payload.os_version),
          this.clamp(payload.app_version),
        ],
      );
      return { success: true };
    } catch (error) {
      this.logger.warn(`Device record failed for ${deviceId}: ${String(error)}`);
      return { success: false, message: 'Could not record device information' };
    }
  }
}
