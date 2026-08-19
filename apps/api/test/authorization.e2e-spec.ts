import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { RedisService } from 'src/shared/redis/redis.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { assertConnectedToTestDatabase } from './assert-test-database';

/**
 * The regression suite for the authorization layer (F-02, F-03) and for the money
 * path (F-11, F-12, F-15, F-31).
 *
 * It needs a real PostgreSQL and Redis — the defects it covers are transaction and
 * constraint defects, and a mock cannot express those. Point it at a scratch
 * database and run:
 *
 *   TEST_DB_DATABASE=f2h_fresh_test ENABLE_CRON=false npm run test:e2e
 *
 * Without TEST_DB_DATABASE the suite skips rather than touching a real database.
 */
const TEST_DB = process.env.TEST_DB_DATABASE;
const describeIfTestDb = TEST_DB ? describe : describe.skip;

const CUSTOMER_ID = 'E2ECUST01';
const ADMIN_ID = 'E2EADMIN01';

const ADMIN_ROUTE_PREFIXES = [
  '/api/v1/admin/analytics/revenue',
  '/api/v1/admin/orders/table',
  '/api/v1/admin/customer/table',
  '/api/v1/admin/subscriptions/calendar',
];

describeIfTestDb('Authorization and checkout', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let redis: RedisService;
  let jwt: JwtService;

  const tokenFor = async (userId: string, role: string) => {
    const jti = `${userId}-${role}-jti`;
    const token = jwt.sign({ sub: userId, email: `${userId}@example.com`, role, jti });
    const now = Date.now();
    await redis.put(
      `f2h_user_jwt_${userId}`,
      JSON.stringify({
        sessions: [
          {
            accessJti: jti,
            refreshJti: null,
            createdAt: now,
            lastUsed: now,
            accessTokenExpiresAt: now + 900_000,
            refreshTokenExpiresAt: now + 900_000,
          },
        ],
      }),
      900,
    );
    return token;
  };

  beforeAll(async () => {
    // The database is selected in test/setup-env.ts, which runs before app.module
    // is imported — by the time this hook runs, ConfigModule has already cached it.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = await assertConnectedToTestDatabase(app, TEST_DB as string);
    redis = app.get(RedisService);
    jwt = app.get(JwtService);

    // Clear first: an aborted earlier run leaves rows that collide on unique
    // constraints the ON CONFLICT clauses below do not cover (phone, sku, slug).
    await cleanup(db);
    await seed(db);
  });

  afterAll(async () => {
    if (db) await cleanup(db);
    await app?.close();
  });

  describe('admin routes reject non-admin tokens (F-02, F-03)', () => {
    it.each(ADMIN_ROUTE_PREFIXES)('returns 403 for a customer token on %s', async (route) => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it.each(ADMIN_ROUTE_PREFIXES)('returns 401 with no token on %s', async (route) => {
      await request(app.getHttpServer()).get(route).expect(401);
    });

    it.each(ADMIN_ROUTE_PREFIXES)('does not return 403 for an admin token on %s', async (route) => {
      const token = await tokenFor(ADMIN_ID, 'ADMIN');
      const res = await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
  });

  describe('checkout', () => {
    const checkoutBody = (quantity: number) => ({
      items: [
        {
          product_id: 'E2EPROD',
          product_variant_id: 'E2EVAR',
          onetime_details: { quantity, delivery_date: '2030-01-01', delivery_slot: 'Morning' },
        },
      ],
      address_id: 'E2EADDR',
      payment_method: 'wallet',
    });

    beforeEach(async () => {
      await db.query(`UPDATE customers SET wallet_balance = 1000 WHERE customer_id = $1`, [CUSTOMER_ID]);
      await db.query(`DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id = $1)`, [CUSTOMER_ID]);
      await db.query(`DELETE FROM orders WHERE customer_id = $1`, [CUSTOMER_ID]);
      await db.query(`DELETE FROM customer_wallet_transactions WHERE customer_id = $1`, [CUSTOMER_ID]);
      await db.query(`DELETE FROM customer_bill_items WHERE bill_id IN (SELECT bill_id FROM customer_bills WHERE customer_id = $1)`, [CUSTOMER_ID]);
      await db.query(`DELETE FROM customer_bills WHERE customer_id = $1`, [CUSTOMER_ID]);
    });

    it('rejects an unknown variant instead of pricing it at a fallback (F-15)', async () => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');
      const body = checkoutBody(1);
      body.items[0].product_variant_id = 'NO_SUCH_VARIANT';

      const res = await request(app.getHttpServer())
        .post('/api/v1/customer/checkout/payment')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);

      expect(res.body.message).toContain('unavailable');
      await expectNothingWritten(db);
    });

    it('rolls the whole checkout back when the balance is insufficient (F-11)', async () => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');

      await request(app.getHttpServer())
        .post('/api/v1/customer/checkout/payment')
        .set('Authorization', `Bearer ${token}`)
        .send(checkoutBody(50)) // 50 x 100 = 5000 against a 1000 balance
        .expect(400);

      await expectNothingWritten(db);
      const [customer] = await db.query(
        `SELECT wallet_balance FROM customers WHERE customer_id = $1`,
        [CUSTOMER_ID],
      );
      expect(Number(customer.wallet_balance)).toBe(1000);
    });

    it('debits once, records a matching ledger row, and writes the order', async () => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');

      await request(app.getHttpServer())
        .post('/api/v1/customer/checkout/payment')
        .set('Authorization', `Bearer ${token}`)
        .send(checkoutBody(2))
        .expect(201);

      const [customer] = await db.query(
        `SELECT wallet_balance FROM customers WHERE customer_id = $1`,
        [CUSTOMER_ID],
      );
      expect(Number(customer.wallet_balance)).toBe(800);

      const ledger = await db.query(
        `SELECT amount, balance_after FROM customer_wallet_transactions WHERE customer_id = $1`,
        [CUSTOMER_ID],
      );
      expect(ledger).toHaveLength(1);
      expect(Number(ledger[0].amount)).toBe(200);
      // balance_after must come from what the debit actually committed.
      expect(Number(ledger[0].balance_after)).toBe(800);

      const items = await db.query(
        `SELECT oi.variant_id, oi.quantity FROM order_items oi
           JOIN orders o ON o.order_id = oi.order_id
          WHERE o.customer_id = $1`,
        [CUSTOMER_ID],
      );
      expect(items).toHaveLength(1);
      expect(items[0].variant_id).toBe('E2EVAR');
    });

    it('cannot be double-spent by two concurrent requests (F-12)', async () => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');
      // Two 600 checkouts against a 1000 balance: exactly one may succeed.
      const send = () =>
        request(app.getHttpServer())
          .post('/api/v1/customer/checkout/payment')
          .set('Authorization', `Bearer ${token}`)
          .send(checkoutBody(6));

      const results = await Promise.all([send(), send()]);
      const succeeded = results.filter((r) => r.status === 201);
      expect(succeeded).toHaveLength(1);

      const [customer] = await db.query(
        `SELECT wallet_balance FROM customers WHERE customer_id = $1`,
        [CUSTOMER_ID],
      );
      expect(Number(customer.wallet_balance)).toBe(400);
    });

    it('never writes to another customer’s cart (F-14)', async () => {
      const token = await tokenFor(CUSTOMER_ID, 'CUSTOMER');
      await db.query(
        `INSERT INTO carts (user_id, cart_data) VALUES ($1, '[]')
         ON CONFLICT (user_id) DO UPDATE SET cart_data = '[]'`,
        [ADMIN_ID],
      );

      await request(app.getHttpServer())
        .post('/api/v1/customer/cart-sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [], customer_id: ADMIN_ID })
        .expect(201);

      const [victim] = await db.query(
        `SELECT cart_data, updated_at FROM carts WHERE user_id = $1`,
        [ADMIN_ID],
      );
      const [own] = await db.query(
        `SELECT updated_at FROM carts WHERE user_id = $1`,
        [CUSTOMER_ID],
      );
      expect(new Date(own.updated_at).getTime()).toBeGreaterThan(
        new Date(victim.updated_at).getTime(),
      );
    });
  });
});

