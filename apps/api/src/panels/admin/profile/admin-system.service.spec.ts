import { BadRequestException } from '@nestjs/common';
import { AdminSystemService } from './admin-system.service';

describe('AdminSystemService audit logs', () => {
  it('binds every filter and maps the complete audit response', async () => {
    const rows = [{ id: 101, action: 'product_update' }];
    const insightRows = [
      {
        total_events: 7,
        events_today: 3,
        delete_events: 1,
        active_admins: 2,
        affected_resources: 4,
        action_breakdown: [{ action: 'product_update', count: 5 }],
      },
    ];
    const filterRows = [
      {
        actions: ['product_update'],
        target_types: ['products'],
      },
    ];
    const adminRows = [
      {
        admin_id: 'ADM001',
        admin_name: 'Admin One',
      },
    ];
    const db = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT al.*')) return rows;
        if (sql.includes('WITH filtered_logs')) return insightRows;
        if (sql.includes('ARRAY_AGG(DISTINCT action')) return filterRows;
        if (sql.includes('DISTINCT ON (admin_id)')) return adminRows;
        throw new Error('Unexpected SQL in test');
      }),
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
      include_filter_options: 'true',
    });

    const rowsCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('SELECT al.*'),
    );
    const insightCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('WITH filtered_logs'),
    );
    const adminCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('DISTINCT ON (admin_id)'),
    );
    expect(rowsCall).toBeDefined();
    expect(insightCall).toBeDefined();
    expect(adminCall).toBeDefined();

    const rowsSql = rowsCall![0];
    const rowsParams = rowsCall![1] ?? [];
    const insightSql = insightCall![0];
    const insightParams = insightCall![1] ?? [];
    expect(rowsSql).toContain('al.admin_id = $1');
    expect(rowsSql).toContain('al.action = $2');
    expect(rowsSql).toContain('al.target_type = $3');
    expect(rowsSql).toContain("COALESCE(al.target_id, '') ILIKE $4");
    expect(rowsSql).toContain(
      "al.created_at >= ($5::date::timestamp AT TIME ZONE 'Asia/Kolkata')",
    );
    expect(rowsSql).toContain(
      "al.created_at < (($6::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')",
    );
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

    expect(insightSql).toContain('al.admin_id = $1');
    expect(insightSql).toContain('al.action = $2');
    expect(insightSql).toContain('al.target_type = $3');
    expect(insightSql).toContain("COALESCE(al.target_id, '') ILIKE $4");
    expect(insightSql).toContain(
      "al.created_at >= ($5::date::timestamp AT TIME ZONE 'Asia/Kolkata')",
    );
    expect(insightSql).toContain(
      "al.created_at < (($6::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')",
    );
    expect(insightSql).toContain('COUNT(*)::int AS total_events');
    expect(insightSql).toContain(
      "COUNT(*) FILTER (WHERE LOWER(action) LIKE '%delete%')::int",
    );
    expect(insightSql).toContain('COUNT(DISTINCT admin_id)::int');
    expect(insightSql).toContain('ORDER BY count DESC, action ASC');
    expect(insightSql).toContain('LIMIT 5');
    expect(insightParams).toEqual(rowsParams.slice(0, -2));
    expect(adminCall![0]).toContain(
      'ORDER BY admin_id, created_at DESC, id DESC',
    );

    expect(result).toEqual({
      status: true,
      data: rows,
      total: 7,
      insights: {
        total_events: 7,
        events_today: 3,
        delete_events: 1,
        active_admins: 2,
        affected_resources: 4,
        action_breakdown: [{ action: 'product_update', count: 5 }],
      },
      filter_options: {
        actions: ['product_update'],
        target_types: ['products'],
        admins: adminRows,
      },
      message: 'Audit logs fetched',
    });
  });

  it('skips global filter-option scans after options have loaded', async () => {
    const db = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT al.*')) return [];
        if (sql.includes('WITH filtered_logs')) {
          return [
            {
              total_events: 0,
              events_today: 0,
              delete_events: 0,
              active_admins: 0,
              affected_resources: 0,
              action_breakdown: [],
            },
          ];
        }
        throw new Error('Filter options should not be queried');
      }),
    };
    const service = new AdminSystemService(
      db as never,
      { error: jest.fn() } as never,
    );

    const result = await service.getAuditLogs({
      search: 'not-found',
      include_filter_options: 'false',
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: true,
      data: [],
      total: 0,
      insights: {
        total_events: 0,
        events_today: 0,
        delete_events: 0,
        active_admins: 0,
        affected_resources: 0,
        action_breakdown: [],
      },
      message: 'Audit logs fetched',
    });
  });

  it('rejects an inverted date range before querying the database', async () => {
    const db = { query: jest.fn() };
    const service = new AdminSystemService(
      db as never,
      { error: jest.fn() } as never,
    );

    await expect(
      service.getAuditLogs({
        from_date: '2026-08-20',
        to_date: '2026-08-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
