import { Injectable, Logger } from '@nestjs/common';
import { DataService } from '../shared/database/Data.service';
import { DatabaseService } from '../shared/database/Database.service';
import { DeveloperService } from '../shared/logger/Developer.service';
import { RedisService } from '../redis/redis.service';
import { generateId } from '../helpers/RandomHelper';
import {
  SendNotificationDto,
  NotificationResponse,
} from './dto/notification.dto';

// | Event                  | In-App Notification  | Push Notification   |  Email   |
// | ---------------------- | :-----------------:  | :---------------:   | :-----:  |
// | Order placed           |          ✅          |         ✅         |    ❌    |
// | Order confirmed        |          ✅          |         ✅         |    ❌    |
// | Order packed           |          ✅          |         ✅         |    ❌    |
// | Out for delivery       |          ✅          |         ✅         |    ❌    |
// | Order delivered        |          ✅          |         ✅         |    ❌    |
// | Order cancelled        |          ✅          |         ✅         |    ✅    |
// | Order failed           |          ✅          |         ✅         |    ✅    |
// | Order refunded         |          ✅          |         ✅         |    ✅    |
// | Wallet credited        |          ✅          |         ✅         |    ❌    |
// | Wallet debited         |          ✅          |         ❌         |    ❌    |
// | Low wallet balance     |          ✅          |         ✅         |    ❌    |
// | Subscription created   |          ✅          |         ✅         |    ❌    |
// | Subscription renewed   |          ✅          |         ✅         |    ❌    |
// | Subscription paused    |          ✅          |         ✅         |    ❌    |
// | Subscription resumed   |          ✅          |         ✅         |    ❌    |
// | Subscription expired   |          ✅          |         ✅         |    ✅    |
// | Subscription cancelled |          ✅          |         ✅         |    ✅    |
// | Payment successful     |          ✅          |         ✅         |    ❌    |
// | Payment failed         |          ✅          |         ✅         |    ❌    |
// | COD payment received   |          ✅          |         ❌         |    ❌    |
// | Delivery skipped       |          ✅          |         ✅         |    ❌    |
// | Delivery delayed       |          ✅          |         ✅         |    ❌    |
// | Delivery rescheduled   |          ✅          |         ✅         |    ❌    |
// | Address updated        |          ✅          |         ❌         |    ❌    |
// | Profile updated        |          ✅          |         ❌         |    ❌    |
// | Password changed       |          ✅          |         ✅         |    ✅    |
// | New device login       |          ✅          |         ✅         |    ✅    |
// | OTP sent               |          ❌          |         ❌         | ✅ / SMS |
// | Account locked         |          ✅          |         ✅         |    ✅    |
// | Welcome message        |          ✅          |         ✅         |    ❌    |
// | New product launched   |          ❌          |         ✅         |    ❌    |
// | Offer / Discount       |          ❌          |         ✅         |    ❌    |
// | Festival offer         |          ❌          |         ✅         |    ❌    |
// | Flash sale             |          ❌          |         ✅         |    ❌    |
// | Coupon available       |          ✅          |         ✅         |    ❌    |
// | Referral reward        |          ✅          |         ✅         |    ❌    |
// | Cashback received      |          ✅          |         ✅         |    ❌    |
// | Branch holiday         |          ✅          |         ✅         |    ❌    |
// | Service interruption   |          ✅          |         ✅         |    ❌    |
// | Maintenance notice     |          ✅          |         ✅         |    ❌    |
// | App update available   |          ✅          |         ✅         |    ❌    |


// In-App only           : Profile updates, address updates, wallet debit, COD payment received.
// Push only             : Marketing campaigns, flash sales, festival offers (optional to store in DB if not required).
// In-App + Push         : Orders, subscriptions, deliveries, wallet credit, payment success/failure, refunds, security alerts.
// Email + Push + In-App : Password changes, account lock, subscription expiry, order cancellation/refund, new device login.
export interface NotificationPayload {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
  notification_id?: string;
  title?: string;
  html?: string;
  image?: string;
  id?: number;
}

