import { Controller, Get, Post, Headers, Param, Req, Query, UnauthorizedException, BadRequestException, InternalServerErrorException, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Public } from './auth/decorators/public.decorator';
import { Roles, ROLE } from './auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AppService } from './app.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from './shared/database/Database.service';

/** Only these two platforms may receive an uploaded release. */
const APK_PLATFORMS = {
  android_customer: 'customer',
  android_delivery: 'delivery',
} as const;

const MAX_APK_BYTES = 200 * 1024 * 1024;

/**
 * Compares a webhook secret in constant time and refuses to run at all when the
 * secret is not configured. The previous code fell back to a literal committed in
 * this file, so an unset environment variable silently restored a published value.
 */
function assertWebhookSecret(provided: string | undefined, expected: string | undefined) {
  if (!expected) {
    throw new InternalServerErrorException('Webhook secret is not configured');
  }
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Invalid or missing webhook secret');
  }
}

/**
 * Last-resort client configuration, used only when `api_integrations_config`
 * has no row (or the query fails). The database is the source of truth — these
 * values exist so a first boot against an unseeded database still starts.
 *
 * Everything below belongs to the `f2h-fresh` Firebase project. The previous
 * `f2hfresh-65beb` values were removed along with the project.
 */
const FIREBASE_CLIENT_DEFAULTS = (isDelivery: boolean) => ({
  apiKey: process.env.FIREBASE_ANDROID_API_KEY || 'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
  appId: isDelivery
    ? '1:842214638527:android:48141f5c3bf1127123d70a'
    : '1:842214638527:android:1800c0a5729eb74823d70a',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '842214638527',
  projectId: process.env.FIREBASE_PROJECT_ID || 'f2h-fresh',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'f2h-fresh.firebasestorage.app',
  authDomain: 'f2h-fresh.firebaseapp.com',
  // No iOS app is registered in the Firebase project. Empty strings tell the
  // client there is nothing to initialise rather than pointing it at a
  // different project's app id.
  iosApiKey: '',
  iosAppId: '',
  iosBundleId: isDelivery ? 'com.f2h.delivery' : 'com.f2h.customer',
});

/**
 * `serverClientId` is the *web* OAuth client on every platform: Android and iOS
 * exchange their serverAuthCode against it, so the API can verify one audience.
 */
const GOOGLE_OAUTH_DEFAULTS = () => ({
  serverClientId: process.env.GOOGLE_CLIENT_ID || '',
  webClientId: process.env.GOOGLE_CLIENT_ID || '',
});

/** Storefront constants the clients read from the same payload. */
const CLIENT_CONFIG_STATIC = {
  min_order_amount: 100.0,
  free_delivery_threshold: 500.0,
  support_phone: '+919876543210',
  support_email: 'support@f2hfresh.com',
  maintenance_mode: false,
} as const;

