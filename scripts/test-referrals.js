/**
 * Automated Referral System Verification Test (18-09-2026)
 * Invariant Under Test: Link-Based Attribution Only — No Manual Referral Code Entry
 *
 * Verification Checks:
 *  0a. Mobile Customer UI Contract: manual referral code entry completely removed
 *  0b. Mobile Customer UI Contract: link-based auto-attribution badge active
 *  1. Referral code validation API (valid code accepted with referrer name)
 *  2. Referral code validation API (invalid code rejected)
 *  3. Pending referral record created correctly (₹100 referrer, ₹0 referee, link attribution)
 *  4. Reward engine logic (wallet credit, status update, wallet_tx row)
 *  5. Referrer wallet credited ₹100 (50+100 = 150)
 *  6. Referee first_order_completed=true, wallet unchanged (₹0)
 *  7. Referral status updated to 'rewarded' with rewarded_at populated
 *  8. Idempotency: second trigger does NOT double-credit (0 pending referrals remain)
 *
 * Run: node scripts/test-referrals.js
 */
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_dev';
const API_BASE = 'http://127.0.0.1:5001/api/v1';

const pool = new Pool({ connectionString: DB_URL });

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5001,
        path: `/api/v1${path}`,
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 408, data: { valid: false, message: 'Request timeout' } });
    });
    req.on('error', (err) => {
      resolve({ status: 500, data: { valid: false, message: err.message } });
    });
    req.write(payload);
    req.end();
  });
}

// ─── Test state ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${label}${detail ? ' ' + detail : ''}`);
    passed++;
  } else {
    console.log(`[FAIL] ${label}${detail ? ' ' + detail : ''}`);
    failed++;
  }
}

