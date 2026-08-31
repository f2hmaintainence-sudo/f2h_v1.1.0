import { FirstOrderDetectorService } from './first-order-detector.service';

// Minimal mock for DataService & DatabaseService
const mockDataService = () => ({
  query: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
});

const mockDatabaseService = () => ({
  query: jest.fn().mockResolvedValue([]),
});

const mockDeveloperService = () => ({
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
});

describe('FirstOrderDetectorService', () => {
  let service: FirstOrderDetectorService;
  let dataService: ReturnType<typeof mockDataService>;
  let dbService: ReturnType<typeof mockDatabaseService>;
  let devService: ReturnType<typeof mockDeveloperService>;

  beforeEach(() => {
    dataService = mockDataService();
    dbService = mockDatabaseService();
    devService = mockDeveloperService();
    service = new FirstOrderDetectorService(dataService as any, dbService as any, devService as any);
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
    expect(dataService.update).toHaveBeenCalledWith(
      'customers',
      expect.objectContaining({ first_order_completed: true }),
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
  it('unlockReferralCode should update first_order_completed', async () => {
    dataService.update.mockResolvedValue({});

    await service.unlockReferralCode('C1');

    expect(dataService.update).toHaveBeenCalledWith(
      'customers',
      expect.objectContaining({ first_order_completed: true }),
      expect.any(Array),
    );
  });
});
