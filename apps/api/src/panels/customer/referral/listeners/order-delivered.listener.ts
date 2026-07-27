import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderDeliveredEvent } from '../events/order-delivered.event';
import { FirstOrderDetectorService } from '../services/first-order-detector.service';
import { ReferralRewardEngineService } from '../services/referral-reward-engine.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Injectable()
export class OrderDeliveredListener {
  constructor(
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
    private readonly developer: DeveloperService,
  ) {}

  @OnEvent('order.delivered')
  async handleOrderDeliveredEvent(event: OrderDeliveredEvent) {
    try {
      this.developer.log('OrderDeliveredEvent received', {
        orderId: event.orderId,
        customerId: event.customerId,
      });

      // Detect first order delivery
      const isFirstOrder = await this.firstOrderDetector.detectAndMarkFirstOrder(
        event.customerId,
        event.orderId,
      );

      if (isFirstOrder) {
        // Unlock referral code
        await this.firstOrderDetector.unlockReferralCode(event.customerId);

        // Credit wallet rewards for referrer & referee
        await this.referralRewardEngine.processReferralReward(
          event.customerId,
          event.orderId,
        );
      }
    } catch (error) {
      this.developer.error('Error in OrderDeliveredListener', { error, event });
    }
  }
}
