import { Injectable } from '@nestjs/common';
import { DeveloperService } from '../logger/Developer.service';
import { DataService } from '../database/Data.service';
import * as admin from 'firebase-admin';
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
export class PushNotificationService {
    private readonly messaging = admin.messaging();

    constructor(
        private readonly developerService: DeveloperService,
        private readonly dataService: DataService,
    ) { }

    async sendToMultipleDevices(tokens: string[], title: string, body: string) {
        if (!tokens || tokens.length === 0)
            return { success: false, error: 'No tokens provided' };

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
                            this.dataService.update('users', { fcm_token: null }, [{ column: 'fcm_token', operator: '=', value: tokens[idx] }]).catch(() => {});
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
