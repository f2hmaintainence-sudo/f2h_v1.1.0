import { ReferralService } from './referral.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Step 15 – Testing & QA: Referral Service
 *
 * Test cases covered:
 * - Signup without referral (getReferralDetails works)
 * - Invalid referral code validation
 * - Self-referral prevention
 * - Valid referral code validation
 */

const mockReferralRepository = () => ({
  findByReferrerId: jest.fn(),
  findByReferralCode: jest.fn(),
  getTotalEarnings: jest.fn(),
  createReferral: jest.fn(),
  getCustomerByCustomerId: jest.fn(),
  ensureCustomerReferralCode: jest.fn().mockResolvedValue({
    referral_code: 'USER-1',
    referral_status: 'locked',
  }),
});

describe('ReferralService', () => {
  let service: ReferralService;
  let repo: ReturnType<typeof mockReferralRepository>;

  beforeEach(() => {
    repo = mockReferralRepository();
    service = new ReferralService(repo as any);
  });

  // ─── Test Case: Signup without referral (get details) ───────
  it('getReferralDetails should return code and stats', async () => {
    repo.findByReferrerId.mockResolvedValue([]);
    repo.getTotalEarnings.mockResolvedValue(0);

    const result = await service.getReferralDetails('USER-1');

    expect(result.status).toBe(true);
    expect(result.data.referral_code).toBe('USER-1');
    expect(result.data.reward_per_referral).toBe(100.00);
    expect(result.data.total_referrals).toBe(0);
    expect(result.data.total_earnings).toBe(0);
  });

  // ─── Test Case: Invalid referral code ────────────────────────
  it('validateReferralCode should return valid=false for nonexistent code', async () => {
    repo.findByReferralCode.mockResolvedValue(null);

    const result = await service.validateReferralCode('USER-2', 'INVALID99');

    expect(result.status).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid referral code');
  });

  // ─── Test Case: Self-referral prevention ────────────────────
  it('validateReferralCode should reject self-referral', async () => {
    repo.findByReferralCode.mockResolvedValue({ customer_id: 'USER-3', user_id: 'USER-3' });

    const result = await service.validateReferralCode('USER-3', 'F2HMYCODE');

    expect(result.status).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Self-referral is not allowed');
  });

  // ─── Test Case: Valid referral code ──────────────────────────
  it('validateReferralCode should return valid=true for a valid code', async () => {
    repo.findByReferralCode.mockResolvedValue({
      customer_id: 'OTHER-USER',
      user_id: 'OTHER-USER',
      first_name: 'Rahul',
    });

    const result = await service.validateReferralCode('USER-4', 'F2HRAHUL01');

    expect(result.status).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.referrer_name).toBe('Rahul');
  });

  // ─── Test Case: Empty code validation ────────────────────────
  it('validateReferralCode should throw for empty code', async () => {
    await expect(service.validateReferralCode('USER-5', '')).rejects.toThrow(BadRequestException);
  });
});
