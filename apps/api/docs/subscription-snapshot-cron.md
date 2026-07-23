# Subscription Snapshot Cron

## Purpose

The subscription snapshot cron generates delivery-ready rows in `subscription_daily_snapshots` for the next delivery day. These rows are used by orders, packing, delivery, and billing flows.

## Cron Schedule

- Runs daily at `11:55 PM` IST.
- Nest schedule expression: `55 23 * * *`.
- Time zone: `Asia/Kolkata`.
- Default target date: current IST date plus one day.
- Manual execution: call `SubscriptionSnapshotService.generateSnapshots('2026-05-10')`.

## Source Tables

- `subscriptions`
- `subscription_items`
- `subscription_weekly_schedule`
- `subscription_custom_schedule`
- `subscription_pauses`
- `subscription_overrides`

## Output Tables

- `subscription_daily_snapshots`
- `subscription_logs`

## Business Rules

Only active subscriptions are included:

```sql
s.status = 'active'
AND s.start_date <= target_date
AND (s.end_date IS NULL OR s.end_date >= target_date)
```

Only active subscription items are included:

```sql
si.status = 'active'
AND (si.start_date IS NULL OR si.start_date <= target_date)
AND (si.end_date IS NULL OR si.end_date >= target_date)
```

Weekly subscriptions read base quantities from `subscription_weekly_schedule` using:

```sql
day_of_week = EXTRACT(DOW FROM target_date)
```

Custom date subscriptions read base quantities from `subscription_custom_schedule` using:

```sql
delivery_date = target_date
```

Paused items are skipped when the target date falls between `subscription_pauses.start_date` and `subscription_pauses.end_date`.

Override behavior:

- `extra`: add override quantities to base quantities.
- `replace`: replace base quantities with override quantities.
- `cancel`: final quantities become zero.
- `cod`: add override quantities to base quantities. Payment-specific handling can be added downstream using the override record.

Rows with both final quantities at zero are skipped.

## SQL Logic

The repository uses a single set-based `INSERT INTO ... SELECT` statement with CTEs:

- `target`: binds the target date.
- `active_items`: filters active subscriptions and items, and excludes pauses.
- `planned`: joins weekly/custom schedules and same-day overrides.
- `calculated`: computes base, override, and final quantities.
- `upserted`: writes snapshots with `ON CONFLICT`.

Idempotency is handled by:

```sql
ON CONFLICT (snapshot_date, subscription_item_id)
DO UPDATE SET ...
```

This makes retries and manual reruns safe.

## Redis Lock Strategy

Before generation starts, the service acquires:

```text
subscription_snapshot:YYYY-MM-DD
```

The lock uses Redis `SET key value EX 3600 NX`. If the lock exists, the run is skipped and a `snapshot_generation` log row is written with `status = skipped`.

The lock value is a UUID token. Release uses a compare-and-delete Lua script so another process cannot accidentally release a lock it does not own.

## PgBouncer Considerations

The implementation is PgBouncer safe:

- No temporary tables.
- No session variables.
- No cursors.
- No row-by-row inserts.
- No long-lived transaction is opened by the application.
- One pooled query performs the snapshot generation.

## Performance Expectations

The SQL is designed for 10,000+ customers by pushing filtering, joins, calculation, and upsert into PostgreSQL. Existing indexes on subscription dates, item subscriptions, schedule dates, override dates, pause dates, and snapshot uniqueness support the workload.

For best production performance, keep these indexes healthy:

- `subscription_daily_snapshots(snapshot_date, subscription_item_id)` unique index.
- `subscription_weekly_schedule(subscription_item_id)`.
- `subscription_custom_schedule(delivery_date)`.
- `subscription_overrides(override_date)`.
- `subscription_pauses(start_date, end_date)`.
- `subscriptions(start_date, end_date)`.

## Monitoring

Each run writes a `subscription_logs` row:

- `action = snapshot_generation`
- `new_data.target_date`
- `new_data.inserted_count`
- `new_data.updated_count`
- `new_data.duration_ms`
- `new_data.status`
- `new_data.error`, when failed

Application logs also include start, skip, success, and failure messages.

## Recovery Steps

1. Check application logs for `SubscriptionSnapshotService`.
2. Check `subscription_logs` where `action = 'snapshot_generation'`.
3. Confirm Redis does not still hold `subscription_snapshot:YYYY-MM-DD`.
4. Fix the source data or database error.
5. Rerun manually for the affected date. The upsert is idempotent.

## Manual Execution Examples

From Nest code or a maintenance script:

```typescript
await subscriptionSnapshotService.generateSnapshots('2026-05-10');
```

For the default next IST delivery day:

```typescript
await subscriptionSnapshotService.generateSnapshots();
```

The returned result includes:

```typescript
{
  targetDate: '2026-05-10',
  recordsInserted: 1000,
  recordsUpdated: 25,
  durationMs: 1200,
  status: 'success',
  lockKey: 'subscription_snapshot:2026-05-10',
  errors: []
}
```
