import { Injectable } from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';

@Injectable()
export class FirstOrderDetectorService {
  constructor(private readonly dataService: DataService) {}

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
      // Past delivered order exists - update flag and return false
      await this.dataService.update(
        'customers',
        { first_order_completed: true, referral_status: 'active', updated_at: new Date() },
        [{ column: 'customer_id', operator: '=', value: customerId }],
      );
      return false;
    }

    // Step 8: Unlock Referral Code (using customer's user_id) & Mark First Order Completed
    const now = new Date();
    await this.dataService.update(
      'customers',
      {
        first_order_completed: true,
        referral_status: 'active',
        updated_at: now,
      },
      [{ column: 'customer_id', operator: '=', value: customerId }],
    );

    return true;
  }

  /**
   * Explicit helper to unlock a customer's referral code.
   */
  async unlockReferralCode(customerId: string): Promise<void> {
    const now = new Date();
    await this.dataService.update(
      'customers',
      {
        referral_status: 'active',
        first_order_completed: true,
        updated_at: now,
      },
      [{ column: 'customer_id', operator: '=', value: customerId }],
    );
  }
}
