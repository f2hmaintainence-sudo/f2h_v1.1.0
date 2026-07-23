import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
  const serviceAccountPath = path.join(
    process.cwd(),
    'src/shared/secrets/firebasepushnotification.json',
  );
  const distServiceAccountPath = path.join(
    process.cwd(),
    'dist/shared/secrets/firebasepushnotification.json',
  );

  let finalPath = serviceAccountPath;
  if (fs.existsSync(distServiceAccountPath)) {
    finalPath = distServiceAccountPath;
  }

  if (fs.existsSync(finalPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(finalPath),
    });
  } else {
    console.error('CRITICAL: Firebase service account key not found!');
  }
}

@Injectable()
export class AppService {
  private readonly messaging = admin.messaging();

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

    console.log(`[FCM Notification] Found ${tokenList.length} tokens in the database to send updates to:`, tokenList);

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
      const response = await admin.messaging().sendEachForMulticast(message);
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
      console.log('responseeeeee', response);
      return response;
    } catch (error) {
      this.developerService.error('Multicast error:', error);
      throw error;
    }
  }

  async getHello(): Promise<any> {
    const RUNS = 10;

    const allUsersResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'password'],
    });
    // const notificationRes = await this.triggerNotification();
    // console.log('notificationRes', notificationRes);
    // this.developerService.info('Notification result:', notificationRes);

    const testUser = {
      userID: '9999',
      name: 'Benchmark User',
      mobile: '+91-98765-99999',
      address: 'Test City, TC',
    };

    const results: any = { runs: RUNS };

    // ════════════════════════════════════════
    //  BENCHMARK: CREATE
    // ════════════════════════════════════════
    let tJson = 0;
    let tHash = 0;

    for (let i = 0; i < RUNS; i++) {
      const startJson = performance.now();
      await this.redisService.store(
        `user:bench:${i}`,
        JSON.stringify(testUser),
      );
      tJson += performance.now() - startJson;

      const startHash = performance.now();
      await this.redisService.hset(`user:hash:bench:${i}`, testUser);
      tHash += performance.now() - startHash;
    }

    results.create = {
      result: { allUsersResult },
      json: { totalMs: tJson.toFixed(3), avgMs: (tJson / RUNS).toFixed(3) },
      hash: { totalMs: tHash.toFixed(3), avgMs: (tHash / RUNS).toFixed(3) },
      winner: this.winner((tJson / RUNS).toString(), (tHash / RUNS).toString()),
    };

    // ════════════════════════════════════════
    //  BENCHMARK: READ SINGLE FIELD
    // ════════════════════════════════════════
    tJson = 0;
    tHash = 0;

    for (let i = 0; i < RUNS; i++) {
      const startJson = performance.now();
      const raw = await this.redisService.fetch(`user:bench:${i}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const _nameJson = parsed?.name;
      tJson += performance.now() - startJson;

      const startHash = performance.now();
      await this.redisService.hget(`user:hash:bench:${i}`, 'name');
      tHash += performance.now() - startHash;
    }

    results.readSingleField = {
      json: { totalMs: tJson.toFixed(3), avgMs: (tJson / RUNS).toFixed(3) },
      hash: { totalMs: tHash.toFixed(3), avgMs: (tHash / RUNS).toFixed(3) },
      winner: this.winner((tJson / RUNS).toString(), (tHash / RUNS).toString()),
    };

    // ════════════════════════════════════════
    //  BENCHMARK: UPDATE SINGLE FIELD
    // ════════════════════════════════════════
    tJson = 0;
    tHash = 0;

    for (let i = 0; i < RUNS; i++) {
      const startJson = performance.now();
      const raw = await this.redisService.fetch(`user:bench:${i}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      parsed.name = 'Partially Updated';
      await this.redisService.store(`user:bench:${i}`, JSON.stringify(parsed));
      tJson += performance.now() - startJson;

      const startHash = performance.now();
      await this.redisService.hset(`user:hash:bench:${i}`, {
        name: 'Partially Updated',
      });
      tHash += performance.now() - startHash;
    }

    results.updateSingleField = {
      json: { totalMs: tJson.toFixed(3), avgMs: (tJson / RUNS).toFixed(3) },
      hash: { totalMs: tHash.toFixed(3), avgMs: (tHash / RUNS).toFixed(3) },
      winner: this.winner((tJson / RUNS).toString(), (tHash / RUNS).toString()),
    };

    // ════════════════════════════════════════
    //  CLEANUP / DELETE
    // ════════════════════════════════════════
    for (let i = 0; i < RUNS; i++) {
      await this.redisService.delete(`user:bench:${i}`);
      await this.redisService.delete(`user:hash:bench:${i}`);
    }
    const categories = await this.service.getCategories();
    console.log('categories', categories);
    return {
      success: true,
      benchmark: results,
      categories: categories.data
      // userData: allUsersResult
    };
  }

  private winner(jsonAvg: string, hashAvg: string): string {
    return parseFloat(jsonAvg) < parseFloat(hashAvg)
      ? '🏆 JSON (String) is faster'
      : '🏆 Hash is faster';
  }
}
