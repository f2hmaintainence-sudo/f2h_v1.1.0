import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ----------------------------------------------------------
//  F2H REFERRAL TERMS & CONDITIONS SCREEN
//  11 numbered sections + acknowledgement checkbox
// ----------------------------------------------------------

const _kTextPrimary = Color(0xFF17211B);
const _kTextSecond  = Color(0xFF6B746E);
const _kGreenDark   = Color(0xFF16653A);

class ReferralTermsScreen extends StatefulWidget {
  const ReferralTermsScreen({super.key});

  @override
  State<ReferralTermsScreen> createState() => _ReferralTermsScreenState();
}

class _ReferralTermsScreenState extends State<ReferralTermsScreen> {
  bool _accepted = false;

  static const _terms = [
    {
      'title': 'Eligibility',
      'body': 'The Refer & Earn program is available only to eligible F2H customers and may vary by account, location, or campaign.',
    },
    {
      'title': 'Referral Code',
      'body': 'Each eligible customer receives a unique referral code/link. The code is intended to identify referrals associated with that customer.',
    },
    {
      'title': 'New Customer Eligibility',
      'body': 'Unless otherwise stated in a campaign, the referred person must meet the new-user and eligibility requirements displayed by F2H.',
    },
    {
      'title': 'Qualifying Order',
      'body': "The referred customer's order must satisfy the minimum order value, product, location, payment, delivery, and other campaign requirements, if any.",
    },
    {
      'title': 'Successful Delivery',
      'body': 'Referral rewards are processed only after the qualifying order is successfully delivered and validated.',
    },
    {
      'title': 'Cancelled / Refunded Orders',
      'body': 'Cancelled, rejected, returned, refunded, fraudulent, or otherwise ineligible transactions do not qualify for referral rewards.',
    },
    {
      'title': 'Reward Amount',
      'body': 'The reward amount displayed in the app applies to the current referral campaign and may change for future referrals.',
    },
    {
      'title': 'Reward Usage',
      'body': 'Clearly display whether rewards are F2H wallet credit, coupons, discounts, cashback, or another benefit, together with expiry and usage restrictions.',
    },
    {
      'title': 'Fraud Prevention',
      'body': 'F2H may reject or reverse rewards associated with duplicate accounts, fake accounts, self-referrals, manipulated transactions, or other misuse.',
    },
    {
      'title': 'Program Changes',
      'body': 'F2H may modify, suspend, replace, or discontinue referral campaigns in accordance with applicable terms and law.',
    },
    {
      'title': 'Support',
      'body': 'Customers can contact F2H customer support if they believe an eligible referral reward has not been credited.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCFBF7),
      body: SafeArea(
        child: Column(
          children: [
            // App bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F4F2),
                        shape: BoxShape.circle,
                        border: Border.all(color: kBorder),
                      ),
                      child: const Icon(Icons.arrow_back_rounded,
                          color: _kTextPrimary, size: 20),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text('Refer & Earn Terms',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: _kTextPrimary,
                          letterSpacing: -0.3)),
                ],
              ),
            ),

            // Content
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _terms.length + 1, // +1 for checkbox at bottom
                itemBuilder: (context, index) {
                  if (index == _terms.length) {
                    return _buildCheckbox();
                  }
                  final term = _terms[index];
                  return _buildTermCard(index + 1, term['title']!, term['body']!);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTermCard(int num, String title, String body) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xFFECFDF5),
              shape: BoxShape.circle,
            ),
            child: Text('$num',
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF047857))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: _kTextPrimary)),
                const SizedBox(height: 4),
                Text(body,
                    style: const TextStyle(
                        fontSize: 12,
                        color: _kTextSecond,
                        height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckbox() {
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _accepted ? _kGreenDark.withOpacity(0.4) : kBorder,
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            height: 24,
            child: Checkbox(
              value: _accepted,
              onChanged: (v) => setState(() => _accepted = v ?? false),
              activeColor: _kGreenDark,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4)),
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'I have read the Refer & Earn Terms & Conditions.',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _kTextPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
