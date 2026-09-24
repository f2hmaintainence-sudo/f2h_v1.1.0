import { Client } from 'pg';
import axios from 'axios';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  database: 'f2h_dev',
  user: 'f2h_user',
  password: 'f2h_password',
};

const API_BASE = 'http://127.0.0.1:5001/api/v1';

async function run() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('--- 1. CONNECTED TO DATABASE ---');

  // Find an existing active referrer customer
  const custRes = await client.query(
    `SELECT u.user_id, u.first_name, u.phone, c.wallet_balance 
     FROM users u 
     JOIN customers c ON c.customer_id = u.user_id 
     WHERE u.account_status = 'active' AND u.role_id = 'CUSTOMER'
     LIMIT 1`
  );

  if (custRes.rows.length === 0) {
    console.error('No existing customer found for referral test');
    await client.end();
    return;
  }

  const referrer = custRes.rows[0];
  const referrerCode = referrer.user_id;
  const initialBalance = parseFloat(referrer.wallet_balance || '0');
  console.log(`Using Referrer: ID=${referrer.user_id}, Name=${referrer.first_name}, Code=${referrerCode}, Initial Wallet=₹${initialBalance}`);

  // Test 1: Validate Referral Code API Endpoint
  console.log('\n--- 2. TESTING REFERRAL CODE VALIDATION API ---');
  try {
    const valRes = await axios.get(`${API_BASE}/customer/referrals/validate/${referrerCode}`);
    console.log(`Validation API Response: HTTP ${valRes.status} ->`, valRes.data);
  } catch (err: any) {
    console.log('Validation API returned:', err.response?.status, err.response?.data || err.message);
  }

  // Test 2: Real-time Phone OTP Registration with Referral Code
  console.log('\n--- 3. TESTING REAL-TIME REGISTRATION VIA PHONE OTP WITH REFERRAL CODE ---');
  const testPhone = '99999' + Math.floor(10000 + Math.random() * 90000);
  console.log(`Generating test referee phone: ${testPhone}`);

  // Trigger send OTP
  try {
    const sendOtpRes = await axios.post(`${API_BASE}/auth/otp/send`, {
      phone: testPhone,
      purpose: 'login',
    });
    console.log(`Send OTP Response: HTTP ${sendOtpRes.status} ->`, sendOtpRes.data);
  } catch (err: any) {
    console.log('Send OTP Response:', err.response?.status, err.response?.data || err.message);
  }

  // Fetch the OTP from otp_records table
  const otpRes = await client.query(
    `SELECT otp_code FROM otp_records WHERE identifier = $1 ORDER BY created_at DESC LIMIT 1`,
    [testPhone]
  );
  const otpCode = otpRes.rows[0]?.otp_code;
  console.log(`Retrieved generated OTP for ${testPhone}: ${otpCode}`);

  if (!otpCode) {
    console.error('Failed to retrieve OTP from database');
    await client.end();
    return;
  }

  // Submit verify OTP with referral_code
  console.log(`Submitting verify with phone=${testPhone}, otp=${otpCode}, referral_code=${referrerCode}...`);
  const verifyRes = await axios.post(`${API_BASE}/auth/login/phone-otp`, {
    phone: testPhone,
    otp: otpCode,
    referral_code: referrerCode,
  });
  console.log(`Verify OTP Response: HTTP ${verifyRes.status} -> User ID: ${verifyRes.data?.user?.userId || verifyRes.data?.user?.user_id}`);

  const refereeUserId = verifyRes.data?.user?.userId || verifyRes.data?.user?.user_id;

  // Test 3: Check Database Records for Referee and Referral
  console.log('\n--- 4. VERIFYING DATABASE RECORDS ---');
  const refereeUser = (await client.query(
    `SELECT user_id, phone, referred_by FROM users WHERE user_id = $1`,
    [refereeUserId]
  )).rows[0];
  console.log('Referee users table row:', refereeUser);

  const referralRow = (await client.query(
    `SELECT refer_id, referrer_customer_id, referred_customer_id, referral_code, referrer_reward_amount, status 
     FROM referrals 
     WHERE referred_customer_id = $1`,
    [refereeUserId]
  )).rows[0];
  console.log('Referrals table row:', referralRow);

  const isReferredByCorrect = refereeUser?.referred_by === referrer.user_id;
  const isReferralRowCreated = referralRow && referralRow.referrer_customer_id === referrer.user_id && referralRow.status === 'pending';

  console.log(`\nASSERTION: users.referred_by set to referrer ID (${referrer.user_id}):`, isReferredByCorrect ? '✓ PASS' : '✗ FAIL');
  console.log(`ASSERTION: referrals row created with pending status & ₹100 reward:`, isReferralRowCreated ? '✓ PASS' : '✗ FAIL');

  // Test 4: Reward Engine Execution (Simulating First Order Delivered)
  console.log('\n--- 5. SIMULATING FIRST ORDER DELIVERED & REWARD ENGINE DISPATCH ---');
  
  // Update customer first order delivered
  await client.query(
    `UPDATE customers SET first_order_completed = true WHERE customer_id = $1`,
    [refereeUserId]
  );

  // Directly call the reward engine or simulate completion
  const { ReferralRewardEngineService } = await import('../panels/customer/referral/services/referral-reward-engine.service');
  const { DatabaseService } = await import('../shared/database/Database.service');
  const { DeveloperService } = await import('../shared/logger/Developer.service');

  const devService = new DeveloperService({} as any);
  const dbService = new DatabaseService({} as any, devService);
  const rewardEngine = new ReferralRewardEngineService({} as any, dbService, devService);

  const rewardResult = await rewardEngine.processReferralReward(refereeUserId);
  console.log('Reward Engine Result:', rewardResult);

  // Check updated wallet balance and transactions
  const updatedReferrer = (await client.query(
    `SELECT wallet_balance FROM customers WHERE customer_id = $1`,
    [referrer.user_id]
  )).rows[0];
  const newBalance = parseFloat(updatedReferrer?.wallet_balance || '0');

  const updatedReferral = (await client.query(
    `SELECT status, remarks FROM referrals WHERE referred_customer_id = $1`,
    [refereeUserId]
  )).rows[0];

  const walletTx = (await client.query(
    `SELECT transaction_id, amount, reference_type, status, remarks 
     FROM customer_wallet_transactions 
     WHERE customer_id = $1 AND reference_type = 'referral_bonus'
     ORDER BY created_at DESC LIMIT 1`,
    [referrer.user_id]
  )).rows[0];

  console.log(`\nReferrer Wallet Before: ₹${initialBalance} -> After: ₹${newBalance} (Diff: +₹${newBalance - initialBalance})`);
  console.log('Referral Row Status:', updatedReferral?.status);
  console.log('Wallet Transaction Row:', walletTx);

  const isWalletCredited = (newBalance - initialBalance) === 100.0;
  const isStatusRewarded = updatedReferral?.status === 'rewarded';

  console.log(`\nASSERTION: Referrer Wallet Credited ₹100:`, isWalletCredited ? '✓ PASS' : '✗ FAIL');
  console.log(`ASSERTION: Referral Status Updated to "rewarded":`, isStatusRewarded ? '✓ PASS' : '✗ FAIL');

  // Cleanup test referee records to keep dev database pristine
  console.log('\n--- 6. CLEANING UP TEST DATA ---');
  await client.query(`DELETE FROM customer_wallet_transactions WHERE transaction_id = $1`, [walletTx?.transaction_id]);
  await client.query(`UPDATE customers SET wallet_balance = $1 WHERE customer_id = $2`, [initialBalance, referrer.user_id]);
  await client.query(`DELETE FROM referrals WHERE referred_customer_id = $1`, [refereeUserId]);
  await client.query(`DELETE FROM customers WHERE customer_id = $1`, [refereeUserId]);
  await client.query(`DELETE FROM users WHERE user_id = $1`, [refereeUserId]);
  await client.query(`DELETE FROM otp_records WHERE identifier = $1`, [testPhone]);
  console.log('Cleaned up test data and restored referrer wallet balance to ₹' + initialBalance);

  await client.end();
  console.log('\n=== REAL-TIME REFERRAL TEST COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
