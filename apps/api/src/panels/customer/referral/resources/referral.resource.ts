export class ReferralResource {
  static format(referral: any): any {
    if (!referral) return null;
    return {
      id: referral.id,
      referrer_id: referral.referrer_id,
      referee_name: referral.referee_name,
      referee_phone: referral.referee_phone,
      referral_code: referral.referral_code,
      status: referral.status,
      reward_amount: Number(referral.reward_amount || 0),
      created_at: referral.created_at,
    };
  }

  static formatCollection(referrals: any[]): any[] {
    if (!referrals?.length) return [];
    return referrals.map((r) => ReferralResource.format(r));
  }
}
