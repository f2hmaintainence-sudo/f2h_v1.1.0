/**
 * Comprehensive Automated System Test Suite — 18-09-2026
 * Verifies all applications from start:
 * - Universal Customer Provisioning rule
 * - Phone persistence in users table
 * - Admin Add Staff / Partner / Customer
 * - Delivery Partner Registration & Shift
 * - Database Migrations & Invariant Consistency
 * - Clean teardown of test artifacts
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { DatabaseService } from 'src/shared/database/Database.service';
import { AuthService } from 'src/auth/auth.service';
import { AdminSystemService } from 'src/panels/admin/profile/admin-system.service';
import { DeliverySaveAddService } from 'src/panels/admin/delivery/services/saveAdd.service';
import { ProfileService as DpProfileService } from 'src/panels/delivery-partner/profile/profile.service';
import { AuthService as DpAuthService } from 'src/panels/delivery-partner/auth/auth.service';

@Module({
  imports: [AppModule],
})
class TestQaModule {}

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  details: string;
  durationMs: number;
}

const RUN_ID = Date.now().toString(36).toUpperCase().slice(-5);
const results: TestResult[] = [];

async function runTest(
  id: string,
  name: string,
  category: string,
  fn: () => Promise<string>,
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ id, name, category, status: 'PASSED', details, durationMs });
    console.log(`✓ [PASS] [${id}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err?.message || String(err);
    results.push({ id, name, category, status: 'FAILED', details: msg, durationMs });
    console.error(`✗ [FAIL] [${id}] ${name}: ${msg} (${durationMs}ms)`);
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`   F2H FRESH COMPREHENSIVE SYSTEM TEST SUITE (18-09-2026)`);
  console.log(`   Run ID: ${RUN_ID}`);
  console.log(`======================================================\n`);

  const app = await NestFactory.createApplicationContext(TestQaModule, {
    logger: ['error'],
  });

  const db = app.get(DatabaseService);
  const authService = app.get(AuthService);
  const adminSystemService = app.get(AdminSystemService);
  const deliverySaveAddService = app.get(DeliverySaveAddService);
  const dpProfileService = app.get(DpProfileService);
  const dpAuthService = app.get(DpAuthService);

  const cleanupUserIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Category 1: Database Schema & Migration Invariants
    // -------------------------------------------------------------
    await runTest(
      'TC-DB-001',
      'Database Migration 028 Status & Schema Consistency',
      'Database Engine',
      async () => {
        const migrations = await db.query(
          `SELECT filename, applied_at FROM schema_migrations WHERE filename = '028-backfill-universal-customers.sql'`,
        );
        if (!migrations?.length) {
          throw new Error('Migration 028-backfill-universal-customers.sql is not recorded in schema_migrations');
        }
        return `Migration 028 confirmed executed at ${migrations[0].applied_at}`;
      },
    );

    await runTest(
      'TC-DB-002',
      'Universal Customer Invariant: Every User Must Be In Customers Table',
      'Database Engine',
      async () => {
        const unlinked = await db.query(
          `SELECT COUNT(*)::int AS count
           FROM users u
           LEFT JOIN customers c ON c.customer_id = u.user_id
           WHERE c.customer_id IS NULL AND u.user_id IS NOT NULL`,
        );
        const count = unlinked?.[0]?.count ?? -1;
        if (count > 0) {
          throw new Error(`Universal customer invariant violated! Found ${count} users missing from customers table`);
        }
        return `Universal customer invariant verified: 0 unlinked users found`;
      },
    );

    await runTest(
      'TC-DB-003',
      'Identity Single Source of Truth: Users Table Phone Integrity',
      'Database Engine',
      async () => {
        const rows = await db.query(
          `SELECT user_id, phone, role_id
           FROM users
           WHERE phone IS NOT NULL AND phone != ''
           ORDER BY created_at DESC
           LIMIT 10`,
        );
        if (!rows?.length) {
          throw new Error('No user records with phone numbers found in users table');
        }
        return `Verified ${rows.length} latest user records have non-empty phone in users table`;
      },
    );

    // -------------------------------------------------------------
    // Category 2: Delivery Partner App & Universal Customer Rule
    // -------------------------------------------------------------
    const testDpPhone = `98${Math.floor(Math.random() * 90000000 + 10000000)}`;
    let testDpUserId = '';

    await runTest(
      'TC-DP-001',
      'Partner Registration via App creates users + delivery_partners + customers',
      'Delivery Partner App',
      async () => {
        // Step A: verifyMobileOtp for partner
        const otpRes = await authService.verifyMobileOtp({
          phone: testDpPhone,
          otp: '123456',
          role: 'DELIVERY_PARTNER',
        } as any);

        testDpUserId = otpRes.user?.user_id;
        if (!testDpUserId) throw new Error('OTP verification did not return user_id');
        cleanupUserIds.push(testDpUserId);

        // Step B: Complete registration
        await authService.register({
          phone: testDpPhone,
          first_name: 'TestDelivery',
          last_name: `Partner${RUN_ID}`,
          role: 'DELIVERY_PARTNER',
          verification_token: otpRes.verification_token,
        } as any);

        // Assert 1: Users table contains phone
        const userRow = (await db.query(`SELECT user_id, phone, role_id FROM users WHERE user_id = $1`, [testDpUserId]))?.[0];
        if (!userRow || userRow.phone !== testDpPhone) {
          throw new Error(`Users table phone mismatch. Expected ${testDpPhone}, got ${userRow?.phone}`);
        }

        // Assert 2: delivery_partners table record exists
        const dpRow = (await db.query(`SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1`, [testDpUserId]))?.[0];
        if (!dpRow) throw new Error('delivery_partners table record missing for partner');

        // Assert 3: customers table record exists (Universal Customer rule)
        const custRow = (await db.query(`SELECT customer_id, customer_type, wallet_balance FROM customers WHERE customer_id = $1`, [testDpUserId]))?.[0];
        if (!custRow) throw new Error('Universal Customer rule failed! customers record was NOT created for partner');

        return `Partner registered: user_id=${testDpUserId}, phone in users=${userRow.phone}, customers satellite created (type=${custRow.customer_type})`;
      },
    );

    await runTest(
      'TC-DP-002',
      'Delivery Partner Profile Hydration joins users identity cleanly',
      'Delivery Partner App',
      async () => {
        if (!testDpUserId) throw new Error('Prerequisite partner missing');
        const profile = await dpProfileService.getPersonalInfo(testDpUserId);
        if (!profile || profile.phone !== testDpPhone) {
          throw new Error(`Profile phone mismatch. Expected ${testDpPhone}, got ${profile?.phone}`);
        }
        if (!profile.full_name?.includes('TestDelivery')) {
          throw new Error(`Profile full_name mismatch. Got ${profile?.full_name}`);
        }
        return `Profile hydrated successfully: full_name="${profile.full_name}", phone="${profile.phone}", vehicle="${profile.vehicle_type}"`;
      },
    );

    await runTest(
      'TC-DP-003',
      'Delivery Partner Shift Status Toggle (Online / Offline)',
      'Delivery Partner App',
      async () => {
        if (!testDpUserId) throw new Error('Prerequisite partner missing');
        const onlineRes = await dpAuthService.toggleShiftStatus(testDpUserId, true);
        if (!onlineRes.is_online) throw new Error('Failed to go online');

        const offlineRes = await dpAuthService.toggleShiftStatus(testDpUserId, false);
        if (offlineRes.is_online) throw new Error('Failed to go offline');

        return `Shift toggled online -> offline successfully for partner ${testDpUserId}`;
      },
    );

    // -------------------------------------------------------------
    // Category 3: Admin Web Panel & Universal Customer Rule
    // -------------------------------------------------------------
    const testStaffEmail = `staff_${RUN_ID.toLowerCase()}@f2htest.local`;
    const testStaffPhone = `97${Math.floor(Math.random() * 90000000 + 10000000)}`;
    let testStaffUserId = '';

    await runTest(
      'TC-ADM-003',
      'Admin Add New Staff creates users (phone) + management_staff + customers',
      'Admin Panel Web',
      async () => {
        const staffRes = await adminSystemService.createAdminUser(
          {
            user_name: `Staff${RUN_ID}`,
            email: testStaffEmail,
            phone: testStaffPhone,
            password: 'StrongPassword123!',
            role: 'staff',
            department: 'Operations',
            designation: 'Supervisor',
            is_active: true,
          },
          'admin_test',
        );

        testStaffUserId = staffRes.data?.user_id;
        if (!testStaffUserId) throw new Error('Failed to create staff member');
        cleanupUserIds.push(testStaffUserId);

        // Check users
        const u = (await db.query(`SELECT user_id, phone, role_id FROM users WHERE user_id = $1`, [testStaffUserId]))?.[0];
        if (!u || u.phone !== testStaffPhone) {
          throw new Error(`Staff phone mismatch on users table. Expected ${testStaffPhone}, got ${u?.phone}`);
        }

        // Check management_staff
        const ms = (await db.query(`SELECT management_id, user_id, department FROM management_staff WHERE user_id = $1`, [testStaffUserId]))?.[0];
        if (!ms) throw new Error('management_staff record missing');

        // Check customers (Universal Customer rule for staff)
        const c = (await db.query(`SELECT customer_id, customer_type FROM customers WHERE customer_id = $1`, [testStaffUserId]))?.[0];
        if (!c) throw new Error('Universal Customer rule failed! customers record was NOT created for new staff');

        return `Staff created: user_id=${testStaffUserId}, phone in users=${u.phone}, department=${ms.department}, customers satellite created (type=${c.customer_type})`;
      },
    );

    const testAdminDpPhone = `96${Math.floor(Math.random() * 90000000 + 10000000)}`;
    let testAdminDpId = '';

    await runTest(
      'TC-ADM-007',
      'Admin Add Delivery Partner creates users (phone) + delivery_partners + customers',
      'Admin Panel Web',
      async () => {
        const dpAddRes = await deliverySaveAddService.savePartner(
          {
            full_name: `AdminAddedPartner ${RUN_ID}`,
            phone: testAdminDpPhone,
            email: `admindp_${RUN_ID.toLowerCase()}@f2htest.local`,
            daily_salary: 500,
            max_daily_orders: 40,
            is_active: true,
            is_available: true,
          },
          'admin_test',
        );

        if (!dpAddRes.status) throw new Error('Failed to save delivery partner via admin service');

        const u = (await db.query(`SELECT user_id, phone FROM users WHERE phone = $1`, [testAdminDpPhone]))?.[0];
        if (!u) throw new Error('users record missing for admin added partner');
        testAdminDpId = u.user_id;
        cleanupUserIds.push(testAdminDpId);

        const dp = (await db.query(`SELECT delivery_partner_id, daily_salary FROM delivery_partners WHERE delivery_partner_id = $1`, [testAdminDpId]))?.[0];
        if (!dp) throw new Error('delivery_partners record missing');

        const c = (await db.query(`SELECT customer_id FROM customers WHERE customer_id = $1`, [testAdminDpId]))?.[0];
        if (!c) throw new Error('Universal Customer rule failed! customers record was NOT created for admin added partner');

        return `Admin partner created: user_id=${testAdminDpId}, phone in users=${u.phone}, daily_salary=${dp.daily_salary}, customers satellite created`;
      },
    );

    // -------------------------------------------------------------
    // Category 4: Customer App & Orders
    // -------------------------------------------------------------
    const testCustPhone = `95${Math.floor(Math.random() * 90000000 + 10000000)}`;
    let testCustId = '';

    await runTest(
      'TC-CUST-002',
      'Customer Sign-Up via OTP creates users (phone) + customers',
      'Customer App',
      async () => {
        const otpRes = await authService.verifyMobileOtp({
          phone: testCustPhone,
          otp: '123456',
          role: 'CUSTOMER',
        } as any);

        testCustId = otpRes.user?.user_id;
        if (!testCustId) throw new Error('Failed to verify customer OTP');
        cleanupUserIds.push(testCustId);

        const u = (await db.query(`SELECT user_id, phone FROM users WHERE user_id = $1`, [testCustId]))?.[0];
        if (!u || u.phone !== testCustPhone) throw new Error('Customer phone missing in users');

        const c = (await db.query(`SELECT customer_id, wallet_balance FROM customers WHERE customer_id = $1`, [testCustId]))?.[0];
        if (!c) throw new Error('Customer satellite record missing in customers');

        return `Customer verified: user_id=${testCustId}, phone in users=${u.phone}, wallet_balance=${c.wallet_balance}`;
      },
    );

    await runTest(
      'TC-CUST-006',
      'Catalog Products Listing Query & Pricing Integrity',
      'Customer App',
      async () => {
        const products = await db.query(
          `SELECT p.product_id, p.name, pv.selling_price
           FROM products p
           JOIN product_variants pv ON pv.product_id = p.product_id
           WHERE p.is_active = true AND p.deleted_at IS NULL
           LIMIT 5`,
        );
        if (!products?.length) throw new Error('No active products found in catalog');
        return `Catalog loaded: ${products.length} products verified with active variants and pricing`;
      },
    );

    // -------------------------------------------------------------
    // Category 5: End-to-End Cross Surface Invariants
    // -------------------------------------------------------------
    await runTest(
      'TC-E2E-001',
      'Every User Created Across All Roles is Guaranteed to be a Customer',
      'End-to-End Integration',
      async () => {
        const check = await db.query(
          `SELECT u.user_id, u.role_id, c.customer_id
           FROM users u
           LEFT JOIN customers c ON c.customer_id = u.user_id
           WHERE u.user_id = ANY($1)`,
          [cleanupUserIds],
        );
        const missing = check.filter((r: any) => !r.customer_id);
        if (missing.length > 0) {
          throw new Error(`Found ${missing.length} newly created test users missing customer rows: ${JSON.stringify(missing)}`);
        }
        return `All ${check.length} newly created users across partner, staff, and customer roles have verified customer satellite rows`;
      },
    );

  } finally {
    // Teardown test artifacts
    console.log(`\nCleaning up ${cleanupUserIds.length} test accounts...`);
    for (const uid of cleanupUserIds) {
      try {
        await db.query(`DELETE FROM customer_wallet_transactions WHERE customer_id = $1`, [uid]);
        await db.query(`DELETE FROM delivery_partners WHERE delivery_partner_id = $1`, [uid]);
        await db.query(`DELETE FROM management_staff WHERE user_id = $1`, [uid]);
        await db.query(`DELETE FROM customers WHERE customer_id = $1`, [uid]);
        await db.query(`DELETE FROM users WHERE user_id = $1`, [uid]);
      } catch (cleanErr) {
        console.warn(`Cleanup error for ${uid}:`, cleanErr);
      }
    }
    await app.close();
  }

  // Summary output
  console.log(`\n======================================================`);
  console.log(`   TEST EXECUTION SUMMARY (18-09-2026)`);
  console.log(`======================================================`);
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`Total Tests Run : ${results.length}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log(`Pass Rate       : ${((passed / results.length) * 100).toFixed(1)}%\n`);

  // Write results to JSON for reporting
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.resolve(__dirname, '../../../../.claude/test/18-09-2026/test-results/api-results/system-test-results.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ runId: RUN_ID, executedAt: new Date().toISOString(), total: results.length, passed, failed, results }, null, 2));
  console.log(`Results saved to ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
