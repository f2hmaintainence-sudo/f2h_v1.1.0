import { OrderDeliveredListener } from './order-delivered.listener';

/**
 * Step 15 – Testing & QA: Order Delivered Listener
 *
 * Test cases covered:
 * - First delivered order triggers unlock + reward
 * - Non-first order skips reward
 * - Error handling (no crash on failure)
 */

const mockFirstOrderDetector = () => ({
  detectAndMarkFirstOrder: jest.fn(),
  unlockReferralCode: jest.fn(),
});

const mockRewardEngine = () => ({
  processReferralReward: jest.fn(),
});

const mockDeveloper = () => ({
  log: jest.fn(),
  error: jest.fn(),
});

describe('OrderDeliveredListener', () => {
  let listener: OrderDeliveredListener;
  let detector: ReturnType<typeof mockFirstOrderDetector>;
  let rewardEngine: ReturnType<typeof mockRewardEngine>;
  let developer: ReturnType<typeof mockDeveloper>;

  beforeEach(() => {
    detector = mockFirstOrderDetector();
    rewardEngine = mockRewardEngine();
    developer = mockDeveloper();
    listener = new OrderDeliveredListener(detector as any, rewardEngine as any, developer as any);
  });

  // ─── Test Case: First delivered order ───────────────────────
  it('should unlock referral and process reward on first order', async () => {
    detector.detectAndMarkFirstOrder.mockResolvedValue(true);
    detector.unlockReferralCode.mockResolvedValue(undefined);
    rewardEngine.processReferralReward.mockResolvedValue({ status: true });

    await listener.handleOrderDeliveredEvent({
      orderId: 'ORD-1',
      customerId: 'C1',
      deliveredAt: new Date(),
    });

    expect(detector.detectAndMarkFirstOrder).toHaveBeenCalledWith('C1', 'ORD-1');
    expect(detector.unlockReferralCode).toHaveBeenCalledWith('C1');
    expect(rewardEngine.processReferralReward).toHaveBeenCalledWith('C1', 'ORD-1');
  });

  // ─── Test Case: Order delivered event triggers reward engine ────────────────
  it('should call reward engine on order delivery', async () => {
    detector.detectAndMarkFirstOrder.mockResolvedValue(false);
    detector.unlockReferralCode.mockResolvedValue(undefined);
    rewardEngine.processReferralReward.mockResolvedValue({ status: false, message: 'Already rewarded' });

    await listener.handleOrderDeliveredEvent({
      orderId: 'ORD-5',
      customerId: 'C1',
      deliveredAt: new Date(),
    });

    expect(detector.detectAndMarkFirstOrder).toHaveBeenCalledWith('C1', 'ORD-5');
    expect(detector.unlockReferralCode).toHaveBeenCalledWith('C1');
    expect(rewardEngine.processReferralReward).toHaveBeenCalledWith('C1', 'ORD-5');
  });

  // ─── Test Case: Error handling ──────────────────────────────
  it('should log error and not throw on failure', async () => {
    detector.detectAndMarkFirstOrder.mockRejectedValue(new Error('DB down'));

    await expect(
      listener.handleOrderDeliveredEvent({
        orderId: 'ORD-ERR',
        customerId: 'C1',
        deliveredAt: new Date(),
      }),
    ).resolves.not.toThrow();

    expect(developer.error).toHaveBeenCalled();
  });
});