@Controller({ version: '1' })
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectQueue('default-queue') private readonly defaultQueue: Queue,
    private readonly db: DatabaseService,
  ) { }

  @Public()
  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Public()
  @Get('app-version')
  getAppVersion() {
    return {
      version: process.env.LATEST_APK_VERSION || '1.0.1+4',
      url: process.env.APP_URL || 'https://api.f2hfresh.com/uploads/app-release.apk',
    };
  }

  @Public()
  @Get('device/client-config')
  async getClientConfig(@Req() req: any, @Query('role') queryRole?: string, @Query('app') queryApp?: string) {
    const roleHeader = (req?.headers?.['x-role'] || queryRole || queryApp || '').toString().toUpperCase();
    const isDelivery = roleHeader.includes('D') || roleHeader.includes('DELIVERY');

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

      const rawFb = isDelivery
        ? (dbConfigs['firebase:delivery'] || dbConfigs['firebase:customer'] || dbConfigs['firebase:client'])
        : (dbConfigs['firebase:customer'] || dbConfigs['firebase:delivery'] || dbConfigs['firebase:client']);

      const defaults = FIREBASE_CLIENT_DEFAULTS(isDelivery);
      const firebaseConfig = rawFb ? {
        apiKey: rawFb.apiKey || rawFb.client_api_key || defaults.apiKey,
        appId: rawFb.appId || rawFb.android_app_id || defaults.appId,
        messagingSenderId: rawFb.messagingSenderId || rawFb.messaging_sender_id || defaults.messagingSenderId,
        projectId: rawFb.projectId || rawFb.project_id || defaults.projectId,
        storageBucket: rawFb.storageBucket || rawFb.storage_bucket || defaults.storageBucket,
        // iOS is served only when the row actually carries it. F2H has no iOS
        // app registered in the Firebase project yet, so inventing a value here
        // would hand the client a config that fails at Firebase.initializeApp.
        iosApiKey: rawFb.iosApiKey || rawFb.ios_api_key || '',
        iosAppId: rawFb.iosAppId || rawFb.ios_app_id || '',
        iosBundleId: rawFb.iosBundleId || rawFb.ios_bundle_id || defaults.iosBundleId,
        authDomain: rawFb.authDomain || rawFb.auth_domain || defaults.authDomain,
      } : defaults;

      const googleOauth = dbConfigs['oauth:google'] || GOOGLE_OAUTH_DEFAULTS();
      const mapsConfig = dbConfigs['maps:google_maps'] || { apiKey: process.env.GOOGLE_MAPS_API_KEY || '' };
      const razorpayConfig = dbConfigs['payment-gateway:razorpay'] || { keyId: process.env.RAZORPAY_KEY_ID || '' };

      return {
        status: true,
        data: {
          firebase: firebaseConfig,
          google_oauth: googleOauth,
          google_maps: mapsConfig,
          razorpay: razorpayConfig,
          ...CLIENT_CONFIG_STATIC,
        },
      };
    } catch (e) {
      return {
        status: true,
        data: {
          firebase: FIREBASE_CLIENT_DEFAULTS(isDelivery),
          google_oauth: GOOGLE_OAUTH_DEFAULTS(),
          google_maps: { apiKey: process.env.GOOGLE_MAPS_API_KEY || '' },
          razorpay: { keyId: process.env.RAZORPAY_KEY_ID || '' },
          ...CLIENT_CONFIG_STATIC,
        },
      };
    }
  }

  @Public()
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

  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('test-queue')
  async testQueue() {
    const job = await this.defaultQueue.add('test-job', {
      foo: 'bar',
      timestamp: new Date(),
    });
    return { message: 'Job added to queue', jobId: job.id };
  }

  @Public()
  @Post('webhook/app-update')
  async triggerAppUpdate(@Headers('x-update-secret') secret: string) {
    assertWebhookSecret(secret, process.env.F2H_APP_UPDATE_WEBHOOK_SECRET);
    return await this.appService.triggerAppUpdateNotification();
  }

  @Public()
  @Post('webhook/upload-release')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_APK_BYTES },
      fileFilter: (_req, file, cb) =>
        cb(null, file.mimetype === 'application/vnd.android.package-archive'),
    }),
  )
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
    assertWebhookSecret(secret, process.env.F2H_CI_CD_UPLOAD_SECRET);

    // The platform is looked up in a whitelist rather than derived by string
    // surgery. `platform.replace('android_', '')` let a value like
    // '../../../apps/web/public' escape the upload root, and the resulting file is
    // what the public /download pages hand to customers as a signed-looking APK.
    const appFolder = APK_PLATFORMS[platform as keyof typeof APK_PLATFORMS];
    if (!appFolder) {
      throw new BadRequestException(`Unknown platform: ${platform}`);
    }
    if (!file) throw new BadRequestException('No file provided (or it was not an APK)');
    if (!version || !/^\d+\.\d+\.\d+(\+\d+)?$/.test(version)) {
      throw new BadRequestException('version must look like 1.0.2+9');
    }

    let buildNum = 1;
    if (version.includes('+')) {
      const parts = version.split('+');
      buildNum = parseInt(parts[1], 10) || 1;
    }

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

  @Public()
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

}
