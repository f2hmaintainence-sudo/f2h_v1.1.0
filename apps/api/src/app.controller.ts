import { Controller, Get, Post, Headers, Param, Req, Query, UnauthorizedException, BadRequestException, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AppService } from './app.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from './shared/database/Database.service';

@Controller({ version: '1' })
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectQueue('default-queue') private readonly defaultQueue: Queue,
    private readonly db: DatabaseService,
  ) { }

  @Get()
  getHello(): any {
    return this.appService.getHello();
  }

  @Get('app-version')
  getAppVersion() {
    return {
      version: process.env.LATEST_APK_VERSION || '1.0.1+4',
      url: process.env.APP_URL || 'https://api.f2hfresh.com/uploads/app-release.apk',
    };
  }

  @Get('device/client-config')
  async getClientConfig(@Req() req: any, @Query('role') queryRole?: string, @Query('app') queryApp?: string) {
    try {
      const sql = `
        SELECT category, config_key, provider, config_data
        FROM api_integrations_config
        WHERE is_active = true AND category IN ('firebase', 'oauth', 'maps', 'payment-gateway', 'general');
      `;
      const rows: any[] = await this.db.query(sql);
      const dbConfigs: Record<string, any> = {};

      if (Array.isArray(rows)) {
        for (const row of rows) {
          dbConfigs[`${row.category}:${row.config_key}`] = row.config_data || {};
        }
      }

      const roleHeader = (req?.headers?.['x-role'] || req?.headers?.['x-role'] || queryRole || queryApp || '').toString().toUpperCase();
      const isDelivery = roleHeader.includes('D') || roleHeader.includes('DELIVERY');

      const rawFb = isDelivery
        ? (dbConfigs['firebase:delivery'] || dbConfigs['firebase:customer'] || dbConfigs['firebase:client'])
        : (dbConfigs['firebase:customer'] || dbConfigs['firebase:delivery'] || dbConfigs['firebase:client']);

      const firebaseConfig = rawFb ? {
        apiKey: rawFb.apiKey || rawFb.client_api_key || 'AIzaSyBMqFkPAenVd4rurNYLxcb17fqRN0Bm47U',
        appId: rawFb.appId || rawFb.android_app_id || (isDelivery ? '1:277443632535:android:0f9e3b1ff9e36e9f0b38d2' : '1:277443632535:android:a9290d2881da2d5e0b38d2'),
        messagingSenderId: rawFb.messagingSenderId || rawFb.messaging_sender_id || '277443632535',
        projectId: rawFb.projectId || rawFb.project_id || 'f2hfresh-65beb',
        storageBucket: rawFb.storageBucket || rawFb.storage_bucket || 'f2hfresh-65beb.firebasestorage.app',
        iosApiKey: rawFb.iosApiKey || rawFb.ios_api_key || rawFb.apiKey || rawFb.client_api_key,
        iosAppId: rawFb.iosAppId || rawFb.ios_app_id || (isDelivery ? '1:445665408019:ios:8b7b36e7cca52b2d59fbe6' : '1:1060833982707:ios:64708d0f2c64294ef31f86'),
        iosBundleId: rawFb.iosBundleId || rawFb.ios_bundle_id || (isDelivery ? 'com.f2h.delivery' : 'com.f2h.customer'),
        authDomain: rawFb.authDomain || rawFb.auth_domain || 'f2hfresh-65beb.firebaseapp.com',
      } : {
        apiKey: process.env.FIREBASE_ANDROID_API_KEY || 'AIzaSyBMqFkPAenVd4rurNYLxcb17fqRN0Bm47U',
        appId: isDelivery ? '1:277443632535:android:0f9e3b1ff9e36e9f0b38d2' : '1:277443632535:android:a9290d2881da2d5e0b38d2',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '277443632535',
        projectId: process.env.FIREBASE_PROJECT_ID || 'f2hfresh-65beb',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'f2hfresh-65beb.firebasestorage.app',
        iosApiKey: isDelivery ? 'AIzaSyAtT56n3QZdD7ZFYyXOwVPlFoLEuVkkOFk' : 'AIzaSyBR4Xs71YQTs8Hzlp5Ql5a15ZxD2FfzGxg',
        iosAppId: isDelivery ? '1:445665408019:ios:8b7b36e7cca52b2d59fbe6' : '1:1060833982707:ios:64708d0f2c64294ef31f86',
        iosBundleId: isDelivery ? 'com.f2h.delivery' : 'com.f2h.customer',
      };

      const googleOauth = dbConfigs['oauth:google'] || {
        serverClientId: process.env.GOOGLE_SERVER_CLIENT_ID || '605526160181-00mmui7o3uuijjgvhgjjs5qbldai544g.apps.googleusercontent.com',
      };

      const mapsConfig = dbConfigs['maps:google_maps'] || {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      };

      const razorpayConfig = dbConfigs['payment-gateway:razorpay'] || {
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_default',
      };

      return {
        status: true,
        data: {
          firebase: firebaseConfig,
          google_oauth: googleOauth,
          google_maps: mapsConfig,
          razorpay: razorpayConfig,
          min_order_amount: 100.0,
          free_delivery_threshold: 500.0,
          support_phone: '+919876543210',
          support_email: 'support@f2hfresh.com',
          maintenance_mode: false,
        },
      };
    } catch (e) {
      return {
        status: true,
        data: {
          firebase: {
            apiKey: 'AIzaSyBMqFkPAenVd4rurNYLxcb17fqRN0Bm47U',
            appId: '1:277443632535:android:a9290d2881da2d5e0b38d2',
            messagingSenderId: '277443632535',
            projectId: 'f2hfresh-65beb',
            storageBucket: 'f2hfresh-65beb.firebasestorage.app',
            iosApiKey: 'AIzaSyBR4Xs71YQTs8Hzlp5Ql5a15ZxD2FfzGxg',
            iosAppId: '1:1060833982707:ios:64708d0f2c64294ef31f86',
            iosBundleId: 'com.f2h.customer',
          },
          google_oauth: {
            serverClientId: '605526160181-00mmui7o3uuijjgvhgjjs5qbldai544g.apps.googleusercontent.com',
          },
          google_maps: { apiKey: '' },
          razorpay: { keyId: 'rzp_test_default' },
          min_order_amount: 100.0,
          free_delivery_threshold: 500.0,
          support_phone: '+919876543210',
          support_email: 'support@f2hfresh.com',
          maintenance_mode: false,
        },
      };
    }
  }

  @Get('api/app-version/:appType')
  async getPublicAppVersion(@Param('appType') appType: string) {
    const platform = appType === 'delivery' ? 'android_delivery' : 'android_customer';
    const rows = await this.db.query(
      `SELECT latest_version, min_version, force_update, store_url, update_message, update_title, release_notes, file_size, build_number, published_date 
       FROM app_configs 
       WHERE platform = $1`,
      [platform]
    );

    if (!rows || rows.length === 0) {
      throw new BadRequestException(`Configuration for platform ${platform} not found`);
    }

    const config = rows[0];
    return {
      latestVersion: config.latest_version,
      minVersion: config.min_version,
      forceUpdate: config.force_update,
      storeUrl: config.store_url,
      updateMessage: config.update_message,
      updateTitle: config.update_title,
      releaseNotes: config.release_notes,
      fileSize: config.file_size,
      buildNumber: config.build_number,
      publishedDate: config.published_date,
    };
  }

  @Post('test-queue')
  async testQueue() {
    const job = await this.defaultQueue.add('test-job', {
      foo: 'bar',
      timestamp: new Date(),
    });
    return { message: 'Job added to queue', jobId: job.id };
  }

  @Post('webhook/app-update')
  async triggerAppUpdate(
    @Headers('x-update-secret') secret: string,
  ) {
    // Basic protection to prevent unauthorized triggers
    if (secret !== 'F2H_SECURE_UPDATE_WEBHOOK_SECRET_123') {
      throw new UnauthorizedException('Invalid secret');
    }

    return await this.appService.triggerAppUpdateNotification();
  }

  @Post('webhook/upload-release')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRelease(
    @UploadedFile() file: any,
    @Headers('x-cicd-secret') secret: string,
    @Body('platform') platform: string,       // 'android_customer' or 'android_delivery'
    @Body('version') version: string,          // e.g. '1.0.2+9'
    @Body('minVersion') minVersion?: string,
    @Body('forceUpdate') forceUpdate?: string,  // 'true' or 'false'
    @Body('updateTitle') updateTitle?: string,
    @Body('updateMessage') updateMessage?: string,
    @Body('releaseNotes') releaseNotes?: string,
  ) {
    const configSecret = process.env.F2H_CI_CD_UPLOAD_SECRET || 'F2H_SECURE_UPDATE_WEBHOOK_SECRET_123';
    if (!secret || secret !== configSecret) {
      throw new UnauthorizedException('Invalid or missing CI/CD webhook secret');
    }
    if (!file) throw new BadRequestException('No file provided');
    if (!platform || !version) {
      throw new BadRequestException('platform and version are required parameters');
    }

    let buildNum = 1;
    if (version.includes('+')) {
      const parts = version.split('+');
      buildNum = parseInt(parts[1], 10) || 1;
    }

    const appFolder = platform.replace('android_', ''); // 'customer' or 'delivery'
    const uploadDir = path.join(__dirname, '..', 'uploads', 'downloads', appFolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `${platform}-release.apk`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const stats = fs.statSync(filePath);
    const sizeInMb = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

    const baseUrl = process.env.APP_URL || 'https://api.f2hfresh.com';
    let cleanBaseUrl = baseUrl;
    if (cleanBaseUrl.includes('/uploads')) {
      cleanBaseUrl = cleanBaseUrl.split('/uploads')[0];
    }
    if (cleanBaseUrl.endsWith('/')) {
      cleanBaseUrl = cleanBaseUrl.slice(0, -1);
    }
    if (cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.includes('localhost') && !cleanBaseUrl.includes('127.0.0.1') && !cleanBaseUrl.includes('192.168.')) {
      cleanBaseUrl = cleanBaseUrl.replace('http://', 'https://');
    }
    const downloadUrl = `${cleanBaseUrl}/uploads/downloads/${appFolder}/${fileName}`;

    // Clean up old builds (if any extra versions are stored elsewhere, otherwise we overwrite)
    // Fetch current platform configuration for fallbacks
    const rows = await this.db.query(
      `SELECT min_version, force_update, update_message, update_title, release_notes FROM app_configs WHERE platform = $1`,
      [platform]
    );

    const currentConfig = rows[0] || {};
    const finalMinVersion = minVersion || currentConfig.min_version || '1.0.0+1';
    const finalForceUpdate = forceUpdate !== undefined ? (forceUpdate === 'true') : (currentConfig.force_update ?? false);
    const finalUpdateMessage = updateMessage || currentConfig.update_message || 'A new update is available. Please update to continue.';
    const finalUpdateTitle = updateTitle || currentConfig.update_title || 'Update Available';
    const finalReleaseNotes = releaseNotes || currentConfig.release_notes || 'Bug fixes and performance improvements.';

    await this.db.query(
      `INSERT INTO app_configs (platform, latest_version, min_version, force_update, store_url, update_message, update_title, release_notes, file_size, build_number, published_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (platform) DO UPDATE SET
         latest_version = EXCLUDED.latest_version,
         min_version = EXCLUDED.min_version,
         force_update = EXCLUDED.force_update,
         store_url = EXCLUDED.store_url,
         update_message = EXCLUDED.update_message,
         update_title = EXCLUDED.update_title,
         release_notes = EXCLUDED.release_notes,
         file_size = EXCLUDED.file_size,
         build_number = EXCLUDED.build_number,
         published_date = NOW(),
         updated_at = NOW()`,
      [
        platform,
        version,
        finalMinVersion,
        finalForceUpdate,
        downloadUrl,
        finalUpdateMessage,
        finalUpdateTitle,
        finalReleaseNotes,
        sizeInMb,
        buildNum
      ]
    );

    return {
      message: 'Release uploaded and version configuration updated successfully',
      version,
      buildNumber: buildNum,
      fileSize: sizeInMb,
      downloadUrl
    };
  }

  @Get('app/check-version')
  async checkVersion(
    @Headers('x-app-platform') platform: string,
    @Headers('x-app-version') clientVersion: string,
  ) {
    if (!platform || !clientVersion) {
      return {
        updateRequired: false,
        forceUpdate: false,
        latestVersion: '',
        storeUrl: '',
        message: 'Missing platform or version headers',
      };
    }

    // Query database for app configs
    const rows = await this.db.query(
      `SELECT latest_version, min_version, force_update, store_url, update_message, update_title, release_notes, file_size, build_number, published_date 
       FROM app_configs 
       WHERE platform = $1`,
      [platform]
    );

    if (!rows || rows.length === 0) {
      return {
        updateRequired: false,
        forceUpdate: false,
        latestVersion: '',
        storeUrl: '',
        message: 'Platform configuration not found',
      };
    }

    const config = rows[0];

    // Compare versions
    const belowMin = this.compareVersions(clientVersion, config.min_version) < 0;
    const belowLatest = this.compareVersions(clientVersion, config.latest_version) < 0;

    let updateRequired = false;
    let forceUpdate = false;

    if (belowMin) {
      updateRequired = true;
      forceUpdate = config.force_update;
    } else if (belowLatest) {
      updateRequired = true;
      forceUpdate = false;
    }

    return {
      updateRequired,
      forceUpdate,
      latestVersion: config.latest_version,
      storeUrl: config.store_url,
      message: config.update_message,
      updateTitle: config.update_title,
      releaseNotes: config.release_notes,
      fileSize: config.file_size,
      buildNumber: config.build_number,
      publishedDate: config.published_date,
    };
  }

  private compareVersions(v1: string, v2: string): number {
    const [name1, build1] = v1.split('+');
    const [name2, build2] = v2.split('+');

    const parts1 = name1.split('.').map(Number);
    const parts2 = name2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    const b1 = Number(build1) || 0;
    const b2 = Number(build2) || 0;
    if (b1 > b2) return 1;
    if (b1 < b2) return -1;

    return 0;
  }

  @Post('app/rebuild')
  async triggerAppRebuild(@Body() body: { appId: string; action?: string }) {
    const appId = (body?.appId || '').toLowerCase().trim();
    const action = (body?.action || 'rebuild').toLowerCase().trim();
    let command = '';

    if (action === 'clean') {
      if (appId === 'customer') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer && /opt/flutter/bin/flutter clean && /opt/flutter/bin/flutter pub get`;
      } else if (appId === 'partner' || appId === 'delivery') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery && /opt/flutter/bin/flutter clean && /opt/flutter/bin/flutter pub get`;
      } else {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/web && rm -rf .next node_modules/.cache`;
      }
    } else if (action === 'run') {
      if (appId === 'customer') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer && /opt/flutter/bin/flutter build web --profile --no-pub && rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer/build/web/ /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/`;
      } else if (appId === 'partner' || appId === 'delivery') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery && /opt/flutter/bin/flutter build web --profile --no-pub && rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery/build/web/ /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/`;
      } else {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/web && pm2 restart frontend-f2hfresh`;
      }
    } else if (action === 'reload') {
      if (appId === 'customer') {
        command = `rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer/build/web/ /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/`;
      } else if (appId === 'partner' || appId === 'delivery') {
        command = `rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery/build/web/ /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/`;
      } else {
        command = `pm2 restart frontend-f2hfresh`;
      }
    } else {
      if (appId === 'customer') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer && /opt/flutter/bin/flutter build web --release && rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/customer/build/web/ /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/`;
      } else if (appId === 'partner' || appId === 'delivery') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery && /opt/flutter/bin/flutter build web --release && rsync -avz --delete /home/f2hfresh/htdocs/f2hfresh.com/apps/mobile/delivery/build/web/ /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/`;
      } else if (appId === 'admin') {
        command = `cd /home/f2hfresh/htdocs/f2hfresh.com/apps/web && npm run build && pm2 restart frontend-f2hfresh`;
      } else {
        throw new BadRequestException('Invalid appId');
      }
    }

    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[AppRebuild:${action}] Error building ${appId}:`, stderr);
          return resolve({ success: false, message: stderr || error.message });
        }
        console.log(`[AppRebuild:${action}] Successfully executed for ${appId}`);
        resolve({ success: true, message: `${appId} (${action}) completed successfully!`, output: stdout || 'Command executed cleanly.' });
      });
    });
  }
}
