import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ----------------------------------------------------------
//  F2H REFERRAL FAQ SCREEN – 10 expandable accordions
// ----------------------------------------------------------

const _kTextPrimary = Color(0xFF17211B);
const _kTextSecond  = Color(0xFF6B746E);

class ReferralFaqScreen extends StatelessWidget {
  const ReferralFaqScreen({super.key});

  static const _faqs = [
    {
      'q': 'What is F2H Refer & Earn?',
      'a': 'Refer & Earn allows eligible F2H customers to invite friends using their unique referral link/code and receive rewards when the referral conditions are successfully completed.',
    },
    {
      'q': 'How do I get my referral code?',
      'a': 'Your unique referral code is available in the Refer & Earn section when your account becomes eligible for the referral program.',
    },
    {
      'q': 'How do I invite my friends?',
      'a': 'Tap "Share on WhatsApp". WhatsApp will open with your referral message and link. Select your friend and manually send the message.',
    },
    {
      'q': 'Does F2H automatically message my contacts?',
      'a': 'No. F2H does not automatically send referral messages to your contacts. You choose who receives the invitation and send it yourself.',
    },
    {
      'q': 'When do I receive my reward?',
      'a': 'Rewards are credited after your referred friend completes the required eligible actions, such as successful delivery of their qualifying first order, subject to the referral terms.',
    },
    {
      'q': 'Does my friend also receive a reward?',
      'a': 'If the active referral offer includes a reward for the referred friend, the applicable benefit will be shown before they complete the qualifying action.',
    },
    {
      'q': 'Can I share my referral link with multiple friends?',
      'a': 'Yes, subject to the limits and eligibility rules of the active referral campaign.',
    },
    {
      'q': "What happens if my friend's order is cancelled?",
      'a': 'Cancelled, returned, refunded, fraudulent, or otherwise ineligible orders do not qualify for referral rewards.',
    },
    {
      'q': 'Can an existing F2H customer use my referral link?',
      'a': 'Referral benefits are generally intended for eligible new users unless the active campaign states otherwise.',
    },
    {
      'q': 'Where can I see my earnings?',
      'a': 'Your eligible referral earnings are displayed in the Refer & Earn section.',
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
                  const Text('FAQs',
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
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Everything you need to know about F2H Refer & Earn.',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kTextSecond),
                  ),
                  const SizedBox(height: 16),
                  ..._faqs.map((faq) => _FaqTile(
                        question: faq['q']!,
                        answer: faq['a']!,
                      )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final String question;
  final String answer;
  const _FaqTile({required this.question, required this.answer});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorder),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          collapsedShape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          leading: Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
                color: Color(0xFFECFDF5), shape: BoxShape.circle),
            child: const Icon(Icons.help_outline_rounded,
                color: Color(0xFF047857), size: 16),
          ),
          title: Text(question,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _kTextPrimary)),
          children: [
            Text(answer,
                style: const TextStyle(
                    fontSize: 12,
                    color: _kTextSecond,
                    height: 1.5)),
          ],
        ),
      ),
    );
  }
}
