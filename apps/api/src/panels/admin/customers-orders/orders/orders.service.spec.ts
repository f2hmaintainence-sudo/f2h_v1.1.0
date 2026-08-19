import { OrdersService } from './orders.service';

describe('OrdersService order detail contract', () => {
  it('returns every stored item price and discount field needed by the details drawer', async () => {
    const dataService = {
      query: jest.fn().mockResolvedValue({ status: true, data: [] }),
    };
    const service = new OrdersService(
      dataService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.getOrderItems('ORD_TEST');

    expect(dataService.query).toHaveBeenCalledWith(
      'order_items',
      expect.objectContaining({
        select: expect.arrayContaining([
          'order_items.discount_amount',
          'order_items.coupon_amount',
          'order_items.total_price',
          'order_items.final_price',
        ]),
      }),
    );
  });
});
