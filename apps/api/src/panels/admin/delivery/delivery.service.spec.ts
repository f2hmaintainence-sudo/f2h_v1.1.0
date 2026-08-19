import { DeliveryManagementService } from './delivery.service';

describe('DeliveryManagementService tracking detail contract', () => {
  it('selects the address and complete discount breakdown for live orders', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new DeliveryManagementService(
      db as never,
      { error: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.getDeliveryTracking({ date: '2026-08-19' });

    const trackingSql = db.query.mock.calls[0][0] as string;
    expect(trackingSql).toContain('o.address_line');
    expect(trackingSql).toContain("'discount_amount', oi.discount_amount");
    expect(trackingSql).toContain("'coupon_amount', oi.coupon_amount");
    expect(trackingSql).toContain("'total_price', oi.total_price");
    expect(trackingSql).toContain('NULLIF(oi.total_price, 0)');
    expect(trackingSql).toContain('o.discount_amount');
  });
});
