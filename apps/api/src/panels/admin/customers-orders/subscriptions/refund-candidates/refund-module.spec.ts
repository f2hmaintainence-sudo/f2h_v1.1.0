import { RefundEligibilityService } from './refund-eligibility.service';
import { RefundProcessingService } from './refund-processing.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function eligibility(rows: any[] = []) {
  const db = { query: jest.fn().mockResolvedValue(rows) };
  const repo = { createCandidate: jest.fn().mockResolvedValue('cand-1') };
  return {
    db,
    repo,
    service: new RefundEligibilityService(db as never, repo as never),
  };
}

/** A pg-style client whose query() returns the queued results in order. */
function fakeClient(results: any[]) {
  const queue = [...results];
  return {
    query: jest.fn().mockImplementation(async () => queue.shift() ?? { rows: [], rowCount: 0 }),
  };
}

function processing(clientResults: any[], walletOverrides: any = {}) {
  const client = fakeClient(clientResults);
  const db = {
    query: jest.fn(),
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(client)),
  };
  const wallet = {
    credit: jest.fn().mockResolvedValue({
      transactionId: 'WT-1',
      balanceBefore: 100,
      balanceAfter: 178,
      amount: 78,
    }),
    notifyCreditCommitted: jest.fn().mockResolvedValue(undefined),
    ...walletOverrides,
  };
  return {
    db,
    client,
    wallet,
    service: new RefundProcessingService(db as never, wallet as never),
  };
}

// ─── Range resolution ───────────────────────────────────────────────────────

describe('RefundEligibilityService — reporting window', () => {
  const { service } = eligibility();

  it('expands a month to its real last day', () => {
    expect(service.resolveRange({ month: '2026-02' })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(service.resolveRange({ month: '2026-08' })).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('handles a leap February', () => {
    expect(service.resolveRange({ month: '2028-02' }).to).toBe('2028-02-29');
  });

  it('prefers an explicit from/to and orders them', () => {
    expect(service.resolveRange({ from: '2026-08-10', to: '2026-08-01' })).toEqual({
      from: '2026-08-01',
      to: '2026-08-10',
    });
  });

  it('falls back to the current month when nothing usable is given', () => {
    const range = service.resolveRange({ month: 'nonsense' });
    expect(range.from).toBe(new Date().toISOString().slice(0, 7) + '-01');
  });
});

// ─── Pricing rules ──────────────────────────────────────────────────────────

describe('RefundEligibilityService — pricing', () => {
  it('values refunds at the subscription item price, never the catalogue price', async () => {
    const { db, service } = eligibility([]);
    await service.preview({ month: '2026-08' });

    const sql = db.query.mock.calls.map((c: any[]) => c[0]).join('\n');
    // The prepaid price and the quantity are what the amount is built from.
    expect(sql).toContain('si.final_price');
    expect(sql).toContain('quantity * final_price');
    expect(sql).toContain('oi.quantity * si.final_price');
    // The live catalogue price must never enter the calculation.
    expect(sql).not.toContain('pv.price');
    expect(sql).not.toContain('product_variants.price');
  });

  it('only ever considers prepaid subscriptions', async () => {
    const { db, service } = eligibility([]);
    await service.preview({ month: '2026-08' });
    const sql = db.query.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(sql).toContain(`payment_type = 'prepaid'`);
  });

  it('excludes days that were actually delivered, and cancelled orders', async () => {
    const { db, service } = eligibility([]);
    await service.preview({ month: '2026-08' });
    const sql = db.query.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(sql).toContain(`o.status = 'delivered'`);   // pause scan: NOT EXISTS delivered
    expect(sql).toContain(`o.status <> 'cancelled'`);  // failed scan
    expect(sql).toContain(`o.status <> 'delivered'`);
  });

  it('skips pauses already settled and clips a resumed pause', async () => {
    const { db, service } = eligibility([]);
    await service.preview({ month: '2026-08' });
    const sql = db.query.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(sql).toContain('sp.is_refunded = false');
    expect(sql).toContain(`sp.status = 'resumed'`);
    expect(sql).toContain('CURRENT_DATE');
  });
});

// ─── Deduplication between the two sources ──────────────────────────────────

describe('RefundEligibilityService — pause vs failed order', () => {
  it('keeps the order row when both sources describe the same day/slot', async () => {
    const db = { query: jest.fn() };
    const repo = { createCandidate: jest.fn().mockResolvedValue('id') };
    const service = new RefundEligibilityService(db as never, repo as never);

    // First call = paused days, second = failed orders (Promise.all order).
    db.query
      .mockResolvedValueOnce([
        {
          subscription_id: 'SUB1', subscription_item_id: 'SBI1', customer_id: 'C1',
          scheduled_date: '2026-08-12', slot: 'morning', quantity: 1,
          unit_price: 20, final_price: 20, refund_amount: 20, pause_id: 9,
        },
      ])
      .mockResolvedValueOnce([
        {
          subscription_id: 'SUB1', subscription_item_id: 'SBI1', customer_id: 'C1',
          order_id: 'ORD1', scheduled_date: '2026-08-12', slot: 'morning',
          quantity: 1, unit_price: 20, final_price: 20, refund_amount: 20,
          item_status: 'pending', failed_reason: 'not home',
        },
      ]);

    const { rows } = await service.preview({ month: '2026-08' });

    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('order');
    expect(rows[0].order_id).toBe('ORD1');
  });

  it('flags a partially delivered line for manual confirmation', async () => {
    const db = { query: jest.fn() };
    const repo = { createCandidate: jest.fn() };
    const service = new RefundEligibilityService(db as never, repo as never);

    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        subscription_id: 'SUB1', subscription_item_id: 'SBI1', customer_id: 'C1',
        order_id: 'ORD1', scheduled_date: '2026-08-12', slot: 'morning',
        quantity: 3, unit_price: 20, final_price: 20, refund_amount: 60,
        item_status: 'partial', failed_reason: null,
      },
    ]);

    const { rows } = await service.preview({ month: '2026-08' });
    expect(rows[0].note).toContain('partial');
  });

  it('re-scanning relies on the unique key and reports what was skipped', async () => {
    const db = { query: jest.fn() };
    const repo = { createCandidate: jest.fn().mockResolvedValue(null) }; // ON CONFLICT DO NOTHING
    const service = new RefundEligibilityService(db as never, repo as never);

    db.query.mockResolvedValueOnce([
      {
        subscription_id: 'SUB1', subscription_item_id: 'SBI1', customer_id: 'C1',
        scheduled_date: '2026-08-12', slot: 'morning', quantity: 2,
        unit_price: 20, final_price: 20, refund_amount: 40, pause_id: 9,
      },
    ]).mockResolvedValueOnce([]);

    const result = await service.scan({ month: '2026-08' });

    expect(result.found).toBe(1);
    expect(result.created).toBe(0);
    expect(result.skipped_existing).toBe(1);
    expect(result.total_amount).toBe(40);
  });

  it('never throws out of the event hooks', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('db down')) };
    const repo = { createCandidate: jest.fn() };
    const service = new RefundEligibilityService(db as never, repo as never);

    await expect(service.onPauseCreated('SUB1', '2026-08-01', '2026-08-05')).resolves.toBe(0);
    await expect(service.onDeliveryFailed('ORD1')).resolves.toBe(0);
  });
});

