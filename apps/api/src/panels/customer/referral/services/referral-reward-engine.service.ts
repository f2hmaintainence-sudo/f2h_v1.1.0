import { Injectable } from '@nestjs/common';
import { DataService } from 'src/shared/database/Data.service';

@Injectable()
export class ReferralRewardEngineService {
  constructor(private readonly dataService: DataService) {}

  /**
   * Wallet Credit Engine: STEP 9 - STEP 13
   * Atomically credits ₹50 to referrer and ₹50 to referred customer upon first order delivery.
   * Enforces idempotency (STEP 13: status MUST be 'pending', skips if 'rewarded').
   */
  async processReferralReward(refereeCustomerId: string, orderId?: string): Promise<any> {
    if (!refereeCustomerId) return { status: false, message: 'Invalid customer ID' };

    // 1. Fetch Referee Profile
    const refereeRes = await this.dataService.query('customers', {
      where: [{ column: 'customer_id', operator: '=', value: refereeCustomerId }],
      limit: 1,
    });
    const referee = refereeRes?.data?.[0];
    if (!referee) {
      return { status: false, message: 'Referee profile not found' };
    }

    const refereePhone = referee.phone || referee.mobile;
    const referrerId = referee.referred_by;

    // 2. Find pending referral record (STEP 8 & STEP 13)
    let referralRecord: any = null;

    if (referrerId) {
      const refRes = await this.dataService.query('referrals', {
        where: [
          { column: 'referrer_customer_id', operator: '=', value: referrerId },
          { column: 'status', operator: '=', value: 'pending' },
        ],
        limit: 1,
      });
      referralRecord = refRes?.data?.[0];

      if (!referralRecord) {
        const legacyRefRes = await this.dataService.query('referrals', {
          where: [
            { column: 'referrer_id', operator: '=', value: referrerId },
            { column: 'status', operator: '=', value: 'pending' },
          ],
          limit: 1,
        });
        referralRecord = legacyRefRes?.data?.[0];
      }
    }

    if (!referralRecord) {
      const custRes = await this.dataService.query('referrals', {
        where: [
          { column: 'referred_customer_id', operator: '=', value: refereeCustomerId },
          { column: 'status', operator: '=', value: 'pending' },
        ],
        limit: 1,
      });
      referralRecord = custRes?.data?.[0];
    }

    if (!referralRecord && refereePhone) {
      const phoneRes = await this.dataService.query('referrals', {
        where: [
          { column: 'referee_phone', operator: '=', value: refereePhone },
          { column: 'status', operator: '=', value: 'pending' },
        ],
        limit: 1,
      });
      referralRecord = phoneRes?.data?.[0];
    }

    // STEP 13: If no pending referral record exists or already rewarded, exit gracefully
    if (!referralRecord) {
      return {
        status: false,
        message: 'No pending referral found or reward already processed.',
      };
    }

    const targetReferrerId = referralRecord.referrer_customer_id || referralRecord.referrer_id || referrerId;
    if (!targetReferrerId) {
      return { status: false, message: 'Referrer ID missing' };
    }

    const rewardAmount = 50.00;
    const now = new Date();

    // 3. Execute atomic transaction for wallet credits & status updates (STEP 9 - STEP 12)
    return this.dataService.executeTransaction(async (conn) => {
      // ── A. Credit Referrer (+₹50) ──────────────────────────────
      const referrerRes = await this.dataService.queryWithConnection(
        conn,
        'customers',
        {
          select: ['customer_id', 'wallet_balance'],
          where: [{ column: 'customer_id', operator: '=', value: targetReferrerId }],
          limit: 1,
        },
      );
      const referrerCust = referrerRes?.data?.[0];
      const referrerOldBalance = Number(referrerCust?.wallet_balance || 0);
      const referrerNewBalance = referrerOldBalance + rewardAmount;

      await this.dataService.update(
        'customers',
        { wallet_balance: referrerNewBalance, updated_at: now },
        [{ column: 'customer_id', operator: '=', value: targetReferrerId }],
        { transaction: conn },
      );

      await this.dataService.insert(
        'customer_wallet_transactions',
        {
          customer_id: targetReferrerId,
          transaction_type: 'credit',
          amount: rewardAmount,
          balance_after: referrerNewBalance,
          reference_type: 'referral_bonus',
          reference_id: orderId || referralRecord.refer_id || referralRecord.id,
          remarks: `Referral Reward: Invited customer (${referee.first_name || 'Friend'}) completed first order`,
          created_by: refereeCustomerId,
          created_at: now,
        },
        { transaction: conn },
      );

      // ── B. Credit Referred Customer (+₹50) ────────────────
      const refereeOldBalance = Number(referee.wallet_balance || 0);
      const refereeNewBalance = refereeOldBalance + rewardAmount;

      await this.dataService.update(
        'customers',
        { wallet_balance: refereeNewBalance, updated_at: now },
        [{ column: 'customer_id', operator: '=', value: refereeCustomerId }],
        { transaction: conn },
      );

      await this.dataService.insert(
        'customer_wallet_transactions',
        {
          customer_id: refereeCustomerId,
          transaction_type: 'credit',
          amount: rewardAmount,
          balance_after: refereeNewBalance,
          reference_type: 'referral_bonus',
          reference_id: orderId || referralRecord.refer_id || referralRecord.id,
          remarks: `Welcome Reward: First order completed using referral code`,
          created_by: targetReferrerId,
          created_at: now,
        },
        { transaction: conn },
      );

      // ── C. STEP 12: Mark Referral = 'rewarded' ────────
      const updateWhere = referralRecord.id
        ? [{ column: 'id', operator: '=', value: referralRecord.id }]
        : [{ column: 'refer_id', operator: '=', value: referralRecord.refer_id }];

      await this.dataService.update(
        'referrals',
        {
          status: 'rewarded',
          referrer_reward_amount: rewardAmount,
          referred_reward_amount: rewardAmount,
          rewarded_at: now,
          updated_at: now,
        },
        updateWhere,
        { transaction: conn },
      );

      // ── D. Insert In-App Notifications for Referrer & Referee ────────
      try {
        const notifId1 = 'NTF-' + Date.now() + '-REF1';
        await this.dataService.insert(
          'notifications',
          {
            notification_id: notifId1,
            title: '🎉 Referral Bonus Received!',
            message: `₹50 credited to your wallet! Your friend ${referee.first_name || 'a new customer'} completed their 1st delivered order.`,
            medium: 'push',
            type: 'referral_bonus',
            priority: 'high',
            status: 'sent',
            created_at: now,
            updated_at: now,
          },
          { transaction: conn },
        );
        await this.dataService.insert(
          'notification_recipients',
          {
            notification_id: notifId1,
            user_id: targetReferrerId,
            status: 'unread',
            created_at: now,
            updated_at: now,
          },
          { transaction: conn },
        );

        const notifId2 = 'NTF-' + Date.now() + '-REF2';
        await this.dataService.insert(
          'notifications',
          {
            notification_id: notifId2,
            title: '🎉 Welcome Reward Unlocked!',
            message: `₹50 credited to your wallet for completing your 1st order! Your referral code is now unlocked 🔓.`,
            medium: 'push',
            type: 'referral_bonus',
            priority: 'high',
            status: 'sent',
            created_at: now,
            updated_at: now,
          },
          { transaction: conn },
        );
        await this.dataService.insert(
          'notification_recipients',
          {
            notification_id: notifId2,
            user_id: refereeCustomerId,
            status: 'unread',
            created_at: now,
            updated_at: now,
          },
          { transaction: conn },
        );
      } catch (_) {
        // Continue if notification insertion table schema differs
      }

      return {
        status: true,
        message: `Successfully processed referral rewards! ₹${rewardAmount} credited to referrer and referred customer.`,
        referrer_new_balance: referrerNewBalance,
        referee_new_balance: refereeNewBalance,
      };
    });
  }
}
