import { Injectable, OnModuleInit } from '@nestjs/common';
import { DeveloperService } from '../logger/Developer.service';
import { DatabaseService } from '../database/Database.service';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

import { DataService } from '../database/Data.service';

@Injectable()
export class PushNotificationService implements OnModuleInit {
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
        private readonly db: DatabaseService,
        private readonly dataService: DataService,
    ) { }

    async onModuleInit() {
        await this.ensureFirebaseInitialized();
    }

    private async ensureFirebaseInitialized() {
        if (admin.apps.length) return;

        // 1. Try loading from database api_integrations_config table
        try {
            const rows = await this.db.query(
                `SELECT config_data FROM api_integrations_config WHERE config_key = 'firebase:admin' AND is_active = true LIMIT 1`,
            );
            if (rows && rows.length > 0 && rows[0].config_data) {
                const config = typeof rows[0].config_data === 'string'
                    ? JSON.parse(rows[0].config_data)
                    : rows[0].config_data;
                if (config && config.client_email && config.private_key) {
                    admin.initializeApp({
                        credential: admin.credential.cert(config),
                    });
                    this.developerService.info('Firebase Admin SDK initialized dynamically from database api_integrations_config');
                    return;
                }
            }
        } catch (err: any) {
            this.developerService.warn('Failed to fetch Firebase admin config from DB:', err?.message || err);
        }

        // 2. Fallback to file system (/home/f2hfresh/htdocs/f2hfresh.com/firebase or local secrets)
        const possiblePaths = [
            '/home/f2hfresh/htdocs/f2hfresh.com/firebase/f2hfresh-65beb-firebase-adminsdk-fbsvc-732ac6da2d.json',
            path.join(process.cwd(), 'src/shared/secrets/firebasepushnotification.json'),
            path.join(process.cwd(), 'dist/shared/secrets/firebasepushnotification.json'),
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                try {
                    const rawContent = fs.readFileSync(p, 'utf8').trim();
                    if (rawContent && rawContent.startsWith('{')) {
                        const serviceAccount = JSON.parse(rawContent);
                        admin.initializeApp({
                            credential: admin.credential.cert(serviceAccount),
                        });
                        this.developerService.info(`Firebase Admin SDK initialized from fallback file: ${p}`);
                        return;
                    }
                } catch (e: any) {
                    console.warn(`Firebase initialization warning from ${p}:`, e?.message || e);
                }
            }
        }
    }

    async sendToMultipleDevices(tokens: string[], title: string, body: string) {
        if (!tokens || tokens.length === 0)
            return { success: false, error: 'No tokens provided' };

        if (!this.messaging) {
            return { success: false, error: 'Firebase messaging not initialized' };
        }

        const message = {
            notification: { title, body },
            data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
            tokens: tokens,
        };
        try {
            const response = await this.messaging.sendEachForMulticast(message);
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errCode = (resp.error as any)?.code || 'UNKNOWN_FCM_ERROR';
                        const errMsg = (resp.error as any)?.message || String(resp.error);
                        this.developerService.error(`Token ${idx} failed:`, {
                            error: resp.error,
                            token: tokens[idx],
                        });
                        console.error(`[PushNotificationService] FCM Error (${errCode}) for token ${tokens[idx]?.substring(0, 20)}...: ${errMsg}`);

                        if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-argument') {
                            console.warn(`[PushNotificationService] Deleting stale/unregistered token from database: ${tokens[idx]?.substring(0, 20)}...`);
                            this.dataService.update('users', { fcm_token: null }, [{ column: 'fcm_token', operator: '=', value: tokens[idx] }]).catch(() => { });
                        }
                    }
                });
            }
            return response;
        } catch (error) {
            this.developerService.error('Multicast error:', error);
            throw error;
        }
    }

    /**
     * Sends a notification to specific users
     */
    async sendNotificationToUsers(
        user_id: any[],
        message: { title: string; body: string }
    ) {
        if (!user_id || user_id.length === 0) {
            return { success: false, error: 'No user IDs provided' };
        }

        const queryResult = await this.dataService.query('users', {
            select: ['fcm_token'],
            where: [
                {
                    column: 'user_id',
                    operator: 'IN',
                    value: user_id,
                },
            ],
        });

        const tokenList = (queryResult?.data || [])
            .map((u: any) => u.fcm_token)
            .filter((t: string) => !!t && t.length > 0 && t !== 'fcmToken' && t !== 'fcmtoken');

        if (tokenList.length === 0) {
            console.warn(`[PushNotificationService] ALERT: Attempted to send notification to user(s) ${user_id.join(', ')} but no valid FCM tokens were found in the database!`);
            return { success: false, error: 'No user IDs provided or no valid tokens found' };
        }

        return await this.sendToMultipleDevices(tokenList, message.title, message.body);
    }
}