/**
 * Industry-Standard Notification Service
 * 1. Save to database first (notifications & notification_recipients)
 * 2. Send via WebSocket if user is online
 * 3. If offline, notification stays in database for retrieval after login
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private gateway: any = null;

  constructor(
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Generate a unique notification ID
   */
  private generateNotificationId(): string {
    return generateId('NTF', 12);
  }

  /**
   * Set gateway reference (called from gateway's afterInit)
   */
  setGateway(gateway: any): void {
    this.gateway = gateway;
    this.logger.log('Gateway reference set');
  }

  getGateway(): any {
    return this.gateway;
  }

  /**
   * Industry-standard notification send
   * Saves to DB first, then sends via WebSocket if user is online
   */
  async sendNotification(dto: SendNotificationDto): Promise<void> {
    const notificationId = this.generateNotificationId();
    const now = new Date();
    const normalizedPriority =
      dto.priority === 'urgent' ? 'critical' : dto.priority || 'medium';

    try {
      // 1. Insert into notifications table
      const notificationData = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        notification_id: notificationId,
        title: dto.title,
        message: dto.message,
        medium: 'websocket',
        type: dto.type || 'info',
        priority: normalizedPriority,
        sender_id: dto.senderId || null,
        status: true,
        created_by: dto.senderId || 'SYSTEM',
        updated_by: dto.senderId || 'SYSTEM',
        created_at: now,
        updated_at: now,
      };

      await this.dataService.insert('notifications', notificationData);

      const uniqueRecipients = Array.from(new Set(dto.recipientIds || []));
      if (uniqueRecipients.length === 0) {
        this.logger.warn(`Notification ${notificationId} has no recipients`);
        return;
      }

      // 2. Insert recipients into notification_recipients table
      const recipientData = uniqueRecipients.map((userId, idx) => {
        const isOnline = !!this.gateway?.isUserOnline?.(userId);
        return {
          id: Date.now() + idx + Math.floor(Math.random() * 1000),
          notification_id: notificationId,
          user_id: userId,
          html: dto.html || null,
          image: dto.image || null,
          status: isOnline ? 'read' : 'unread',
          notified_at: now,
          read_at: isOnline ? now : null,
          created_by: dto.senderId || 'SYSTEM',
          updated_by: dto.senderId || 'SYSTEM',
          created_at: now,
          updated_at: now,
        };
      });

      await this.dataService.insert('notification_recipients', recipientData);

      // 3. Send via WebSocket to online users
      if (this.gateway) {
        const onlineRecipients = uniqueRecipients.filter((id) =>
          this.gateway.isUserOnline(id),
        );

        if (onlineRecipients.length > 0) {
          const payload: NotificationPayload = {
            notification_id: notificationId,
            title: dto.title,
            message: dto.message,
            type: dto.type || 'info',
            timestamp: now.toISOString(),
            html: dto.html,
            image: dto.image,
          };

          this.gateway.sendToUsers(onlineRecipients, payload);
          this.logger.log(
            `WebSocket notification sent to ${onlineRecipients.length} online users`,
          );
        } else {
          this.logger.log(
            'No online recipients, notification saved to DB only',
          );
        }
      }
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(
    userId: string,
    status?: 'read' | 'unread',
  ): Promise<NotificationResponse[]> {
    try {
      const whereConditions: any[] = [
        {
          column: 'notification_recipients.user_id',
          operator: '=',
          value: userId,
        },
        {
          column: 'notification_recipients.status',
          operator: '!=',
          value: 'dismissed',
        },
      ];

      if (status) {
        whereConditions.push({
          column: 'notification_recipients.status',
          operator: '=',
          value: status,
        });
      }

      const queryParams = {
        select: [
          'notification_recipients.id',
          'notifications.notification_id',
          'notifications.title',
          'notifications.message',
          'notifications.type',
          'notifications.priority',
          'notification_recipients.html',
          'notification_recipients.image',
          'notification_recipients.status',
          'notification_recipients.notified_at',
          'notification_recipients.read_at',
          'notification_recipients.created_at',
        ],
        joins: [
          {
            table: 'notifications',
            on: [
              [
                'notifications.notification_id',
                'notification_recipients.notification_id',
              ],
            ],
            type: 'INNER',
          },
        ],
        where: whereConditions,
        orderBy: [
          { column: 'notification_recipients.created_at', direction: 'DESC' },
        ],
      };

      const result = await this.dataService.query(
        'notification_recipients',
        queryParams,
      );

      // Extract data from wrapper response object
      const notifications = result?.data || [];

      if (!Array.isArray(notifications)) {
        this.developer.warn(
          '🔔 [NotificationService] Invalid response - not an array after extraction',
          { notifications },
        );
        return [];
      }

      return notifications as NotificationResponse[];
    } catch (error) {
      this.developer.error(
        '🔔 [NotificationService] ERROR fetching notifications',
        {
          userId,
          status,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      );
      throw error;
    }
  }

  /**
   * Mark notifications as read (supports numeric IDs and string notification_ids)
   */
  async markAsRead(userId: string, notificationIds: (number | string)[]): Promise<void> {
    try {
      if (!notificationIds || notificationIds.length === 0) return;
      const numericIds: number[] = [];
      const stringIds: string[] = [];

      for (const raw of notificationIds) {
        const num = Number(raw);
        if (!isNaN(num) && Number.isInteger(num)) {
          numericIds.push(num);
        }
        stringIds.push(String(raw));
      }

      await this.db.query(
        `UPDATE notification_recipients
         SET status = 'read', read_at = NOW(), updated_at = NOW()
         WHERE (
           user_id = $1
           OR user_id IN (
             SELECT dp.delivery_partner_id FROM delivery_partners dp WHERE dp.user_id = $1
             UNION
             SELECT dp.user_id FROM delivery_partners dp WHERE dp.delivery_partner_id = $1
           )
         )
         AND (
           id = ANY($2::bigint[])
           OR notification_id = ANY($3::text[])
         )`,
        [userId, numericIds.length > 0 ? numericIds : [-1], stringIds],
      );

      this.logger.log(
        `Marked ${notificationIds.length} notifications as read for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE notification_recipients
         SET status = 'read', read_at = NOW(), updated_at = NOW()
         WHERE (
           user_id = $1
           OR user_id IN (
             SELECT dp.delivery_partner_id FROM delivery_partners dp WHERE dp.user_id = $1
             UNION
             SELECT dp.user_id FROM delivery_partners dp WHERE dp.delivery_partner_id = $1
           )
         )
         AND status != 'read'`,
        [userId],
      );

      this.logger.log(`Marked all notifications as read for user ${userId}`);
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Legacy: Send notification to all users
   */
  sendToAll(payload: NotificationPayload): void {
    if (!this.gateway) return;
    const allUsers = this.gateway.getOnlineUsersExcept();
    this.gateway.sendToUsers(allUsers, payload);
  }

  /**
   * Legacy: Send notification to all users except one
   */
  sendToAllExcept(excludeUserId: string, payload: NotificationPayload): void {
    if (!this.gateway) return;
    this.gateway.broadcastExcept(excludeUserId, payload);
  }

  /**
   * Legacy: Send notification to specific users (WebSocket only, no DB)
   */
  sendToUsers(userIds: string[], payload: NotificationPayload): void {
    if (!this.gateway) return;
    this.gateway.sendToUsers(userIds, payload);
  }

  /**
   * Legacy: Send notification to one user (wrapper for sendToUsers)
   */
  sendToUser(userId: string, payload: NotificationPayload): void {
    this.sendToUsers([userId], payload);
  }

  /**
   * Get count of online users
   */
  getOnlineUserCount(): number {
    if (!this.gateway) return 0;
    return this.gateway.getOnlineUsersExcept().length;
  }

  getOnlineUsersExcept(excludeUserId?: string): string[] {
    if (!this.gateway) return [];
    return this.gateway.getOnlineUsersExcept(excludeUserId);
  }

  disconnectUserSockets(userId: string): number {
    if (!this.gateway || !userId) return 0;
    if (typeof this.gateway.disconnectUserSockets !== 'function') return 0;
    return this.gateway.disconnectUserSockets(userId);
  }

  /**
   * Check if user has any active sessions. If no sessions exist, disconnect their sockets.
   * Use this after logout to only disconnect when ALL sessions are gone.
   */
  async checkAndDisconnectIfNoSessions(userId: string): Promise<void> {
    if (!this.gateway || !userId) return;
    if (typeof this.gateway.checkAndDisconnectIfNoSessions !== 'function')
      return;
    await this.gateway.checkAndDisconnectIfNoSessions(userId);
  }

  /**
   * Force logout user - used after password reset or security events
   * 1. Sends force_logout event to user's socket room (triggers frontend logout)
   * 2. Deletes JWT session data from Redis
   * 3. Disconnects all user sockets
   */
  async forceLogoutUser(
    userId: string,
    reason: string = 'password_reset',
  ): Promise<void> {
    if (!userId) return;

    this.logger.log(
      `[ForceLogout] Initiating force logout for user ${userId} - Reason: ${reason}`,
    );

    try {
      // 1. Send force_logout event to user's socket room BEFORE disconnecting
      // This allows frontend to handle logout gracefully (clear storage, redirect)
      if (this.gateway && typeof this.gateway.server?.to === 'function') {
        const userRoom = `user:${userId}`;
        this.gateway.server.to(userRoom).emit('force_logout', {
          reason,
          message:
            reason === 'password_reset'
              ? 'Your password was reset. Please login again.'
              : 'You have been logged out for security reasons.',
          timestamp: new Date().toISOString(),
        });
        this.logger.log(
          `[ForceLogout] Sent force_logout event to room ${userRoom}`,
        );
      }

      // 2. Delete JWT session data from Redis (f2h_user_jwt_{userId})
      const jwtKey = `f2h_user_jwt_${userId}`;
      await this.redisService.forget(jwtKey);
      this.logger.log(`[ForceLogout] Deleted JWT key: ${jwtKey}`);

      // 3. Delete user data cache
      const userDataKey = `f2h_user_data_${userId}`;
      await this.redisService.forget(userDataKey);
      this.logger.log(`[ForceLogout] Deleted user data cache: ${userDataKey}`);

      // 4. Small delay to ensure socket event is delivered before disconnect
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 5. Disconnect all user sockets
      if (
        this.gateway &&
        typeof this.gateway.disconnectUserSockets === 'function'
      ) {
        const disconnectedCount = this.gateway.disconnectUserSockets(userId);
        this.logger.log(
          `[ForceLogout] Disconnected ${disconnectedCount} socket(s) for user ${userId}`,
        );
      }

      this.logger.log(
        `[ForceLogout] Completed force logout for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `[ForceLogout] Error during force logout for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Get all notifications for a user with unread count in one call
   * Used by frontend to fetch notifications and count in a single request
   */
  async getUserNotificationsWithCount(
    userId: string,
  ): Promise<{ notifications: NotificationResponse[]; unreadCount: number }> {
    try {
      // Get unread count
      const unreadResult = await this.dataService.query(
        'notification_recipients',
        {
          select: { count: true },
          where: [
            { column: 'user_id', operator: '=', value: userId },
            { column: 'status', operator: '!=', value: 'dismissed' },
            { column: 'status', operator: '=', value: 'unread' },
          ],
        },
      );

      const unreadCount = unreadResult?.data?.[0]?.count || 0;

      // Get all notifications (excluding dismissed)
      const notifications = await this.getUserNotifications(userId);

      return {
        notifications,
        unreadCount,
      };
    } catch (error) {
      this.developer.error(
        '🔔 [NotificationService] Error getting notifications with count',
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }


  /**
   * Mark a single notification as read by recipient ID
   */
  async markNotificationAsRead(
    userId: string,
    recipientId: number,
  ): Promise<void> {
    try {
      await this.dataService.update(
        'notification_recipients',
        {
          status: 'read',
          read_at: new Date(),
          updated_at: new Date(),
        },
        [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'id', operator: '=', value: recipientId },
        ],
      );

      this.logger.log(
        `Marked notification ${recipientId} as read for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss/soft delete a notification (set status to 'dismissed')
   */
  async dismissNotification(
    userId: string,
    recipientId: number,
  ): Promise<void> {
    try {
      await this.dataService.update(
        'notification_recipients',
        {
          status: 'dismissed',
          updated_at: new Date(),
        },
        [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'id', operator: '=', value: recipientId },
        ],
      );

      this.logger.log(
        `Dismissed notification ${recipientId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error dismissing notification:', error);
      throw error;
    }
  }

  /**
   * Dismiss all notifications for a user
   */
  async dismissAllNotifications(userId: string): Promise<void> {
    try {
      await this.dataService.update(
        'notification_recipients',
        {
          status: 'dismissed',
          updated_at: new Date(),
        },
        [{ column: 'user_id', operator: '=', value: userId }],
      );

      this.logger.log(`Dismissed all notifications for user ${userId}`);
    } catch (error) {
      this.logger.error('Error dismissing all notifications:', error);
      throw error;
    }
  }
}
