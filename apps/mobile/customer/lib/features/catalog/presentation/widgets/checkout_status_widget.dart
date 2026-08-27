import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class CheckoutStatusWidget extends StatelessWidget {
  final bool isSubscription;
  final String status; // 'success', 'pending', 'failed'
  final String? deliveryAddress;
  final String? orderId;
  final String? errorMessage;
  final VoidCallback onDone;

  const CheckoutStatusWidget({
    super.key,
    this.isSubscription = false,
    required this.status,
    this.deliveryAddress,
    this.orderId,
    this.errorMessage,
    required this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    Color themeColor;
    IconData icon;
    String title;
    String subtitle;

    switch (status) {
      case 'pending':
        themeColor = const Color(0xFFD97706); // Amber/orange
        icon = Icons.schedule_rounded;
        title = isSubscription ? 'Subscription Pending' : 'Order Pending';
        subtitle = 'Your payment is pending confirmation.';
        break;
      case 'failed':
        themeColor = const Color(0xFFDC2626); // Red
        icon = Icons.cancel_rounded;
        title = isSubscription ? 'Subscription Failed' : 'Order Failed';
        subtitle = errorMessage ?? 'An error occurred while placing the order. Please try again.';
        break;
      case 'success':
      default:
        themeColor = isSubscription ? kAccent : kPrimary;
        icon = isSubscription ? Icons.verified_rounded : Icons.check_circle_rounded;
        title = isSubscription ? 'Subscription Activated' : 'Order Placed';
        subtitle = isSubscription
            ? 'Your recurring delivery schedule is now active.'
            : 'Your order has been placed and is being processed.';
        break;
    }

    final hasId = orderId != null && orderId!.isNotEmpty;
    final hasAddress = deliveryAddress != null && deliveryAddress!.isNotEmpty;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.close, color: kText),
            onPressed: onDone,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(),

              // Status Icon Container
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: themeColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  color: themeColor,
                  size: 48,
                ),
              ),
              const SizedBox(height: 24),

              // Title and Subtitle
              Text(
                title,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 14,
                  color: kTextSub,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 32),

              // Info Card (only show if we have ID or Address to display)
              if (hasId || hasAddress)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order/Subscription ID Row
                      if (hasId) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isSubscription ? 'SUBSCRIPTION ID' : 'ORDER ID',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: kTextSub,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              orderId!,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: themeColor,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                        if (hasAddress)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12.0),
                            child: Divider(color: Color(0xFFE5E7EB), height: 1),
                          ),
                      ],

                      // Address Row
                      if (hasAddress) ...[
                        const Text(
                          'DELIVERY ADDRESS',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: kTextSub,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          deliveryAddress!,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: kText,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

              const Spacer(flex: 2),

              // Done Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: onDone,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: themeColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    status == 'success'
                        ? (isSubscription ? 'View Subscription' : 'View Order Details')
                        : 'Done',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
