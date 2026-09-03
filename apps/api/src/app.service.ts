import { Injectable, InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DeveloperService } from './shared/logger/Developer.service';
import { DataService } from './shared/database/Data.service';
import { RedisService } from './shared/redis/redis.service';
import { CategoriesProductsService } from './panels/customer/categories_products/ModuleServices/categories_products.service';

import * as admin from 'firebase-admin';

// Note: Ensure your serviceAccountKey.json is in the correct path or use env variables
// Usually, initialization happens in main.ts or a dedicated FirebaseModule.
import * as fs from 'fs';
import * as path from 'path';

if (!admin.apps.length) {
  const possiblePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), 'apps/api/src/shared/secrets/firebasepushnotification.json'),
    path.join(process.cwd(), 'src/shared/secrets/firebasepushnotification.json'),
    path.join(process.cwd(), 'dist/shared/secrets/firebasepushnotification.json'),
    path.join(process.cwd(), 'apps/api/dist/shared/secrets/firebasepushnotification.json'),
  ].filter((p): p is string => Boolean(p && p.trim()));

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(p),
        });
        break;
      } catch (err) {
        console.warn('Failed to initialize Firebase from path:', p, err);
      }
    }
  }
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  private get messaging() {
    if (!admin.apps.length) return null;
    try {
      return admin.messaging();
    } catch {
      return null;
    }
  }

  constructor(
    private readonly developerService: DeveloperService,
    private readonly Data: DataService,
    private readonly redisService: RedisService,
    private readonly service: CategoriesProductsService
  ) { }

  /**
   * Sends a notification via Firebase FCM
   */
  async triggerNotification() {
    const queryResult = await this.Data.query('users', {
      select: ['fcm_token'],
    });

    const tokenList = (queryResult?.data || [])
      .map((u: any) => u.fcm_token)
      .filter((t: string) => !!t && t.length > 0);

    const title = 'Your Order has been placed successfully';
    const body = 'Your Order has been placed successfully';

    return await this.sendToMultipleDevices(tokenList, title, body);
  }

  async triggerAppUpdateNotification() {
    const queryResult = await this.Data.query('users', {
      select: ['fcm_token'],
    });

    const tokenList = (queryResult?.data || [])
      .map((u: any) => u.fcm_token)
      .filter((t: string) => !!t && t.length > 0);

    this.logger.log(`[FCM Notification] Found ${tokenList.length} tokens in the database to send updates to:`, tokenList);

    const title = 'New Update Available! 🚀';
    const body = 'A new update with improvements has been applied. Restart your app to see the changes!';

    const result = await this.sendToMultipleDevices(tokenList, title, body);
    
    if (!('responses' in result)) {
      return {
        successCount: 0,
        failureCount: 0,
        detailedStatus: [],
        error: result.error
      };
    }

    const detailedStatus = tokenList.map((token, idx) => ({
      token: token,
      status: result.responses[idx].success ? 'SUCCESS' : 'FAILED',
      error: result.responses[idx].error?.message || null
    }));

    return { 
      successCount: result.successCount,
      failureCount: result.failureCount,
      detailedStatus 
    };
  }

  async sendToMultipleDevices(tokens: string[], title: string, body: string) {
    if (!tokens || tokens.length === 0)
      return { success: false, error: 'No tokens provided' };

    const messaging = this.messaging;
    if (!messaging) {
      this.logger.warn('Firebase Admin SDK is not initialized. Skipping push notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    const message = {
      notification: { title, body },
      data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'fcm_fallback_notification_channel'
        }
      },
      tokens: tokens,
    };
    try {
      const response = await messaging.sendEachForMulticast(message);
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.developerService.error(`Token ${idx} failed:`, {
              error: resp.error,
              token: tokens[idx],
            });
          }
        });
      }
      this.logger.log('responseeeeee', response);
      return response;
    } catch (error) {
      this.developerService.error('Multicast error:', error);
      throw error;
    }
  }

  /**
   * API root. Returns liveness only.
   *
   * This used to run a Redis JSON-vs-hash benchmark and return, among the timings,
   * `SELECT user_id, email, password FROM users` — every account's address and
   * bcrypt hash — from an unauthenticated route. The benchmark was scratch work; it
   * is gone rather than gated, because nothing here should ever read credentials.
   */
  getHello(): { status: string; service: string; time: string } {
    return {
      status: 'ok',
      service: 'f2h-api',
      time: new Date().toISOString(),
    };
  }
}