async function expectNothingWritten(db: DatabaseService) {
  const [counts] = await db.query(
    `SELECT
       (SELECT count(*) FROM orders WHERE customer_id = $1) AS orders,
       (SELECT count(*) FROM customer_wallet_transactions WHERE customer_id = $1) AS ledger,
       (SELECT count(*) FROM customer_bills WHERE customer_id = $1) AS bills`,
    [CUSTOMER_ID],
  );
  expect(Number(counts.orders)).toBe(0);
  expect(Number(counts.ledger)).toBe(0);
  expect(Number(counts.bills)).toBe(0);
}

async function seed(db: DatabaseService) {
  await db.query(
    `INSERT INTO roles (id, sno, role_id, name, is_system_role, is_active)
     VALUES (901,'901','CUSTOMER','Customer',1,1), (902,'902','ADMIN','Admin',1,1)
     ON CONFLICT DO NOTHING`,
  );
  await db.query(
    `INSERT INTO users (user_id, email, user_name, first_name, last_name, phone, role_id, account_status)
     VALUES ($1,$2,'e2ecust','E2E','Customer','9990000001','CUSTOMER','active'),
            ($3,$4,'e2eadmin','E2E','Admin','9990000002','ADMIN','active')
     ON CONFLICT (user_id) DO NOTHING`,
    [CUSTOMER_ID, `${CUSTOMER_ID}@example.com`, ADMIN_ID, `${ADMIN_ID}@example.com`],
  );
  await db.query(
    `INSERT INTO branches (branch_id, branch_name, is_active) VALUES ('E2EBRANCH','E2E Branch', true)
     ON CONFLICT (branch_id) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO customers (customer_id, branch_id, wallet_balance, customer_status)
     VALUES ($1,'E2EBRANCH',1000,'active') ON CONFLICT (customer_id) DO NOTHING`,
    [CUSTOMER_ID],
  );
  await db.query(
    `INSERT INTO customer_addresses (address_id, customer_id, address_line, contact_mobile, contact_name, branch_id, is_default, status)
     VALUES ('E2EADDR',$1,'1 E2E Street','9990000001','E2E Customer','E2EBRANCH', true, true)
     ON CONFLICT (address_id) DO NOTHING`,
    [CUSTOMER_ID],
  );
  await db.query(
    `INSERT INTO categories (category_id, name, slug) VALUES ('E2ECAT','E2E','e2e')
     ON CONFLICT DO NOTHING`,
  );
  await db.query(
    `INSERT INTO products (product_id, sku, name, slug, category_id, unit_type)
     VALUES ('E2EPROD','E2ESKU','E2E Milk','e2e-milk','E2ECAT','ltr')
     ON CONFLICT (product_id) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO product_variants (variant_id, product_id, name, price, status)
     VALUES ('E2EVAR','E2EPROD','1L',100,'active')
     ON CONFLICT (variant_id) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO carts (user_id, cart_data) VALUES ($1,'[]')
     ON CONFLICT (user_id) DO UPDATE SET cart_data = '[]'`,
    [CUSTOMER_ID],
  );
  await db.query(
    `INSERT INTO role_assignments (id, user_id, role_id, is_active)
     VALUES (9001,$1,'CUSTOMER',1), (9002,$2,'ADMIN',1)
     ON CONFLICT DO NOTHING`,
    [CUSTOMER_ID, ADMIN_ID],
  );
}

