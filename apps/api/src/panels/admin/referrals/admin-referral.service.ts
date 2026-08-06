import { Injectable } from '@nestjs/common';
import { DataService } from 'src/shared/database/Data.service';

@Injectable()
export class AdminReferralService {
  constructor(private readonly dataService: DataService) {}

  async getAnalytics(): Promise<any> {
    const referralsResult = await this.dataService.query('referrals', {});
    const allReferrals = referralsResult?.data || [];

    const totalReferrals = allReferrals.length;
    const rewardedReferrals = allReferrals.filter((r: any) => r.status === 'rewarded');
    const pendingReferrals = allReferrals.filter((r: any) => r.status === 'pending');

    const totalRewardsPaid =
      rewardedReferrals.reduce(
        (sum: number, r: any) => sum + Number(r.reward_amount || 50.0),
        0,
      ) * 2; // Referrer + Referee payouts

    const conversionRate =
      totalReferrals > 0
        ? Number(((rewardedReferrals.length / totalReferrals) * 100).toFixed(1))
        : 0;

    return {
      status: true,
      data: {
        total_referrals: totalReferrals,
        pending_referrals: pendingReferrals.length,
        rewarded_referrals: rewardedReferrals.length,
        total_rewards_paid: totalRewardsPaid,
        conversion_rate: conversionRate,
      },
    };
  }

  async getTopReferrers(limit: number = 10): Promise<any> {
    const referralsResult = await this.dataService.query('referrals', {});
    const allReferrals = referralsResult?.data || [];

    const referrerMap = new Map<
      string,
      { referrer_id: string; total_count: number; total_earnings: number }
    >();

    for (const ref of allReferrals) {
      const id = ref.referrer_customer_id;
      if (!id) continue;
      const current = referrerMap.get(id) || {
        referrer_id: id,
        total_count: 0,
        total_earnings: 0,
      };
      current.total_count += 1;
      if (ref.status === 'rewarded' || ref.status === 'completed') {
        current.total_earnings += Number(ref.referrer_reward_amount || 50.0);
      }
      referrerMap.set(id, current);
    }

    const sorted = Array.from(referrerMap.values())
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, limit);

    return {
      status: true,
      data: sorted,
    };
  }

  async getRewardHistory(query: any): Promise<any> {
    const statusFilter = query?.status;
    const search = query?.search?.toLowerCase()?.trim();

    const result = await this.dataService.query('referrals', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
    });
    let list = result?.data || [];

    if (statusFilter) {
      list = list.filter((r: any) => r.status === statusFilter);
    }

    if (search) {
      list = list.filter(
        (r: any) =>
          r.referral_code?.toLowerCase().includes(search) ||
          r.referrer_customer_id?.includes(search) ||
          r.referred_customer_id?.includes(search),
      );
    }

    return {
      status: true,
      total: list.length,
      data: list,
    };
  }
}
