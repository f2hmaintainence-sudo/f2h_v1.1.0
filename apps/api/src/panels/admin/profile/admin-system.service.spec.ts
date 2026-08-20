import { AdminSystemService } from './admin-system.service';

describe('AdminSystemService audit logs', () => {
  it('applies every audit filter with bound parameters and returns filtered insights', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 101, action: 'product_update' }])
        .mockResolvedValueOnce([
          {
            total_events: 7,
            events_today: 3,
            delete_events: 1,
            active_admins: 2,
            affected_resources: 4,
            action_breakdown: [{ action: 'product_update', count: 5 }],
          },
        ])
        .mockResolvedValueOnce([
          {
            actions: ['product_update'],
            target_types: ['products'],
          },
        ])
        .mockResolvedValueOnce([
          {
            admin_id: 'ADM001',
            admin_name: 'Admin One',
          },
        ]),
    };
    const service = new AdminSystemService(
      db as never,
      { error: jest.fn() } as never,
    );

    const result = await service.getAuditLogs({
      admin_id: 'ADM001',
      action: 'product_update',
      target_type: 'products',
      search: 'milk',
      from_date: '2026-08-01',
      to_date: '2026-08-20',
      page: 2,
      limit: 25,
    });

    const [rowsSql, rowsParams] = db.query.mock.calls[0] as [string, unknown[]];
    expect(rowsSql).toContain('al.admin_id = $1');
    expect(rowsSql).toContain('al.action = $2');
    expect(rowsSql).toContain('al.target_type = $3');
    expect(rowsSql).toContain('al.created_at >=');
    expect(rowsSql).toContain('al.created_at <');
    expect(rowsSql).toContain('ORDER BY al.created_at DESC, al.id DESC');
    expect(rowsParams).toEqual([
      'ADM001',
      'product_update',
      'products',
      '%milk%',
      '2026-08-01',
      '2026-08-20',
      25,
      25,
    ]);

    const [, insightParams] = db.query.mock.calls[1] as [string, unknown[]];
    expect(insightParams).toEqual(rowsParams.slice(0, -2));
    expect(result).toEqual(
      expect.objectContaining({
        total: 7,
        insights: expect.objectContaining({
          total_events: 7,
          active_admins: 2,
          action_breakdown: [{ action: 'product_update', count: 5 }],
        }),
        filter_options: {
          actions: ['product_update'],
          target_types: ['products'],
          admins: [{ admin_id: 'ADM001', admin_name: 'Admin One' }],
        },
      }),
    );
  });

  it('returns zero totals and empty insight collections for no matching logs', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            total_events: 0,
            events_today: 0,
            delete_events: 0,
            active_admins: 0,
            affected_resources: 0,
            action_breakdown: [],
          },
        ])
        .mockResolvedValueOnce([{ actions: [], target_types: [] }])
        .mockResolvedValueOnce([]),
    };
    const service = new AdminSystemService(
      db as never,
      { error: jest.fn() } as never,
    );

    const result = await service.getAuditLogs({ search: 'not-found' });

    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.insights.action_breakdown).toEqual([]);
  });
});
