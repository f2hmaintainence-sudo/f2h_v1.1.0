/**
 * End-to-End Workflow Test: Customer App & Delivery Partner App Integration
 * Validates complete order lifecycle from customer creation -> dispatch -> delivery partner delivery -> customer receipt.
 */
const { Pool } = require('pg');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_dev',
});

const API_BASE = 'http://127.0.0.1:5001/api/v1';

async function httpRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch (_) {
          json = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);

    if (data) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      req.write(payload);
    }
    req.end();
  });
}

async function runE2E() {
  const report = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: true,
  };

  const logStep = (name, passed, details = {}) => {
    report.steps.push({ name, passed, details, timestamp: new Date().toISOString() });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`, JSON.stringify(details));
    if (!passed) report.success = false;
  };

  const client = await pool.connect();

  try {
    console.log('=== STARTING END-TO-END WORKFLOW TEST: CUSTOMER & PARTNER APPS ===\n');

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Verify & Setup Customer Account (Universal Invariant)
    // ──────────────────────────────────────────────────────────────────────────
    const customerUserId = 'F2H_E2E_CUST01';
    const customerPhone = '9880112233';
    const customerEmail = 'e2e_cust@f2htest.local';

    // Upsert customer user
    await client.query(
      `INSERT INTO users (user_id, user_name, phone, email, role_id, account_status, created_at, updated_at)
       VALUES ($1, 'E2E Customer Test', $2, $3, 'CUSTOMER', 'active', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET phone = EXCLUDED.phone, email = EXCLUDED.email, account_status = 'active'`,
      [customerUserId, customerPhone, customerEmail]
    );

    // Upsert customers satellite record
    await client.query(
      `INSERT INTO customers (customer_id, customer_type, wallet_balance, is_blocked, created_at, updated_at)
       VALUES ($1, 'retail', 500.00, false, NOW(), NOW())
       ON CONFLICT (customer_id) DO UPDATE 
       SET wallet_balance = 500.00, is_blocked = false`,
      [customerUserId]
    );

    // Setup customer address
    const testAddressId = 'ADDR_E2E_CUST01';
    await client.query(
      `INSERT INTO customer_addresses (address_id, customer_id, is_default, status, address_type, contact_name, contact_mobile, address_line, branch_id, created_at, updated_at)
       VALUES ($1, $2, true, true, 'home', 'E2E Customer Test', $3, 'Flat 402, Green Valley, Whitefield, Bengaluru', 'BRANCHZqQrENhBR8WZ', NOW(), NOW())
       ON CONFLICT (address_id) DO UPDATE 
       SET status = true, address_line = EXCLUDED.address_line`,
      [testAddressId, customerUserId, customerPhone]
    );

    logStep('Step 1: Setup Test Customer & Universal Customer Invariant', true, {
      user_id: customerUserId,
      phone: customerPhone,
      address_id: testAddressId,
      wallet_balance: 500.00,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: Setup Active Delivery Partner
    // ──────────────────────────────────────────────────────────────────────────
    const partnerUserId = 'F2H_E2E_DP01';
    const partnerPhone = '9880998877';
    const partnerEmail = 'e2e_partner@f2htest.local';

    await client.query(
      `INSERT INTO users (user_id, user_name, phone, email, role_id, account_status, created_at, updated_at)
       VALUES ($1, 'E2E Partner Driver', $2, $3, 'DELIVERY_PARTNER', 'active', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET phone = EXCLUDED.phone, email = EXCLUDED.email, account_status = 'active'`,
      [partnerUserId, partnerPhone, partnerEmail]
    );

    // Partner satellite record
    await client.query(
      `INSERT INTO delivery_partners (delivery_partner_id, is_active, is_available, is_online, vehicle_type, vehicle_number, branch_id, created_at, updated_at)
       VALUES ($1, true, true, true, 'Bike', 'KA-01-AB-1234', 'BRANCHZqQrENhBR8WZ', NOW(), NOW())
       ON CONFLICT (delivery_partner_id) DO UPDATE 
       SET is_active = true, is_available = true, is_online = true`,
      [partnerUserId]
    );

    // Universal customer for partner
    await client.query(
      `INSERT INTO customers (customer_id, customer_type, wallet_balance, is_blocked, created_at, updated_at)
       VALUES ($1, 'retail', 0.00, false, NOW(), NOW())
       ON CONFLICT (customer_id) DO NOTHING`,
      [partnerUserId]
    );

    logStep('Step 2: Setup Active Delivery Partner', true, {
      delivery_partner_id: partnerUserId,
      phone: partnerPhone,
      is_active: true,
      vehicle: 'KA-01-AB-1234',
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Customer App Authentication & Baseline Orders Stream
    // ──────────────────────────────────────────────────────────────────────────
    const jwt = require('jsonwebtoken');
    const jwtSecret = 'f2hfresh-jwt-secret-key-32-chars-minimum-secure-2026';

    const customerToken = jwt.sign(
      { sub: customerUserId, user_id: customerUserId, email: customerEmail, role_id: 'CUSTOMER' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const initialOrdersRes = await httpRequest(`${API_BASE}/customer/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    const baselineOrdersCount = initialOrdersRes.data?.orders?.length || 0;
    logStep('Step 3: Customer App Auth & Baseline Orders Fetch', initialOrdersRes.status === 200, {
      status_code: initialOrdersRes.status,
      orders_count: baselineOrdersCount,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Customer Creates / Places Order for Fresh Milk
    // ──────────────────────────────────────────────────────────────────────────
    const testOrderId = `ORD_E2E_${Date.now()}`;

    // Create order in database (simulating customer checkout completion)
    await client.query(
      `INSERT INTO orders (
         order_id, customer_id, customer_name, order_source, address_id, address_line,
         contact_number, branch_id, delivery_slot, scheduled_date, status, subtotal,
         total_amount, payment_mode, payment_status, created_at, updated_at
       ) VALUES (
         $1, $2, 'E2E Customer Test', 'ecommerce', $3, 'Flat 402, Green Valley, Whitefield, Bengaluru',
         $4, 'BRANCHZqQrENhBR8WZ', 'morning', $5, 'confirmed', 80.00,
         80.00, 'wallet', 'paid', NOW(), NOW()
       )`,
      [testOrderId, customerUserId, testAddressId, customerPhone, todayStr]
    );

    // Create order item
    await client.query(
      `INSERT INTO order_items (order_id, variant_id, product_name, quantity, unit_price, total_price, created_at, updated_at)
       VALUES ($1, 'VRTS8B97MJ2C', 'Fresh cow milk (500ml)', 2, 40.00, 80.00, NOW(), NOW())`,
      [testOrderId]
    );

    // Verify Customer App sees this newly created order
    const afterPlaceOrdersRes = await httpRequest(`${API_BASE}/customer/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    const placedOrderInList = (afterPlaceOrdersRes.data?.orders || []).find((o) => o.order_id === testOrderId);
    logStep('Step 4: Customer Order Placement & Verification via Customer App API', Boolean(placedOrderInList), {
      order_id: testOrderId,
      status: placedOrderInList?.status,
      product: 'Fresh cow milk (500ml) x 2',
      total_amount: placedOrderInList?.total_amount,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Warehouse / Admin Dispatch: Assign Order to Delivery Run
    // ──────────────────────────────────────────────────────────────────────────
    const testRunId = `RUN_E2E_${Date.now()}`;

    // Create delivery run for partner
    await client.query(
      `INSERT INTO delivery_runs (
         run_id, delivery_partner_id, branch_id, run_date, delivery_slot,
         status, assignment_method, total_addresses, completed_addresses, created_at, updated_at
       ) VALUES (
         $1, $2, 'BRANCHZqQrENhBR8WZ', $3, 'morning',
         'assigned', 'manual', 1, 0, NOW(), NOW()
       )`,
      [testRunId, partnerUserId, todayStr]
    );

    // Create delivery run address stop
    await client.query(
      `INSERT INTO delivery_run_addresses (
         run_id, customer_id, address_id, sequence_no, delivery_status, order_ids, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 1, 'pending', $4, NOW(), NOW()
       )`,
      [testRunId, customerUserId, testAddressId, testOrderId]
    );

    // Link order to run and partner while keeping confirmed status so markOrdersOutForDelivery finds it
    await client.query(
      `UPDATE orders 
       SET delivery_run_id = $1, delivery_partner_id = $2, status = 'confirmed', updated_at = NOW()
       WHERE order_id = $3`,
      [testRunId, partnerUserId, testOrderId]
    );

    logStep('Step 5: Warehouse Dispatch & Route Assignment', true, {
      run_id: testRunId,
      partner_id: partnerUserId,
      order_id: testOrderId,
      delivery_slot: 'morning',
      scheduled_date: todayStr,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: Partner App Authentication & Fetch Today's Delivery Run
    // ──────────────────────────────────────────────────────────────────────────
    const partnerToken = jwt.sign(
      { sub: partnerUserId, user_id: partnerUserId, email: partnerEmail, role_id: 'DELIVERY_PARTNER' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const partnerRunRes = await httpRequest(`${API_BASE}/delivery-partner/orders/today?date=${todayStr}&slot=morning`, {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });

    const deliveries = partnerRunRes.data?.deliveries || [];
    const runIdFromApi = partnerRunRes.data?.run_id;
    logStep("Step 6: Delivery Partner App Fetches Today's Delivery Run", partnerRunRes.status === 200, {
      status_code: partnerRunRes.status,
      run_id: runIdFromApi,
      deliveries_count: partnerRunRes.data?.total ?? deliveries.length,
      slot: partnerRunRes.data?.slot,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: Delivery Partner Marks Orders "Out For Delivery"
    // ──────────────────────────────────────────────────────────────────────────
    const outForDeliveryRes = await httpRequest(
      `${API_BASE}/delivery-partner/orders/mark-out-for-delivery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          'Content-Type': 'application/json',
        },
      },
      {}
    );

    const dbOrderAfterOut = await client.query('SELECT status FROM orders WHERE order_id = $1', [testOrderId]);
    const isOutForDelivery = dbOrderAfterOut.rows[0]?.status === 'out_for_delivery';

    logStep('Step 7: Delivery Partner Marks Out For Delivery', isOutForDelivery, {
      api_response: outForDeliveryRes.data,
      db_order_status: dbOrderAfterOut.rows[0]?.status,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 8: Delivery Partner Completes Doorstep Delivery
    // ──────────────────────────────────────────────────────────────────────────
    const deliveryCompletionPayload = {
      status: 'delivered',
      notes: 'Delivered Fresh Cow Milk to customer doorstep. Verified bottle seal.',
      deliveryImage: '/uploads/deliveries/proof_e2e_demo.jpg',
      bottles: 0,
      paymentMode: 'wallet',
      paymentStatus: 'paid',
      container_deliveries: [],
      container_returns: [],
    };

    const deliverRes = await httpRequest(
      `${API_BASE}/delivery-partner/orders/${testOrderId}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          'Content-Type': 'application/json',
        },
      },
      deliveryCompletionPayload
    );

    // Also update delivery_run_addresses status to delivered
    await client.query(
      `UPDATE delivery_run_addresses 
       SET delivery_status = 'delivered', delivered_at = NOW(), updated_at = NOW()
       WHERE run_id = $1 AND customer_id = $2`,
      [testRunId, customerUserId]
    );

    const dbOrderAfterDelivery = await client.query(
      'SELECT status, delivered_at, delivery_image FROM orders WHERE order_id = $1',
      [testOrderId]
    );
    const isDelivered = dbOrderAfterDelivery.rows[0]?.status === 'delivered';
    const deliveredAt = dbOrderAfterDelivery.rows[0]?.delivered_at;

    logStep('Step 8: Delivery Partner Marks Stop Delivered', isDelivered && Boolean(deliveredAt), {
      status: dbOrderAfterDelivery.rows[0]?.status,
      delivered_at: deliveredAt,
      delivery_image: dbOrderAfterDelivery.rows[0]?.delivery_image,
      api_response: deliverRes.data,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 9: Customer App Post-Delivery Verification
    // ──────────────────────────────────────────────────────────────────────────
    const customerOrdersFinalRes = await httpRequest(`${API_BASE}/customer/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    const finalOrder = (customerOrdersFinalRes.data?.orders || []).find((o) => o.order_id === testOrderId);
    const customerVerifiedDelivered = finalOrder?.status === 'delivered';

    logStep('Step 9: Customer App Post-Delivery Status Verification', customerVerifiedDelivered, {
      customer_sees_status: finalOrder?.status,
      order_id: finalOrder?.order_id,
      scheduled_date: finalOrder?.scheduled_date,
      delivered_at: finalOrder?.delivered_at || deliveredAt,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 10: Clean Up Test Records
    // ──────────────────────────────────────────────────────────────────────────
    await client.query('DELETE FROM order_items WHERE order_id = $1', [testOrderId]);
    await client.query('DELETE FROM orders WHERE order_id = $1', [testOrderId]);
    await client.query('DELETE FROM delivery_run_addresses WHERE run_id = $1', [testRunId]);
    await client.query('DELETE FROM delivery_runs WHERE run_id = $1', [testRunId]);
    await client.query('DELETE FROM customer_addresses WHERE address_id = $1', [testAddressId]);
    await client.query('DELETE FROM delivery_partners WHERE delivery_partner_id = $1', [partnerUserId]);
    await client.query('DELETE FROM customers WHERE customer_id IN ($1, $2)', [customerUserId, partnerUserId]);
    await client.query('DELETE FROM users WHERE user_id IN ($1, $2)', [customerUserId, partnerUserId]);

    logStep('Step 10: Database Hygiene & Test Record Cleanup', true, {
      cleaned_order: testOrderId,
      cleaned_run: testRunId,
      cleaned_customer: customerUserId,
      cleaned_partner: partnerUserId,
    });

    console.log('\n=== END-TO-END WORKFLOW SUMMARY ===');
    console.log(`Overall Result: ${report.success ? 'ALL STEPS PASSED (10/10)' : 'FAILED'}`);
  } catch (err) {
    console.error('E2E Workflow Error:', err);
    logStep('E2E Execution Encountered Unhandled Error', false, { error: err.message, stack: err.stack });
  } finally {
    client.release();
    await pool.end();
  }

  return report;
}

runE2E().then((rep) => {
  const fs = require('fs');
  fs.writeFileSync('/tmp/e2e_workflow_results.json', JSON.stringify(rep, null, 2));
  process.exit(rep.success ? 0 : 1);
});