// ─── Payout processing ──────────────────────────────────────────────────────

describe('RefundProcessingService — duplicate protection', () => {
  it('refuses an empty selection', async () => {
    const { service } = processing([]);
    await expect(service.approveAndProcess([], 'admin')).rejects.toThrow(
      'No candidate IDs provided',
    );
  });

  it('refuses candidates that were already refunded', async () => {
    const { db, service } = processing([]);
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'refunded' },
    ]);
    await expect(service.approveAndProcess(['c1'], 'admin')).rejects.toThrow(
      'already refunded',
    );
  });

  it('refuses when nothing is in a payable state', async () => {
    const { db, service } = processing([]);
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'rejected' },
    ]);
    await expect(service.approveAndProcess(['c1'], 'admin')).rejects.toThrow(
      'payable state',
    );
  });

  it('aborts if a candidate changes status between selection and the lock', async () => {
    const { db, service } = processing([
      // locked SELECT ... FOR UPDATE returns a status that moved on
      { rows: [{ refund_candidate_id: 'c1', subscription_id: 'S1', refund_amount: 20, status: 'approved' }] },
    ]);
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
    ]);

    await expect(service.approveAndProcess(['c1'], 'admin')).rejects.toThrow(
      'changed status while approving',
    );
  });

  it('refuses a zero-value payout', async () => {
    const { db, service } = processing([
      { rows: [{ refund_candidate_id: 'c1', subscription_id: 'S1', refund_amount: 0, status: 'pending' }] },
    ]);
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
    ]);

    await expect(service.approveAndProcess(['c1'], 'admin')).rejects.toThrow(
      'greater than zero',
    );
  });
});