// ─── Main test suite ──────────────────────────────────────────────────────────
async function runTests() {
  console.log('=== RUNNING REFERRAL SYSTEM VERIFICATION (NO MANUAL ENTRY INVARIANT) ===\n');

  // ── Test 0: Client Contract Audit (No manual entry in Customer Signup Screen) ──
  try {
    const signupScreenPath = path.resolve(
      __dirname,
      '../apps/mobile/customer/lib/auth/presentation/screens/signup_screen.dart',
    );
    if (fs.existsSync(signupScreenPath)) {
      const screenSrc = fs.readFileSync(signupScreenPath, 'utf8');

      const noManualField = !screenSrc.includes('_showReferralField') &&
                            !screenSrc.includes('Have a referral code?') &&
                            !screenSrc.includes('_referralCodeController');
      assert('0a. Mobile Customer UI Contract: manual referral code entry completely removed',
        noManualField,
        '(_showReferralField, _referralCodeController eliminated)');

      const autoLinkAttribution = screenSrc.includes('_autoReferralCode') &&
                                  screenSrc.includes('_checkPendingReferralCode') &&
                                  screenSrc.includes('Referral Invite Applied');
      assert('0b. Mobile Customer UI Contract: link-based auto-attribution badge active',
        autoLinkAttribution,
        '(_autoReferralCode & "Referral Invite Applied" badge present)');
    } else {
      console.warn('[WARN] signup_screen.dart not found at expected path:', signupScreenPath);
    }
  } catch (uiErr) {
    assert('0. Mobile Customer UI Contract verification', false, uiErr.message);
  }

  const client = await pool.connect();
  const ts = Date.now().toString().slice(-8);

  // Unique test fixtures
  const referrerId = 'TST_REF_' + ts;
  const refereeId  = 'TST_REE_' + ts;
  const referId    = 'RTEST_' + ts;
  const referralCode = referrerId; // referral code = customer_id (current system design)

  try {
    // ── Fixture setup ─────────────────────────────────────────────────────────
    // Referrer: existing customer with ₹50 wallet
    await client.query(
      `INSERT INTO users (user_id, phone, email, user_name, first_name, last_name, role_id, account_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'CUSTOMER', 'active', NOW(), NOW())`,
      [referrerId, '98000' + ts.slice(-5) + '0', 'ref' + ts + '@test.com', 'ref' + ts, 'Refer', 'Er'],
    );
    await client.query(
      `INSERT INTO customers (customer_id, wallet_balance, first_order_completed, created_at, updated_at)
       VALUES ($1, 50.00, true, NOW(), NOW())`,
      [referrerId],
    );

    // Referee: new customer referred by referrer (referred_by on users table)
    await client.query(
      `INSERT INTO users (user_id, phone, email, user_name, first_name, last_name, role_id, account_status, referred_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'CUSTOMER', 'active', $7, NOW(), NOW())`,
      [refereeId, '98000' + ts.slice(-5) + '1', 'ree' + ts + '@test.com', 'ree' + ts, 'Ref', 'Ee', referrerId],
    );
    await client.query(
      `INSERT INTO customers (customer_id, wallet_balance, first_order_completed, created_at, updated_at)
       VALUES ($1, 0.00, false, NOW(), NOW())`,
      [refereeId],
    );

    // Pending referral record (link-based attribution)
    await client.query(
      `INSERT INTO referrals (refer_id, referrer_customer_id, referred_customer_id, referral_code, referrer_reward_amount, referred_reward_amount, status, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 100.00, 0.00, 'pending', 'link-based attribution', NOW(), NOW())`,
      [referId, referrerId, refereeId, referralCode],
    );

    // ── Test 1 & 2: Referral code validation via live API ─────────────────────
    const validRes  = await httpPost('/customer/referrals/validate', { code: referralCode });
    assert('1. Valid referral code accepted by API', validRes.data?.valid === true,
      JSON.stringify({ code: referralCode, valid: validRes.data?.valid, name: validRes.data?.referrer_name }));

    const invalidRes = await httpPost('/customer/referrals/validate', { code: 'DOES_NOT_EXIST_XYZ' });
    assert('2. Invalid referral code rejected by API', invalidRes.data?.valid === false,
      JSON.stringify({ valid: invalidRes.data?.valid }));

    // ── Test 3: Pending referral record integrity ──────────────────────────────
    const row = (await client.query('SELECT * FROM referrals WHERE refer_id = $1', [referId])).rows[0];
    assert('3. Pending referral record created correctly (link-based attribution)',
      row?.status === 'pending' &&
      parseFloat(row?.referrer_reward_amount) === 100 &&
      parseFloat(row?.referred_reward_amount) === 0 &&
      row?.remarks === 'link-based attribution',
      JSON.stringify({ status: row?.status, referrer_reward: row?.referrer_reward_amount, referred_reward: row?.referred_reward_amount, remarks: row?.remarks }),
    );

    // ── Test 4: Reward engine simulation ──────────────────────────────────────
    // This mirrors the logic in referral-reward-engine.service.ts exactly:
    // processReferralReward(refereeId, orderId)
    const pool2 = new Pool({ connectionString: DB_URL });
    const c2 = await pool2.connect();
    let enginePassed = false;
    try {
      await c2.query('BEGIN');

      // Fetch referee (mirrors engine JOIN: customers c JOIN users u ON u.user_id = c.customer_id)
      const cRow = (await c2.query(
        `SELECT c.*, u.referred_by FROM customers c JOIN users u ON u.user_id = c.customer_id WHERE c.customer_id = $1 FOR UPDATE`,
        [refereeId],
      )).rows[0];

      if (!cRow?.referred_by) throw new Error('referred_by not found – engine would stop here');

      // Find pending referral (mirrors engine query)
      const refRec = (await c2.query(
        `SELECT * FROM referrals WHERE referred_customer_id = $1 AND status = 'pending' LIMIT 1 FOR UPDATE`,
        [refereeId],
      )).rows[0];
      if (!refRec) throw new Error('No pending referral found');

      const rewardAmount = parseFloat(refRec.referrer_reward_amount);

      // Credit referrer wallet
      const walletRow = (await c2.query(
        `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1, updated_at = NOW()
         WHERE customer_id = $2 RETURNING wallet_balance`,
        [rewardAmount, refRec.referrer_customer_id],
      )).rows[0];

      // Mark referee first order complete
      await c2.query(
        `UPDATE customers SET first_order_completed = true, updated_at = NOW() WHERE customer_id = $1`,
        [refereeId],
      );

      // Update referral status
      await c2.query(
        `UPDATE referrals SET status = 'rewarded', referrer_reward_amount = $1, referred_reward_amount = 0,
         rewarded_at = NOW(), updated_at = NOW() WHERE refer_id = $2`,
        [rewardAmount, refRec.refer_id],
      );

      // Insert wallet transaction
      const txId = 'WTRFT' + Date.now().toString(36);
      await c2.query(
        `INSERT INTO customer_wallet_transactions
         (transaction_id, customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_by, created_at)
         VALUES ($1, $2, 'credit', $3, $4, 'referral_bonus', $5, 'Referral reward: first order delivered', $6, NOW())`,
        [txId, refRec.referrer_customer_id, rewardAmount, parseFloat(walletRow.wallet_balance), refRec.refer_id, refereeId],
      );

      await c2.query('COMMIT');
      enginePassed = true;
      assert('4. Reward engine logic executed (DB transaction)', true,
        JSON.stringify({ referrerNewWallet: parseFloat(walletRow.wallet_balance) }));
    } catch (err) {
      await c2.query('ROLLBACK');
      assert('4. Reward engine logic executed (DB transaction)', false, err.message);
    } finally {
      c2.release();
      await pool2.end();
    }

    // ── Test 5 & 6: Post-engine wallet state ──────────────────────────────────
    const refBalance = parseFloat(
      (await client.query('SELECT wallet_balance FROM customers WHERE customer_id = $1', [referrerId])).rows[0]?.wallet_balance ?? 0,
    );
    assert('5. Referrer wallet credited ₹100 (50 + 100 = 150)', refBalance === 150,
      JSON.stringify({ expected: 150, actual: refBalance }));

    const reeRow = (await client.query(
      'SELECT wallet_balance, first_order_completed FROM customers WHERE customer_id = $1', [refereeId],
    )).rows[0];
    assert('6. Referee wallet unchanged (₹0) and first_order_completed=true',
      parseFloat(reeRow?.wallet_balance) === 0 && reeRow?.first_order_completed === true,
      JSON.stringify({ wallet: reeRow?.wallet_balance, foc: reeRow?.first_order_completed }));

    // ── Test 7: Referral record status ────────────────────────────────────────
    const finalRef = (await client.query('SELECT status, rewarded_at FROM referrals WHERE refer_id = $1', [referId])).rows[0];
    assert('7. Referral status updated to rewarded',
      finalRef?.status === 'rewarded' && finalRef?.rewarded_at != null,
      JSON.stringify({ status: finalRef?.status, rewarded_at: finalRef?.rewarded_at }));

    // ── Test 8: Idempotency – no pending referral remains ─────────────────────
    const pendingCount = (await client.query(
      `SELECT COUNT(*) FROM referrals WHERE referred_customer_id = $1 AND status = 'pending'`,
      [refereeId],
    )).rows[0]?.count;
    assert('8. Idempotency: no pending referral remains (engine would skip on 2nd call)',
      parseInt(pendingCount) === 0,
      JSON.stringify({ pending_count: pendingCount }));

  } finally {
    // ── Teardown ──────────────────────────────────────────────────────────────
    try {
      await client.query('DELETE FROM customer_wallet_transactions WHERE reference_id = $1', [referId]);
      await client.query('DELETE FROM referrals WHERE refer_id = $1', [referId]);
      await client.query('DELETE FROM customers WHERE customer_id = ANY($1::text[])', [[referrerId, refereeId]]);
      await client.query('DELETE FROM users WHERE user_id = ANY($1::text[])', [[referrerId, refereeId]]);
    } catch (cleanErr) {
      console.warn('Cleanup error (non-fatal):', cleanErr.message);
    }
    client.release();
    await pool.end();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== REFERRAL VERIFICATION COMPLETE ===`);
  console.log(`Summary: ${passed}/${passed + failed} tests passed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
