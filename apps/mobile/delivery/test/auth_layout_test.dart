// Layout smoke test for the redesigned delivery-partner auth screens.
//
// Guards the shared auth frame against RenderFlex overflow on small phones
// and at large text scales.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:f2h_delivery/auth/presentation/widgets/auth_kit.dart';

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  required Size size,
  double textScale = 1.0,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(
        size: size,
        textScaler: TextScaler.linear(textScale),
      ),
      child: Directionality(textDirection: TextDirection.ltr, child: child),
    ),
  );
  expect(tester.takeException(), isNull);
}

Widget _loginLikeScreen() => MaterialApp(
  home: DeliveryAuthScaffold(
    title: 'Welcome',
    titleAccent: 'Back',
    subtitle: 'Sign in to manage your deliveries',
    children: [
      DeliveryAuthField(
        controller: TextEditingController(),
        hint: 'Email or Phone',
        icon: Icons.mail_outline_rounded,
      ),
      const SizedBox(height: 26),
      DeliveryAuthField(
        controller: TextEditingController(),
        hint: 'Password',
        icon: Icons.lock_outline_rounded,
        isPassword: true,
      ),
      const SizedBox(height: 10),
      DeliveryTextLink(label: 'Forgot Password?', onTap: () {}),
      const SizedBox(height: 24),
      DeliveryPrimaryButton(label: 'Sign In', onTap: () {}),
      const SizedBox(height: 28),
      const DeliveryAuthDivider(),
      const SizedBox(height: 22),
      DeliveryGoogleButton(onTap: () {}),
      const SizedBox(height: 34),
      DeliveryAuthFooter(
        question: "Don't have an account?",
        action: 'Sign Up',
        onTap: () {},
      ),
    ],
  ),
);

void main() {
  const sizes = <String, Size>{
    'small (320x640)': Size(320, 640),
    'standard (390x844)': Size(390, 844),
    'large (430x932)': Size(430, 932),
  };

  group('DeliveryAuthScaffold lays out', () {
    for (final entry in sizes.entries) {
      testWidgets('on ${entry.key}', (tester) async {
        await _pump(tester, _loginLikeScreen(), size: entry.value);

        expect(find.text('Sign In'), findsOneWidget);
        expect(find.text('Continue with Google'), findsOneWidget);
        expect(find.text('Forgot Password?'), findsOneWidget);
      });
    }

    testWidgets('at 1.3x text scale', (tester) async {
      await _pump(
        tester,
        _loginLikeScreen(),
        size: const Size(390, 844),
        textScale: 1.3,
      );
    });
  });
}