describe('RefundProcessingService — atomic payout', () => {
  /** Client results in the order the service issues them. */
  function clientQueue(candidates: any[]) {
    return [
      { rows: candidates },                      // 1. SELECT ... FOR UPDATE
      { rows: [{ refund_payout_id: 'PO-1' }] },  // 2. INSERT payout RETURNING
      { rows: [] },                              // 3. candidates -> approved
      { rows: [] },                              // 4. payout -> processed
      { rows: [] },                              // 5. candidates -> refunded
      { rows: [] },                              // 6. pause settlement
      { rows: [] },                              // 7. audit log
    ];
  }

  function happyPath() {
    return processing(
      clientQueue([
        { refund_candidate_id: 'c1', subscription_id: 'S1', scheduled_date: '2026-08-12', refund_amount: 39, status: 'pending' },
        { refund_candidate_id: 'c2', subscription_id: 'S1', scheduled_date: '2026-08-13', refund_amount: 39, status: 'reviewed' },
      ]),
    );
  }

  it('credits the wallet inside the caller transaction', async () => {
    const { db, client, wallet, service } = happyPath();
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
      { refund_candidate_id: 'c2', customer_id: 'C1', status: 'reviewed' },
    ]);

    await service.approveAndProcess(['c1', 'c2'], 'admin-1');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    // The credit must join the transaction, not open its own.
    expect(wallet.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'C1',
        amount: 78,
        referenceType: 'subscription_refund',
        createdBy: 'admin-1',
      }),
      client,
    );
  });

  it('writes payout, candidate statuses, pause settlement and audit together', async () => {
    const { db, client, service } = happyPath();
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
      { refund_candidate_id: 'c2', customer_id: 'C1', status: 'reviewed' },
    ]);

    await service.approveAndProcess(['c1', 'c2'], 'admin-1');

    const sql = client.query.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('INSERT INTO subscription_refund_payouts');
    expect(sql).toContain(`SET status = 'approved'`);
    expect(sql).toContain(`SET status = 'processed'`);
    expect(sql).toContain(`SET status = 'refunded'`);
    expect(sql).toContain('UPDATE subscription_pauses');
    expect(sql).toContain('INSERT INTO admin_audit_logs');
  });

  it('settles a pause only when none of its days are still outstanding', async () => {
    const { db, client, service } = happyPath();
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
    ]);

    await service.approveAndProcess(['c1'], 'admin-1');

    const pauseSql = client.query.mock.calls
      .map((c: any[]) => c[0] as string)
      .find((s: string) => s.includes('UPDATE subscription_pauses'))!;

    // Scoped to the pause window, and blocked while anything is unpaid —
    // never a blanket update across the whole subscription.
    expect(pauseSql).toContain('BETWEEN sp.start_date AND sp.end_date');
    expect(pauseSql).toContain('NOT EXISTS');
    expect(pauseSql).toContain(`c.status IN ('pending', 'reviewed', 'approved')`);
  });

  it('notifies the customer only after the transaction commits', async () => {
    const order: string[] = [];
    const { db, wallet, service } = processing([
      {
        rows: [
          { refund_candidate_id: 'c1', subscription_id: 'S1', scheduled_date: '2026-08-12', refund_amount: 78, status: 'pending' },
        ],
      },
      { rows: [] }, { rows: [{ refund_payout_id: 'PO-1' }] },
      { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
    ]);
    db.transaction.mockImplementation(async (cb: any) => {
      const client = fakeClient([
        { rows: [{ refund_candidate_id: 'c1', subscription_id: 'S1', scheduled_date: '2026-08-12', refund_amount: 78, status: 'pending' }] },
        { rows: [] }, { rows: [{ refund_payout_id: 'PO-1' }] },
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
      ]);
      const out = await cb(client);
      order.push('commit');
      return out;
    });
    wallet.notifyCreditCommitted.mockImplementation(async () => {
      order.push('notify');
    });
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
    ]);

    await service.approveAndProcess(['c1'], 'admin-1');

    expect(order).toEqual(['commit', 'notify']);
  });

  it('propagates a wallet failure so the whole payout rolls back', async () => {
    const { db, service, wallet } = processing([
      {
        rows: [
          { refund_candidate_id: 'c1', subscription_id: 'S1', scheduled_date: '2026-08-12', refund_amount: 39, status: 'pending' },
        ],
      },
      { rows: [] },
      { rows: [{ refund_payout_id: 'PO-1' }] },
    ]);
    wallet.credit.mockRejectedValue(new Error('insufficient wallet lock'));
    db.query.mockResolvedValue([
      { refund_candidate_id: 'c1', customer_id: 'C1', status: 'pending' },
    ]);

    await expect(service.approveAndProcess(['c1'], 'admin-1')).rejects.toThrow(
      'insufficient wallet lock',
    );
    expect(wallet.notifyCreditCommitted).not.toHaveBeenCalled();
  });
});
