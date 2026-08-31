import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_result_dialog.dart';

void main() {
  testWidgets('DeliveryResultDialog displays delivered summary and triggers callback', (WidgetTester tester) async {
    const order = DeliveryOrderModel(
      orderId: 'ORD-101',
      orderType: 'single',
      customerId: 'CUST-001',
      customerName: 'Rahul Sharma',
      customerPhone: '+91 9876543210',
      addressId: 'ADDR-01',
      address: '123 Palm Grove, Sector 4, Indiranagar',
      addressLat: 12.9716,
      addressLng: 77.5946,
      status: 'delivered',
      deliverySlot: 'Morning',
      stop: 1,
      subtotal: 20,
      discountAmount: 0,
      gstAmount: 0,
      paymentMode: 'upi',
      paymentStatus: 'paid',
      totalAmount: 20,
      isCod: true,
      codAmount: 20,
      emptyBottlesExpected: 2,
      emptyBottlesCollected: 2,
      products: [],
    );

    final stop = GroupedStop(
      stop: 1,
      customerId: 'CUST-001',
      addressId: 'ADDR-01',
      customerName: 'Rahul Sharma',
      customerPhone: '+91 9876543210',
      address: '123 Palm Grove, Sector 4, Indiranagar',
      addressLat: 12.9716,
      addressLng: 77.5946,
      deliverySlot: 'Morning',
      orders: [order],
    );

    bool nextTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                DeliveryResultDialog.show(
                  context,
                  stop: stop,
                  status: 'delivered',
                  emptyBottlesCollected: 2,
                  paymentMode: 'upi',
                  onNext: () {
                    nextTapped = true;
                  },
                );
              },
              child: const Text('Open Popup'),
            ),
          ),
        ),
      ),
    );

    // Tap button to open popup
    await tester.tap(find.text('Open Popup'));
    await tester.pumpAndSettle();

    // Verify popup content
    expect(find.text('Stop #1 Delivered!'), findsOneWidget);
    expect(find.text('Rahul Sharma'), findsOneWidget);
    expect(find.text('+91 9876543210'), findsOneWidget);
    expect(find.textContaining('₹20 (UPI)'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);

    // Tap Done
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();

    expect(nextTapped, isTrue);
    expect(find.text('Stop #1 Delivered!'), findsNothing);
  });
}
