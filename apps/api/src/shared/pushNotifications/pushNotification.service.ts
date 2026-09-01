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

        // 2. Fallback to a service-account file on disk. The absolute path that
        //    used to be hardcoded here pointed at a deleted directory and at the
        //    retired `f2hfresh-65beb` project, so the location is now explicit
        //    (FIREBASE_SERVICE_ACCOUNT_PATH) with the in-tree secret as default.
        const possiblePaths = [
            process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
            path.join(process.cwd(), 'src/shared/secrets/firebasepushnotification.json'),
            path.join(process.cwd(), 'dist/shared/secrets/firebasepushnotification.json'),
        ].filter((p): p is string => Boolean(p && p.trim()));

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

    async sendToMultipleDevices(tokens: string[], title: string, body: string, data?: Record<string, string>) {
        if (!tokens || tokens.length === 0) {
            return { success: true, message: 'No tokens provided' };
        }

        if (!this.messaging) {
            return { success: true, message: 'Firebase messaging not initialized' };
        }

        const messageData: Record<string, string> = {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            ...(data || {}),
        };

        const message = {
            notification: { title, body },
            data: messageData,
            tokens: tokens,
        };

        try {
            const response = await this.messaging.sendEachForMulticast(message);
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errCode = (resp.error as any)?.code || 'UNKNOWN_FCM_ERROR';
                        const errMsg = (resp.error as any)?.message || String(resp.error);
                        const token = tokens[idx];

                        // Log at debug level to avoid polluting system logs with harmless token mismatches
                        this.developerService.warn(`[PushNotificationService] FCM token delivery failed: ${errCode} - ${errMsg}`);

                        const isInvalid =
                            errCode === 'messaging/registration-token-not-registered' ||
                            errCode === 'messaging/invalid-argument' ||
                            errCode === 'messaging/invalid-registration-token' ||
                            errCode === 'messaging/mismatched-credential' ||
                            errMsg.includes('SenderId mismatch') ||
                            errMsg.includes('mismatched-credential');

                        if (isInvalid && token) {
                            invalidTokens.push(token);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    this.db.query(
                        `UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1::text[])`,
                        [invalidTokens],
                    ).catch(() => {});
                }
            }
            return { success: true, response };
        } catch (error: any) {
            this.developerService.warn('PushNotificationService: Multicast non-fatal error (ignored):', error?.message || error);
            return { success: false, error: error?.message || String(error) };
        }
    }

    /**
     * Sends a notification to specific users, delivery partners, or customers.
     * Automatically resolves FCM tokens and records in-app notification in DB.
     * GUARANTEE: Never throws an error or blocks caller business logic.
     */
    async sendNotificationToUsers(
        user_id: any[],
        message: { title: string; body: string; data?: Record<string, string> }
    ) {
        if (!user_id || user_id.length === 0) {
            return { success: true, message: 'No user IDs provided' };
        }

        const ids = (Array.isArray(user_id) ? user_id : [user_id]).map(String).filter(Boolean);
        if (ids.length === 0) {
            return { success: true, message: 'No valid IDs provided' };
        }

        try {
            // 1. Resolve FCM tokens and primary user_ids across users, delivery_partners, and customers
            const rows = await this.db.query(
                `SELECT DISTINCT u.fcm_token, u.user_id
                 FROM users u
                 LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = u.user_id
                 LEFT JOIN customers c ON c.customer_id = u.user_id
                 WHERE u.user_id = ANY($1::text[])
                    OR dp.delivery_partner_id = ANY($1::text[])
                    OR c.customer_id = ANY($1::text[])`,
                [ids]
            ).catch(() => []);

            const tokenList = (rows || [])
                .map((u: any) => u.fcm_token)
                .filter((t: string) => !!t && t.length > 0 && t !== 'fcmToken' && t !== 'fcmtoken');

            // 2. Insert into notifications and notification_recipients tables for in-app history
            const resolvedUserIds = [...new Set((rows || []).map((r: any) => r.user_id).concat(ids))].filter(Boolean);
            try {
                const notifId = `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                const now = new Date();
                await this.db.query(
                    `INSERT INTO notifications (notification_id, title, message, medium, type, priority, status, created_by, created_at, updated_at)
                     VALUES ($1, $2, $3, 'push', 'info', 'high', 'active', 'system', $4, $4)`,
                    [notifId, message.title, message.body, now]
                );

                for (const uid of resolvedUserIds) {
                    await this.db.query(
                        `INSERT INTO notification_recipients (notification_id, user_id, status, notified_at, created_by, created_at, updated_at)
                         VALUES ($1, $2, 'unread', $3, 'system', $3, $3)
                         ON CONFLICT DO NOTHING`,
                        [notifId, uid, now]
                    );
                }
            } catch (e) {
                this.developerService.warn('PushNotificationService: In-app notification insert skipped:', e);
            }

            if (tokenList.length === 0) {
                return { success: true, deliveredPush: false, message: 'In-app notification saved; no active FCM push token' };
            }

            return await this.sendToMultipleDevices(tokenList, message.title, message.body, message.data);
        } catch (error: any) {
            this.developerService.warn('PushNotificationService: sendNotificationToUsers non-fatal error (ignored):', error?.message || error);
            return { success: false, error: error?.message || String(error) };
        }
    }
}
