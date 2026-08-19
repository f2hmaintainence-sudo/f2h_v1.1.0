import { Test, TestingModule } from '@nestjs/testing';
import { DiscountEngineService } from './discount-engine.service';
import { DatabaseService } from '../database/Database.service';

describe('DiscountEngineService (Promotions & Coupons System)', () => {
  let service: DiscountEngineService;
  let mockDb: any;

  // Variant constants for testing
  const MILK_VARIANT_1 = 'VRT_MILK_500ML';
  const MILK_VARIANT_2 = 'VRT_MILK_1L';
  const CURD_VARIANT = 'VRT_CURD_500ML';
  const GHEE_VARIANT = 'VRT_GHEE_500ML';

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountEngineService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<DiscountEngineService>(DiscountEngineService);
  });

  const firstMilkPromoRow = {
    promotion_id: 'PROMO_FIRST_MILK',
    name: 'First Milk Order - 50% Off',
    promotion_type: 'percentage',
    discount_value: 50.0,
    max_discount_amount: null,
    minimum_order_amount: 0,
    first_order_only: true,
    usage_limit: null,
    usage_limit_per_customer: 1,
    auto_apply: true,
    allow_subscription_orders: false,
    stackable: false,
    apply_to_all_products: false,
    start_at: null,
    end_at: null,
    status: 'active',
    global_redemption_count: 0,
    customer_redemption_count: 0,
    product_variant_ids: [MILK_VARIANT_1, MILK_VARIANT_2],
  };

  // ── TEST 1: New customer + Milk → 50% Milk discount ───────────────────────
  it('TEST 1: New customer purchasing Milk gets 50% discount on Milk', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]); // no prior purchases
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 2 },
      ],
    });

    expect(res.item_results).toHaveLength(1);
    expect(res.item_results[0].promotion_id).toBe('PROMO_FIRST_MILK');
    expect(res.item_results[0].discount_amount).toBe(20); // 50% of 40 = 20
    expect(res.item_results[0].final_price).toBe(20);
    expect(res.item_results[0].item_line_total).toBe(40); // 20 * 2 = 40
    expect(res.summary.subtotal).toBe(80);
    expect(res.summary.promotion_discount).toBe(40);
    expect(res.summary.final_amount).toBe(40);
  });

  // ── TEST 2: New customer + Milk + Curd + Ghee → Only Milk receives 50% ────
  it('TEST 2: New customer with mixed cart receives 50% only on Milk variants', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
        { variant_id: CURD_VARIANT, unit_price: 55, original_price: 55, quantity: 1 },
        { variant_id: GHEE_VARIANT, unit_price: 600, original_price: 600, quantity: 1 },
      ],
    });

    const milkItem = res.item_results.find((i) => i.variant_id === MILK_VARIANT_1)!;
    const curdItem = res.item_results.find((i) => i.variant_id === CURD_VARIANT)!;
    const gheeItem = res.item_results.find((i) => i.variant_id === GHEE_VARIANT)!;

    expect(milkItem.discount_amount).toBe(20);
    expect(milkItem.final_price).toBe(20);
    expect(curdItem.discount_amount).toBe(0);
    expect(curdItem.final_price).toBe(55);
    expect(gheeItem.discount_amount).toBe(0);
    expect(gheeItem.final_price).toBe(600);
    expect(res.summary.subtotal).toBe(695);
    expect(res.summary.promotion_discount).toBe(20);
    expect(res.summary.final_amount).toBe(675);
  });

  // ── TEST 3: New customer + Curd → No First Milk redemption ────────────────
  it('TEST 3: New customer purchasing only Curd does not receive or redeem First Milk', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: CURD_VARIANT, unit_price: 55, original_price: 55, quantity: 2 },
      ],
    });

    expect(res.item_results[0].discount_amount).toBe(0);
    expect(res.item_results[0].promotion_id).toBeNull();
    expect(res.summary.total_discount).toBe(0);
    expect(res.summary.final_amount).toBe(110);
  });

  // ── TEST 4: Customer previously purchased Curd only → First Milk gets 50% ─
  it('TEST 4: Customer with prior Curd purchase qualifies for First Milk discount', async () => {
    mockDb.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) {
        // params[1] is [MILK_VARIANT_1, MILK_VARIANT_2], customer only bought Curd
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_002',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_2, unit_price: 76, original_price: 76, quantity: 1 },
      ],
    });

    expect(res.item_results[0].promotion_id).toBe('PROMO_FIRST_MILK');
    expect(res.item_results[0].discount_amount).toBe(38); // 50% of 76
    expect(res.item_results[0].final_price).toBe(38);
  });

  // ── TEST 5: Customer previously purchased Milk → No First Milk promotion ──
  it('TEST 5: Customer with prior confirmed Milk order is disqualified from First Milk', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) {
        return Promise.resolve([{ 1: 1 }]); // Customer already bought Milk before
      }
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_003',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.item_results[0].promotion_id).toBeNull();
    expect(res.item_results[0].discount_amount).toBe(0);
    expect(res.summary.total_discount).toBe(0);
  });

  // ── TEST 6: Customer already redeemed First Milk promotion → No discount ──
  it('TEST 6: Customer who previously redeemed First Milk is rejected by usage limit', async () => {
    const promoWithRedemption = {
      ...firstMilkPromoRow,
      customer_redemption_count: 1, // Already redeemed
    };

    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([promoWithRedemption]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_004',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.item_results[0].promotion_id).toBeNull();
    expect(res.summary.total_discount).toBe(0);
  });

  // ── TEST 7: Previous Milk order was cancelled → Customer can still qualify 
  it('TEST 7: Customer whose prior Milk order was cancelled still qualifies for First Milk', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) {
        // SQL has: o.status NOT IN ('cancelled', 'failed', 'rejected')
        // Cancelled orders return no matching rows
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_005',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.item_results[0].promotion_id).toBe('PROMO_FIRST_MILK');
    expect(res.item_results[0].discount_amount).toBe(20);
  });

  // ── TEST 8: Coupon FIRST100 → Validate coupon rules and apply discount ────
  it('TEST 8: Coupon code applies valid discount across eligible order items', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([]); // no auto promos
      if (sql.includes('FROM coupons c')) {
        return Promise.resolve([
          {
            coupon_id: 'CPN_FIRST100',
            promotion_id: 'PROMO_FIRST100',
            code: 'FIRST100',
            coupon_status: 'active',
            coupon_usage_limit: 1000,
            coupon_upc: 1,
            used_count: 5,
            coupon_start: null,
            coupon_end: null,
            promo_name: 'Flat ₹100 Off',
            promotion_type: 'fixed_amount',
            discount_value: 100,
            max_discount_amount: 100,
            minimum_order_amount: 200,
            promo_status: 'active',
            promo_start: null,
            promo_end: null,
            apply_to_all_products: true,
            stackable: false,
            allow_subscription_orders: false,
            first_order_only: false,
            promo_upc: 1,
            product_variant_ids: [],
          },
        ]);
      }
      if (sql.includes('FROM coupon_redemptions')) return Promise.resolve([{ cnt: 0 }]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      coupon_code: 'FIRST100',
      items: [
        { variant_id: GHEE_VARIANT, unit_price: 600, original_price: 600, quantity: 1 },
      ],
    });

    expect(res.summary.coupon_valid).toBe(true);
    expect(res.summary.coupon_id).toBe('CPN_FIRST100');
    expect(res.summary.coupon_discount).toBe(100);
    expect(res.summary.final_amount).toBe(500);
  });

  // ── TEST 9: Expired coupon → Reject ───────────────────────────────────────
  it('TEST 9: Expired coupon is rejected with appropriate error message', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM coupons c')) {
        return Promise.resolve([
          {
            coupon_id: 'CPN_EXPIRED',
            promotion_id: 'PROMO_EXP',
            code: 'EXPIRED10',
            coupon_status: 'active',
            coupon_end: new Date(Date.now() - 86400000), // expired yesterday
            promo_status: 'active',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await service.validateCouponCode('EXPIRED10', 'CUST_001', 500);
    expect(res.valid).toBe(false);
    expect(res.message).toBe('This coupon has expired');
  });

  // ── TEST 10: Coupon usage limit reached → Reject ──────────────────────────
  it('TEST 10: Coupon with exhausted global usage limit is rejected', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM coupons c')) {
        return Promise.resolve([
          {
            coupon_id: 'CPN_MAXED',
            promotion_id: 'PROMO_MAXED',
            code: 'MAXED',
            coupon_status: 'active',
            coupon_usage_limit: 10,
            used_count: 10, // max reached
            promo_status: 'active',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await service.validateCouponCode('MAXED', 'CUST_001', 500);
    expect(res.valid).toBe(false);
    expect(res.message).toBe('This coupon has reached its usage limit');
  });

  // ── TEST 11: Customer already used coupon → Reject if limit reached ───────
  it('TEST 11: Customer who has reached per-customer coupon limit is rejected', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM coupons c')) {
        return Promise.resolve([
          {
            coupon_id: 'CPN_ONCE',
            promotion_id: 'PROMO_ONCE',
            code: 'USEONCE',
            coupon_status: 'active',
            coupon_usage_limit: 1000,
            used_count: 10,
            coupon_upc: 1,
            promo_status: 'active',
          },
        ]);
      }
      if (sql.includes('FROM coupon_redemptions')) {
        return Promise.resolve([{ cnt: 1 }]); // already used once
      }
      return Promise.resolve([]);
    });

    const res = await service.validateCouponCode('USEONCE', 'CUST_001', 500);
    expect(res.valid).toBe(false);
    expect(res.message).toBe('You have already used this coupon');
  });

  // ── TEST 12: Promotion expired → Do not apply ─────────────────────────────
  it('TEST 12: Promotion past end_at date is excluded from eligibility', async () => {
    const expiredPromo = {
      ...firstMilkPromoRow,
      end_at: new Date(Date.now() - 86400000), // expired yesterday
    };

    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) {
        // WHERE (p.end_at IS NULL OR p.end_at >= $2) filters it out at DB level
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.summary.promotion_discount).toBe(0);
  });

  // ── TEST 13: Promotion not started → Do not apply ─────────────────────────
  it('TEST 13: Promotion with future start_at date is excluded from eligibility', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) {
        // WHERE (p.start_at IS NULL OR p.start_at <= $2) filters it out at DB level
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.summary.promotion_discount).toBe(0);
  });

  // ── TEST 14: Minimum order amount not reached → Do not apply ──────────────
  it('TEST 14: Promotion with minimum_order_amount threshold is skipped if subtotal too low', async () => {
    const promoWithMinOrder = {
      ...firstMilkPromoRow,
      minimum_order_amount: 100, // min ₹100
    };

    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([promoWithMinOrder]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 }, // subtotal ₹40 < ₹100
      ],
    });

    expect(res.item_results[0].discount_amount).toBe(0);
    expect(res.summary.promotion_discount).toBe(0);
  });

  // ── TEST 15: Concurrency locking validation ───────────────────────────────
  it('TEST 15: Concurrency locks customer and coupon rows during transaction', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await service.recordRedemptions(
      mockClient,
      'ORD_001',
      'CUST_001',
      [
        {
          variant_id: MILK_VARIANT_1,
          original_price: 40,
          unit_price: 40,
          promotion_id: 'PROMO_FIRST_MILK',
          coupon_id: 'CPN_FIRST100',
          discount_amount: 20,
          coupon_amount: 10,
          final_price: 10,
          item_line_total: 10,
        },
      ],
      [{ variant_id: MILK_VARIANT_1, quantity: 1 }],
      'CPN_FIRST100',
      'PROMO_FIRST100',
      10,
    );

    // Verify promotion redemption insert
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO promotion_redemptions'),
      expect.arrayContaining(['PROMO_FIRST_MILK', 'CUST_001', 'ORD_001', 20]),
    );

    // Verify coupon redemption insert
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO coupon_redemptions'),
      expect.arrayContaining(['CPN_FIRST100', 'PROMO_FIRST100', 'CUST_001', 'ORD_001', 10]),
    );

    // Verify atomic used_count update
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE coupons SET used_count = used_count + 1'),
      ['CPN_FIRST100'],
    );
  });

  // ── TEST 16: Subscription-generated order → Excluded unless configured ─────
  it('TEST 16: Subscription orders do NOT receive one-time First Milk promotion', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      // allow_subscription_orders is false on firstMilkPromoRow
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'subscription', // Subscription order!
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    expect(res.item_results[0].promotion_id).toBeNull();
    expect(res.summary.promotion_discount).toBe(0);
  });

  // ── TEST 17: Non-stackable automatic promo + coupon → Pick best discount ──
  it('TEST 17: Non-stackable promo and coupon choose the superior discount without double discounting', async () => {
    // 50% Milk promo = ₹20 off
    // 20% Coupon = ₹8 off
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM promotions p')) return Promise.resolve([firstMilkPromoRow]);
      if (sql.includes('FROM order_items oi')) return Promise.resolve([]);
      if (sql.includes('FROM coupons c')) {
        return Promise.resolve([
          {
            coupon_id: 'CPN_20',
            promotion_id: 'PROMO_20',
            code: 'SAVE20',
            coupon_status: 'active',
            coupon_usage_limit: 1000,
            coupon_upc: 5,
            used_count: 0,
            promo_name: '20% Off',
            promotion_type: 'percentage',
            discount_value: 20,
            max_discount_amount: 50,
            minimum_order_amount: 0,
            promo_status: 'active',
            apply_to_all_products: true,
            stackable: false, // Non-stackable!
            allow_subscription_orders: false,
            first_order_only: false,
            product_variant_ids: [],
          },
        ]);
      }
      if (sql.includes('FROM coupon_redemptions')) return Promise.resolve([{ cnt: 0 }]);
      return Promise.resolve([]);
    });

    const res = await service.resolveDiscounts({
      customer_id: 'CUST_001',
      order_source: 'one-time',
      coupon_code: 'SAVE20',
      items: [
        { variant_id: MILK_VARIANT_1, unit_price: 40, original_price: 40, quantity: 1 },
      ],
    });

    // Milk discount: 50% (₹20) is greater than 20% (₹8)
    // Non-stackable rule keeps the superior ₹20 discount and does not add the coupon
    expect(res.item_results[0].promotion_id).toBe('PROMO_FIRST_MILK');
    expect(res.item_results[0].discount_amount).toBe(20);
    expect(res.item_results[0].coupon_amount).toBe(0);
    expect(res.item_results[0].final_price).toBe(20);
    expect(res.summary.total_discount).toBe(20);
  });
});
