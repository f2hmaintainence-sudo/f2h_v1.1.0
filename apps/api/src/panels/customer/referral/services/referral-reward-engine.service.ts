import { Injectable, Logger } from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Injectable()
export class ReferralRewardEngineService {
  private readonly logger = new Logger(ReferralRewardEngineService.name);

  constructor(
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  /**
   * Unified Referral Reward Engine
   *
   * Atomically processes referral rewards when a referred customer's first order is delivered.
   * Executes inside a PostgreSQL transaction with SELECT ... FOR UPDATE row-level locking
   * to guarantee strict single-execution idempotency (no double-crediting).
   *
   * Customer referrer  → ₹50 to referrer wallet, ₹50 to referee wallet
   * DP referrer        → ₹75 to DP bonus table (for salary), ₹0 to referee
   */
  async processReferralReward(refereeCustomerId: string, orderId?: string): Promise<any> {
    if (!refereeCustomerId) return { status: false, message: 'Invalid customer ID' };

    this.logger.log(`ORDER_DELIVERED_REFERRAL_CHECK - orderId: ${orderId || 'N/A'}, customerId: ${refereeCustomerId}`);

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // 1. Fetch Referee Customer Profile via JOIN users
      const refereeRes = await client.query(
        `SELECT c.*, u.first_name, u.last_name, u.user_name, u.phone, u.email
         FROM customers c
         JOIN users u ON u.user_id = c.customer_id
         WHERE c.customer_id = $1 OR u.email = $1 OR u.phone = $1 LIMIT 1`,
        [refereeCustomerId],
      );
      const referee = refereeRes.rows?.[0];
      if (!referee) {
        await client.query('COMMIT');
        this.logger.warn(`REFERRAL_NOT_FOUND - Referee profile not found for customerId: ${refereeCustomerId}`);
        return { status: false, message: 'Referee profile not found' };
      }

      const realRefereeId = referee.customer_id;
      const refereePhone = referee.phone || referee.mobile || '';
      const refereeEmail = referee.email || '';
      let referrerId = referee.referred_by || '';

      // 2. Locate and LOCK Referral Record (pending, status != 'rewarded')
      const refRes = await client.query(
        `SELECT * FROM referrals
         WHERE (
           referred_customer_id = $1 OR
           referred_customer_id = $2
         )
         AND (status = 'pending' OR (status != 'rewarded' AND rewarded_at IS NULL))
         LIMIT 1
         FOR UPDATE`,
        [realRefereeId, refereeCustomerId],
      );

      let referralRecord = refRes.rows?.[0];

      // 2b. Auto-create referral row if only referred_by exists on customer profile
      if (!referralRecord && referrerId) {
        const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
        const rnd = Math.floor(Math.random() * 9000 + 1000);
        const referId = `REF${ts}${rnd}`;
        const refCode = referrerId || 'F2HREF';

        // Detect DP referrer
        const dpCheck = await client.query(
          `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
          [referrerId],
        );
        const isNewDpReferrer = dpCheck.rows?.length > 0;

        await client.query(
          `INSERT INTO referrals (
            refer_id, referrer_customer_id, referred_customer_id, referral_code,
            referrer_reward_amount, referred_reward_amount,
            status, remarks, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6,
                    'pending', 'Referral auto-synced on order delivery', NOW(), NOW())`,
          [
            referId, referrerId, realRefereeId, refCode,
            isNewDpReferrer ? 75.00 : 100.00,
            0.00,
          ],
        );

        const newRefRes = await client.query(
          `SELECT * FROM referrals WHERE refer_id = $1 FOR UPDATE LIMIT 1`,
          [referId],
        );
        referralRecord = newRefRes.rows?.[0];
      }

      if (!referralRecord) {
        await client.query('COMMIT');
        this.logger.log(`REFERRAL_NOT_FOUND - No eligible pending referral record for customerId: ${refereeCustomerId}`);
        return { status: false, message: 'No eligible referral record found or reward already processed.' };
      }

      const targetReferrerId = referralRecord.referrer_customer_id || referrerId;
      if (!targetReferrerId) {
        await client.query('COMMIT');
        this.logger.warn(`REFERRAL_NOT_ELIGIBLE - Referrer ID missing for referral ${referralRecord.refer_id || referralRecord.id}`);
        return { status: false, message: 'Referrer ID missing' };
      }

      if (referralRecord.status === 'rewarded' || referralRecord.rewarded_at != null) {
        await client.query('COMMIT');
        this.logger.log(`REFERRAL_ALREADY_REWARDED - Referral ${referralRecord.refer_id || referralRecord.id} is already rewarded`);
        return { status: false, message: 'Referral reward already processed previously.' };
      }

      this.logger.log(
        `REFERRAL_FOUND - referralId: ${referralRecord.refer_id || referralRecord.id}, referredCustomerId: ${referralRecord.referred_customer_id}, referrerCustomerId: ${targetReferrerId}, status: ${referralRecord.status}`,
      );

      // 3. Detect if referrer is a delivery partner
      const dpRows = await client.query(
        `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
        [targetReferrerId],
      );
      const referrerIsDP = dpRows.rows?.length > 0;

      const referrerRewardAmount = referrerIsDP
        ? 75.00
        : Number(referralRecord.referrer_reward_amount ?? referralRecord.reward_amount ?? 100.00) || 100.00;
      const referredRewardAmount = referrerIsDP
        ? 0.00
        : Number(referralRecord.referred_reward_amount ?? 0.00) || 0.00;
      const now = new Date();

      // ── A. Credit Referrer (₹100 to wallet upon referee's 1st completed order) ──
      if (referrerIsDP) {
        const bonusId = `DPB${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}${Math.floor(Math.random() * 9000 + 1000)}`;
        await client.query(
          `INSERT INTO delivery_partner_referral_bonuses
             (bonus_id, partner_id, refer_id, referee_name, referee_phone, order_id, amount, status, remarks, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())`,
          [
            bonusId,
            targetReferrerId,
            referralRecord.refer_id || null,
            referee.first_name || referee.name || 'Customer',
            referee.phone || '',
            orderId || null,
            referrerRewardAmount,
            `Referral bonus: ${referee.first_name || 'Customer'} completed 1st delivered order (order: ${orderId || 'N/A'})`,
          ],
        );
      } else {
        // Customer referrer: credit ₹100
        const referrerUpdateRes = await client.query(
          `UPDATE customers
           SET wallet_balance = COALESCE(wallet_balance, 0) + $1, updated_at = NOW()
           WHERE customer_id = $2
           RETURNING wallet_balance`,
          [referrerRewardAmount, targetReferrerId],
        );
        const referrerNewBalance = Number(referrerUpdateRes.rows?.[0]?.wallet_balance ?? referrerRewardAmount);

        const refTxId = `WT${Math.floor(Date.now() / 1000).toString(36)}${Math.floor(Math.random() * 9000 + 1000)}`;
        await client.query(
          `INSERT INTO customer_wallet_transactions
             (transaction_id, customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            refTxId,
            targetReferrerId,
            'credit',
            referrerRewardAmount,
            referrerNewBalance,
            'referral_bonus',
            orderId || referralRecord.refer_id || String(referralRecord.id),
            `Referral Reward: ${referee.first_name || referee.name || 'Friend'} completed 1st order`,
            realRefereeId,
            now,
          ],
        );
      }

      // ── B. Update Referee (Unlock referral code as user_id) ──────────────────
      let refereeNewBalance = Number(referee.wallet_balance || 0);

      if (referredRewardAmount > 0) {
        const refereeUpdateRes = await client.query(
          `UPDATE customers
           SET wallet_balance = COALESCE(wallet_balance, 0) + $1,
               first_order_completed = true,
               updated_at = NOW()
           WHERE customer_id = $2 OR customer_id = $3
           RETURNING wallet_balance`,
          [referredRewardAmount, realRefereeId, refereeCustomerId],
        );
        refereeNewBalance = Number(refereeUpdateRes.rows?.[0]?.wallet_balance ?? referredRewardAmount);

        const feeTxId = `WT${Math.floor(Date.now() / 1000).toString(36)}${Math.floor(Math.random() * 9000 + 1000)}`;
        await client.query(
          `INSERT INTO customer_wallet_transactions
             (transaction_id, customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            feeTxId,
            realRefereeId,
            'credit',
            referredRewardAmount,
            refereeNewBalance,
            'referral_bonus',
            orderId || referralRecord.refer_id || String(referralRecord.id),
            'Welcome Reward: First order completed using referral code',
            targetReferrerId,
            now,
          ],
        );
      } else {
        await client.query(
          `UPDATE customers
           SET first_order_completed = true,
               updated_at = NOW()
           WHERE customer_id = $1 OR customer_id = $2`,
          [realRefereeId, refereeCustomerId],
        );
      }

      // ── C. Mark Referral = 'rewarded' ──────────────────────────────────────────
      await client.query(
        `UPDATE referrals
         SET status = 'rewarded',
             referrer_reward_amount = $1,
             referred_reward_amount = $2,
             rewarded_at = NOW(),
             updated_at = NOW()
         WHERE id = $3 OR refer_id = $4`,
        [
          referrerRewardAmount, referredRewardAmount,
          referralRecord.id, referralRecord.refer_id,
        ],
      );

      await client.query('COMMIT');

      // ── D. Send Notifications Post-Commit (Non-blocking) ───────────────────────
      if (!referrerIsDP) {
        this.sendNotificationSafe(
          targetReferrerId,
          '🎉 Referral Bonus Received!',
          `₹${referrerRewardAmount} credited to your wallet! Your friend ${referee.first_name || 'a customer'} completed their 1st delivered order.`,
        ).catch(() => {});
      }

      this.sendNotificationSafe(
        realRefereeId,
        '🎉 Referral Code Unlocked!',
        `Your 1st order has been delivered! Your personal referral code (${realRefereeId}) is now unlocked 🔓. Share with friends to earn ₹100 on their first order!`,
      ).catch(() => {});

      this.logger.log(
        `REFERRAL_REWARDED - referralId: ${referralRecord.refer_id || referralRecord.id}, referrerId: ${targetReferrerId}, refereeId: ${realRefereeId}, referrerAmount: ${referrerRewardAmount}, refereeAmount: ${referredRewardAmount}`,
      );

      return {
        status: true,
        referrer_type: referrerIsDP ? 'delivery_partner' : 'customer',
        referrer_reward: referrerRewardAmount,
        referee_reward: referredRewardAmount,
        referee_new_balance: refereeNewBalance,
        message: referrerIsDP
          ? `Rewards processed: ₹${referrerRewardAmount} DP bonus recorded for salary.`
          : `Rewards processed: ₹${referrerRewardAmount} credited to referrer wallet.`,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `REFERRAL_REWARD_FAILED - Error processing referral reward for customerId: ${refereeCustomerId}, orderId: ${orderId || 'N/A'}`,
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }

  private async sendNotificationSafe(userId: string, title: string, message: string): Promise<void> {
    try {
      const notifId = `NTF-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
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
      this.developer.warn('sendNotificationSafe failed:', { userId, title, error: e });
    }
  }
}

