import { Injectable } from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Injectable()
export class FirstOrderDetectorService {
  constructor(
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  /**
   * Detects if an order is the customer's first delivered/completed order.
   * Enforces single-trigger execution and idempotency.
   */
  async detectAndMarkFirstOrder(customerId: string, orderId: string): Promise<boolean> {
    if (!customerId) return false;

    // Feature 1: Check first_order_completed
    const customerResult = await this.dataService.query('customers', {
      select: ['customer_id', 'first_order_completed'],
      where: [{ column: 'customer_id', operator: '=', value: customerId }],
      limit: 1,
    });

    const customer = customerResult?.data?.[0];

    // Feature 2: Ignore future orders if already marked as completed
    if (
      customer?.first_order_completed === true ||
      customer?.first_order_completed === 'true' ||
      customer?.first_order_completed === 1
    ) {
      return false;
    }

    // Check if customer has older delivered/completed orders (excluding current orderId)
    const prevOrdersRes = await this.dataService.query('orders', {
      select: ['order_id'],
      where: [
        { column: 'customer_id', operator: '=', value: customerId },
        { column: 'status', operator: 'IN', value: ['delivered', 'completed'] },
        { column: 'order_id', operator: '!=', value: orderId },
      ],
      limit: 1,
    });

    if (prevOrdersRes?.data?.length > 0) {
      // Past delivered order exists - update flag silently and return false (no notification)
      await this.dataService.update(
        'customers',
        { first_order_completed: true, updated_at: new Date() },
        [{ column: 'customer_id', operator: '=', value: customerId }],
      );
      return false;
    }

    // Genuine 1st Delivered Order: Mark completed & send Unlock Notification once
    const now = new Date();
    await this.dataService.update(
      'customers',
      {
        first_order_completed: true,
        updated_at: now,
      },
      [{ column: 'customer_id', operator: '=', value: customerId }],
    );

    // Send single unlock notification
    this.sendUnlockNotificationSafe(customerId).catch(() => {});

    return true;
  }

  /**
   * Explicit helper to unlock a customer's referral code without duplicate notifications.
   */
  async unlockReferralCode(customerId: string): Promise<void> {
    const now = new Date();
    await this.dataService.update(
      'customers',
      {
        first_order_completed: true,
        updated_at: now,
      },
      [{ column: 'customer_id', operator: '=', value: customerId }],
    );
  }

  private async sendUnlockNotificationSafe(userId: string): Promise<void> {
    try {
      const notifId = `NTF-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const title = '🎉 Referral Code Unlocked!';
      const message = `Your 1st order has been delivered! Your personal referral code (${userId}) is now unlocked 🔓. Share with friends to earn ₹100 on their first order!`;

      await this.db.query(
        `INSERT INTO notifications (notification_id, title, message, medium, type, priority, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, 'push', 'referral_bonus', 'high', 'sent', 'system', NOW(), NOW())`,
        [notifId, title, message],
      );
      await this.db.query(
        `INSERT INTO notification_recipients (notification_id, user_id, status, created_by, created_at, updated_at)
         VALUES ($1, $2, 'unread', 'system', NOW(), NOW())`,
        [notifId, userId],
      );
    } catch (e) {
      this.developer.warn('sendUnlockNotificationSafe failed:', { userId, error: e });
    }
  }
}
