import { ReferralRewardEngineService } from './referral-reward-engine.service';

describe('ReferralRewardEngineService', () => {
  let service: ReferralRewardEngineService;
  let mockDataService: any;
  let mockDatabaseService: any;
  let mockClient: any;
  let mockDeveloperService: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockDataService = {
      insert: jest.fn(),
      update: jest.fn(),
    };
    mockDatabaseService = {
      getClient: jest.fn().mockResolvedValue(mockClient),
    };
    mockDeveloperService = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    service = new ReferralRewardEngineService(
      mockDataService as any,
      mockDatabaseService as any,
      mockDeveloperService as any,
    );
  });

  // ─── Test Case: Invalid customer ID ─────────────────────────
  it('should return false for empty refereeCustomerId', async () => {
    const result = await service.processReferralReward('', 'ORD-3');
    expect(result.status).toBe(false);
  });

  // ─── Test Case: Referee not found ───────────────────────────
  it('should return false if referee profile not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT referee customer
      .mockResolvedValueOnce({}); // COMMIT

    const result = await service.processReferralReward('C999', 'ORD-4');

    expect(result.status).toBe(false);
    expect(result.message).toContain('Referee profile not found');
  });

  // ─── Test Case: Reward credited once (Customer to Customer) ─
  it('should credit ₹100 to customer referrer inside transaction', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ customer_id: 'C2', phone: '9876543210', referred_by: 'C1', wallet_balance: 100 }],
      }) // SELECT referee profile
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'REF-001',
            refer_id: 'REF001',
            referrer_customer_id: 'C1',
            referred_customer_id: 'C2',
            referrer_reward_amount: 100,
            referred_reward_amount: 0,
            status: 'pending',
          },
        ],
      }) // SELECT FOR UPDATE referrals
      .mockResolvedValueOnce({ rows: [] }) // SELECT delivery_partners (not DP)
      .mockResolvedValueOnce({ rows: [{ wallet_balance: 200 }] }) // UPDATE referrer wallet balance (+100)
      .mockResolvedValueOnce({}) // INSERT referrer wallet transaction
      .mockResolvedValueOnce({}) // INSERT referrer notification
      .mockResolvedValueOnce({}) // INSERT referrer notification recipient
      .mockResolvedValueOnce({}) // UPDATE customers (first_order_completed = true, referral_code = 'C2')
      .mockResolvedValueOnce({}) // UPDATE users (first_order_completed = true, referral_code = 'C2')
      .mockResolvedValueOnce({}) // UPDATE referrals status = 'rewarded'
      .mockResolvedValueOnce({}) // INSERT referee notification
      .mockResolvedValueOnce({}) // INSERT referee notification recipient
      .mockResolvedValueOnce({}); // COMMIT

    const result = await service.processReferralReward('C2', 'ORD-1');

    expect(result.status).toBe(true);
    expect(result.referrer_reward).toBe(100);
    expect(result.referee_reward).toBe(0);
    expect(result.referee_new_balance).toBe(100);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  // ─── Test Case: No pending referral ─────────────────────────
  it('should return false if no eligible pending referral exists', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ customer_id: 'C3', phone: '1234567890', referred_by: null }],
      }) // SELECT referee
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE referrals (no pending referral)
      .mockResolvedValueOnce({}); // COMMIT

    const result = await service.processReferralReward('C3', 'ORD-2');

    expect(result.status).toBe(false);
    expect(result.message).toContain('No eligible referral record found');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
