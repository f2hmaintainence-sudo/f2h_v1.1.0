# DataService Usage Guide

## What this service is

`DataService` is the project's shared dynamic query builder. It sits on top of PostgreSQL and gives you a Laravel-like API for common operations:

- `query()` for reads and advanced queries
- `insert()` for inserts
- `update()` for updates
- `delete()` for deletes
- `getSharedConnection()` / `queryWithConnection()` when you want to reuse one DB connection

Main files:

- `src/shared/database/Data.service.ts`
- `src/shared/database/Database.service.ts`
- compatibility exports:
  - `src/services/Data.service.ts`
  - `src/services/database/Database.service.ts`

## PostgreSQL connection

The PostgreSQL pool is created in `Database.service.ts` using these env vars:

- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_POOL_SIZE`

The connection service also translates older MySQL-style query fragments to PostgreSQL-friendly SQL for the shared `DataService` flow:

- backticks -> double quotes
- `?` placeholders -> `$1, $2, ...`

## Importing the service

Use the compatibility import that the rest of the codebase already expects:

```ts
import { DataService } from 'src/services/Data.service';
```

Or import the shared implementation directly:

```ts
import { DataService } from 'src/shared/database/Data.service';
```

## Common examples

### 1. Select rows

```ts
const users = await this.Data.query('users', {
  select: ['user_id', 'email', 'created_at'],
  where: [
    { column: 'is_active', operator: '=', value: 1 },
  ],
  orderBy: [
    { column: 'created_at', direction: 'DESC' },
  ],
  limit: 20,
});
```

### 2. Count rows

```ts
const result = await this.Data.query('orders', {
  select: { count: '*' },
  where: [
    { column: 'status', operator: '=', value: 'pending' },
  ],
});

const total = result.data?.[0]?.count ?? 0;
```

### 3. Insert one row

```ts
await this.Data.insert('customers', {
  customer_id: 'CUS_1001',
  name: 'Rahul',
  mobile: '9999999999',
  created_at: new Date(),
});
```

### 4. Update rows

```ts
await this.Data.update(
  'orders',
  { status: 'delivered', updated_at: new Date() },
  [
    { column: 'order_id', operator: '=', value: 'ORD_1001' },
  ],
);
```

### 5. Delete rows

```ts
await this.Data.delete('cache', [
  { column: 'key', operator: '=', value: 'stale_key' },
]);
```

### 6. Join query

```ts
const result = await this.Data.query('orders', {
  select: [
    'orders.order_id',
    'orders.status',
    'customers.name',
  ],
  joins: [
    {
      table: 'customers',
      type: 'LEFT',
      on: [['orders.customer_id', 'customers.customer_id']],
    },
  ],
  where: [
    { column: 'orders.status', operator: '=', value: 'pending' },
  ],
});
```

### 7. Reusing one connection

```ts
const conn = await this.Data.getSharedConnection();

try {
  const customers = await this.Data.queryWithConnection(conn, 'customers', {
    select: ['customer_id', 'name'],
    limit: 10,
  });

  const orders = await this.Data.queryWithConnection(conn, 'orders', {
    select: ['order_id', 'customer_id'],
    limit: 10,
  });
} finally {
  conn.release();
}
```

## Return shape

Most `query()` calls return an object like:

```ts
{
  status: true,
  data: [...],
  message: 'Dynamic query executed'
}
```

Write operations usually return metadata such as affected rows or inserted ids, depending on the operation path.

## Notes for PostgreSQL

- Prefer normal table and column names in lowercase.
- The service now targets PostgreSQL, but some very MySQL-specific raw SQL snippets may still need manual cleanup if they were custom-written outside the helper methods.
- If you pass `subquery`, `having`, or other raw fragments, make sure the SQL is PostgreSQL-compatible.

## Recommended usage pattern

- Use `DataService` for normal CRUD and dynamic list pages.
- Use `DatabaseService` directly only when you truly need custom SQL or transaction-level control.
- If a query becomes highly business-specific or performance-sensitive, move it into a dedicated repository/service method instead of growing one giant dynamic config.

## Encryption behavior

- The developer controls encrypted columns in `src/encryption/sensitive-fields.map.ts`.
- On `insert` and `update`, `DataService` encrypts only the columns declared in that map for the target table.
- On `query` / fetch, `DataService` decrypts those same columns automatically before returning rows.
- Aliased selected fields are also decrypted because `DataService` now uses the internal `source_map` from `qualifySelect()`.
- If a column is not listed in the sensitive-fields map, it is stored and returned as plain text.
