import { FirstOrderDetectorService } from './first-order-detector.service';

/**
 * Step 15 – Testing & QA: First Order Detector
 *
 * Test cases covered:
 * - First delivered order detection
 * - Cancelled order (no trigger)
 * - Reward credited once (idempotency)
 * - Referral unlocked after first order
 */

// Minimal mock for DataService
const mockDataService = () => ({
  query: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  executeTransaction: jest.fn((fn) => fn({})),
});

describe('FirstOrderDetectorService', () => {
  let service: FirstOrderDetectorService;
  let dataService: ReturnType<typeof mockDataService>;

  beforeEach(() => {
    dataService = mockDataService();
    service = new FirstOrderDetectorService(dataService as any);
  });

  // ─── Test Case: First delivered order ───────────────────────
  it('should detect first order and mark customer', async () => {
    dataService.query
      // customers query: not yet completed
      .mockResolvedValueOnce({ data: [{ customer_id: 'C1', first_order_completed: false }] })
      // orders query: no previous delivered orders
      .mockResolvedValueOnce({ data: [] });
    dataService.update.mockResolvedValue({});

    const result = await service.detectAndMarkFirstOrder('C1', 'ORD-1');

    expect(result).toBe(true);
    // Should update customers table with first_order_completed = true and referral_status = 'active'
    expect(dataService.update).toHaveBeenCalledWith(
      'customers',
      expect.objectContaining({ first_order_completed: true, referral_status: 'active' }),
      expect.any(Array),
    );
    // Should also update users table
    expect(dataService.update).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ first_order_completed: true, referral_status: 'active' }),
      expect.any(Array),
    );
  });

  // ─── Test Case: Reward credited once (idempotency) ──────────
  it('should return false if first_order_completed is already true', async () => {
    dataService.query.mockResolvedValueOnce({
      data: [{ customer_id: 'C1', first_order_completed: true }],
    });

    const result = await service.detectAndMarkFirstOrder('C1', 'ORD-2');

    expect(result).toBe(false);
    expect(dataService.update).not.toHaveBeenCalled();
  });

  // ─── Test Case: Cancelled/older order exists ────────────────
  it('should return false if older delivered orders exist', async () => {
    dataService.query
      .mockResolvedValueOnce({ data: [{ customer_id: 'C1', first_order_completed: false }] })
      // Previous delivered order exists
      .mockResolvedValueOnce({ data: [{ order_id: 'ORD-OLD' }] });
    dataService.update.mockResolvedValue({});

    const result = await service.detectAndMarkFirstOrder('C1', 'ORD-3');

    expect(result).toBe(false);
    // Should still mark first_order_completed but NOT unlock referral via this path
    expect(dataService.update).toHaveBeenCalledWith(
      'customers',
      expect.objectContaining({ first_order_completed: true }),
      expect.any(Array),
    );
  });

  // ─── Test Case: Invalid customer ID ─────────────────────────
  it('should return false for empty customerId', async () => {
    const result = await service.detectAndMarkFirstOrder('', 'ORD-4');
    expect(result).toBe(false);
  });

  // ─── Test Case: Referral unlocked after first order ─────────
  it('unlockReferralCode should set referral_status to active', async () => {
    dataService.update.mockResolvedValue({});

    await service.unlockReferralCode('C1');

    expect(dataService.update).toHaveBeenCalledWith(
      'customers',
      expect.objectContaining({ referral_status: 'active', first_order_completed: true }),
      expect.any(Array),
    );
    expect(dataService.update).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ referral_status: 'active', first_order_completed: true }),
      expect.any(Array),
    );
  });
});
