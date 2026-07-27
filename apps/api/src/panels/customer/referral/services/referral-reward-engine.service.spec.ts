import { ReferralRewardEngineService } from './referral-reward-engine.service';

/**
 * Step 15 – Testing & QA: Referral Reward Engine
 *
 * Test cases covered:
 * - Reward credited once (pending referral found)
 * - Wallet balance updated (both referrer & referee)
 * - No pending referral → graceful exit
 * - Missing referrer ID
 */

const mockDataService = () => ({
  query: jest.fn(),
  queryWithConnection: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  executeTransaction: jest.fn((fn) => fn({})),
});

describe('ReferralRewardEngineService', () => {
  let service: ReferralRewardEngineService;
  let dataService: ReturnType<typeof mockDataService>;

  beforeEach(() => {
    dataService = mockDataService();
    service = new ReferralRewardEngineService(dataService as any);
  });

  // ─── Test Case: Reward credited once ────────────────────────
  it('should credit ₹50 to both referrer and referee', async () => {
    // Referee profile
    dataService.query.mockResolvedValueOnce({
      data: [{ customer_id: 'C2', phone: '9876543210', referred_by: 'C1', wallet_balance: 100 }],
    });
    // Pending referral record
    dataService.query.mockResolvedValueOnce({
      data: [{ id: 'REF-001', referrer_id: 'C1', referee_phone: '9876543210', status: 'pending' }],
    });
    // Referrer customer (inside transaction via queryWithConnection)
    dataService.queryWithConnection.mockResolvedValueOnce({
      data: [{ customer_id: 'C1', wallet_balance: 200 }],
    });
    dataService.update.mockResolvedValue({});
    dataService.insert.mockResolvedValue({});

    const result = await service.processReferralReward('C2', 'ORD-1');

    expect(result.status).toBe(true);
    expect(result.referrer_new_balance).toBe(250); // 200 + 50
    expect(result.referee_new_balance).toBe(150);  // 100 + 50
  });

  // ─── Test Case: No pending referral ─────────────────────────
  it('should return false if no pending referral exists', async () => {
    dataService.query
      .mockResolvedValueOnce({ data: [{ customer_id: 'C3', phone: '1234567890', referred_by: null }] })
      .mockResolvedValueOnce({ data: [] })  // no by referrer_id
      .mockResolvedValueOnce({ data: [] }); // no by phone

    const result = await service.processReferralReward('C3', 'ORD-2');

    expect(result.status).toBe(false);
    expect(result.message).toContain('No pending referral');
  });

  // ─── Test Case: Invalid customer ID ─────────────────────────
  it('should return false for empty refereeCustomerId', async () => {
    const result = await service.processReferralReward('', 'ORD-3');
    expect(result.status).toBe(false);
  });

  // ─── Test Case: Referee not found ───────────────────────────
  it('should return false if referee profile not found', async () => {
    dataService.query.mockResolvedValueOnce({ data: [] });

    const result = await service.processReferralReward('C999', 'ORD-4');

    expect(result.status).toBe(false);
    expect(result.message).toContain('Referee profile not found');
  });
});
