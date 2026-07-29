import { Injectable } from '@nestjs/common';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';

@Injectable()
export class ReferralRewardEngineService {
  constructor(
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Wallet Credit Engine: STEP 9 - STEP 13
   * Atomically credits ₹50 to referrer and ₹50 to referred customer upon first order delivery.
   * Enforces idempotency (STEP 13: status MUST be 'pending', skips if 'rewarded').
   */
  async processReferralReward(refereeCustomerId: string, orderId?: string): Promise<any> {
    if (!refereeCustomerId) return { status: false, message: 'Invalid customer ID' };

    // 1. Fetch Referee Profile
    const refereeQuery = `SELECT * FROM customers WHERE customer_id = $1 OR email = $1 OR phone = $1 LIMIT 1`;
    const refereeRows = await this.db.query(refereeQuery, [refereeCustomerId]);
    const referee = refereeRows?.[0];
    if (!referee) {
      return { status: false, message: 'Referee profile not found' };
    }

    const realRefereeId = referee.customer_id;
    const refereePhone = referee.phone || referee.mobile || '';
    const referrerId = referee.referred_by || '';

    // 2. Find pending referral record (Direct SQL)
    const refQuery = `
      SELECT * FROM referrals 
      WHERE (
        referred_customer_id = $1 OR 
        referred_customer_id = $2 OR 
        (referee_phone = $3 AND $3 != '') OR 
        (referrer_customer_id = $4 AND $4 != '') OR 
        (referrer_id = $4 AND $4 != '')
      )
      AND LOWER(status) = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const refRows = await this.db.query(refQuery, [refereeCustomerId, realRefereeId, refereePhone, referrerId]);
    const referralRecord = refRows?.[0];

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

    // Check if referrer is a delivery partner (rider)
    let isDeliveryPartner = false;
    try {
      const dpCheck = await this.db.query(
        `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 OR user_id = $1 LIMIT 1`,
        [targetReferrerId],
      );
      if (dpCheck?.length > 0) {
        isDeliveryPartner = true;
      }
    } catch (_) {}

    const referrerRewardAmount = isDeliveryPartner ? 75.00 : 50.00;
    const refereeRewardAmount = 50.00;
    const now = new Date();

    // ── A. Credit Referrer (Only if referrer is a Customer) ──────────────────────
    if (!isDeliveryPartner) {
      const referrerRes = await this.dataService.query('customers', {
        select: ['customer_id', 'wallet_balance'],
        where: [{ column: 'customer_id', operator: '=', value: targetReferrerId }],
        limit: 1,
      });
      const referrerCust = referrerRes?.data?.[0];
      if (referrerCust) {
        const referrerOldBalance = Number(referrerCust.wallet_balance || 0);
        const referrerNewBalance = referrerOldBalance + referrerRewardAmount;

        await this.dataService.update(
          'customers',
          { wallet_balance: referrerNewBalance, updated_at: now },
          [{ column: 'customer_id', operator: '=', value: targetReferrerId }],
        );

        await this.dataService.insert(
          'customer_wallet_transactions',
          {
            customer_id: targetReferrerId,
            transaction_type: 'credit',
            amount: referrerRewardAmount,
            balance_after: referrerNewBalance,
            reference_type: 'referral_bonus',
            reference_id: orderId || referralRecord.refer_id || referralRecord.id,
            remarks: `Referral Reward: Invited customer (${referee.first_name || 'Friend'}) completed first order`,
            created_by: refereeCustomerId,
            created_at: now,
          },
        );
      }
    }

    // ── B. Credit Referred Customer (+₹50) ────────────────
    const refereeOldBalance = Number(referee.wallet_balance || 0);
    const refereeNewBalance = refereeOldBalance + refereeRewardAmount;

    await this.dataService.update(
      'customers',
      { wallet_balance: refereeNewBalance, updated_at: now },
      [{ column: 'customer_id', operator: '=', value: refereeCustomerId }],
    );

    await this.dataService.insert(
      'customer_wallet_transactions',
      {
        customer_id: refereeCustomerId,
        transaction_type: 'credit',
        amount: refereeRewardAmount,
        balance_after: refereeNewBalance,
        reference_type: 'referral_bonus',
        reference_id: orderId || referralRecord.refer_id || referralRecord.id,
        remarks: `Welcome Reward: First order completed using referral code`,
        created_by: targetReferrerId,
        created_at: now,
      },
    );

    // ── C. Mark Referral = 'rewarded' (Direct SQL) ────────
    await this.db.query(
      `UPDATE referrals 
       SET status = 'rewarded', 
           referrer_reward_amount = $1, 
           referred_reward_amount = $2, 
           rewarded_at = $3, 
           updated_at = $3 
       WHERE id = $4 OR refer_id = $5`,
      [
        referrerRewardAmount,
        refereeRewardAmount,
        now,
        referralRecord.id,
        referralRecord.refer_id,
      ],
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
      );
    } catch (_) {}

    return {
      status: true,
      message: `Successfully processed referral rewards! ₹${referrerRewardAmount} for referrer and ₹${refereeRewardAmount} for referred customer.`,
      is_delivery_partner: isDeliveryPartner,
      referrer_reward_amount: referrerRewardAmount,
      referee_new_balance: refereeNewBalance,
    };
  }
}