/**
 * Removes everything seed() created. The catalog rows (category, product, variant,
 * branch) were originally missing from here, and an earlier run left them behind in
 * a database it should never have reached — a visible "E2E" category in the
 * customer-facing catalog. Anything seed() writes must be deleted here.
 */
async function cleanup(db: DatabaseService) {
  await db.query(`DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id = ANY($1))`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM orders WHERE customer_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM customer_bill_items WHERE bill_id IN (SELECT bill_id FROM customer_bills WHERE customer_id = ANY($1))`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM customer_bills WHERE customer_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM customer_wallet_transactions WHERE customer_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM carts WHERE user_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM role_assignments WHERE user_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM customer_addresses WHERE customer_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM customers WHERE customer_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM users WHERE user_id = ANY($1)`, [[CUSTOMER_ID, ADMIN_ID]]);
  await db.query(`DELETE FROM product_variants WHERE variant_id = 'E2EVAR'`);
  await db.query(`DELETE FROM products WHERE product_id = 'E2EPROD'`);
  await db.query(`DELETE FROM categories WHERE category_id = 'E2ECAT'`);
  await db.query(`DELETE FROM branches WHERE branch_id = 'E2EBRANCH'`);
  await db.query(`DELETE FROM roles WHERE id = ANY($1)`, [[901, 902]]);
  // Also clear by the synthetic phone numbers, which carry their own unique index.
  await db.query(`DELETE FROM users WHERE phone = ANY($1)`, [['9990000001', '9990000002']]);
}
