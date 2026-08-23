export interface IReferralRepository {
  findByReferrerId(referrerId: string): Promise<any[]>;
  findByReferralCode(code: string): Promise<any | null>;
  findByRefereePhone(phone: string): Promise<any | null>;
  createReferral(data: any): Promise<any>;
  getTotalEarnings(referrerId: string): Promise<number>;
  getCustomerByCustomerId(customerId: string): Promise<any | null>;
  ensureCustomerReferralCode(customerId: string): Promise<{ referral_code: string | null; referral_status: string; customer_id?: string }>;
}
