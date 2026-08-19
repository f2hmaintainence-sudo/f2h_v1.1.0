// Layout smoke tests for the redesigned shop grid and auth screens.
//
// These guard the two layouts that pack a lot of fixed-height rows into a
// constrained box — the 2-column product card and the auth sheet — against
// RenderFlex overflow on small phones and at large text scales.

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/cart/cart_repository.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/get_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/sync_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/product_grid_card.dart';

class _EmptyCartRepository implements CartRepository {
  @override
  Future<CartLoadResultEntity> getCart(String userId) async =>
      CartLoadResultEntity(items: const [], calculations: _emptyCalculations);

  @override
  Future<CartCalculationsEntity> syncCart(
    List<CartItemEntity> items, {
    String? customerId,
  }) async => _emptyCalculations;
}

const CartCalculationsEntity _emptyCalculations = CartCalculationsEntity(
  subtotal: 0,
  deliveryFee: 0,
  taxes: 0,
  grandTotal: 0,
);

CartBloc _buildCartBloc() {
  final repo = _EmptyCartRepository();
  return CartBloc(
    syncCartUseCase: SyncCartUseCase(repo),
    getCartUseCase: GetCartUseCase(repo),
  );
}

Product _product({
  bool subscribable = false,
  bool outOfStock = false,
  String name = 'Fresh Curd Homestyle',
}) => Product(
  id: 'p1',
  name: name,
  vendor: 'F2H',
  unit: '500 ml',
  category: 'Dairy',
  emoji: '🥛',
  price: 50,
  originalPrice: 60,
  subscriptionPrice: subscribable ? 39 : null,
  rating: 4.8,
  reviews: 120,
  isSubscribable: subscribable,
  isOutOfStock: outOfStock,
  badge: '',
  badgeColor: Colors.green,
);

/// Renders [child] in a fixed viewport and fails on any layout exception.
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  required Size size,
  double textScale = 1.0,
}) async {
  final captured = <FlutterErrorDetails>[];
  final previousOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    captured.add(details);
    previousOnError?.call(details);
  };
  addTearDown(() {
    FlutterError.onError = previousOnError;
    for (final d in captured) {
      // ignore: avoid_print
      print('CAPTURED >>> ${d.exception}\n${d.context}\n${d.library}');
    }
  });

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

void main() {
  const sizes = <String, Size>{
    'small (320x640)': Size(320, 640),
    'standard (390x844)': Size(390, 844),
    'large (430x932)': Size(430, 932),
  };

  group('ProductGridCard fits its grid cell', () {
    for (final entry in sizes.entries) {
      testWidgets('on ${entry.key}', (tester) async {
        final bloc = _buildCartBloc();
        addTearDown(bloc.close);

        // Mirrors the shop grid: category rail, page padding, one gutter.
        final cardWidth = (entry.value.width - 84 - 20 - 12) / 2;
        final cellHeight = (cardWidth / kProductGridAspectRatio).clamp(
          292.0,
          double.infinity,
        );

        await _pump(
          tester,
          BlocProvider<CartBloc>.value(
            value: bloc,
            child: Center(
              child: SizedBox(
                width: cardWidth,
                height: cellHeight,
                child: ProductGridCard(_product(subscribable: true)),
              ),
            ),
          ),
          size: entry.value,
        );
      });
    }

    testWidgets('in its out-of-stock state', (tester) async {
      final bloc = _buildCartBloc();
      addTearDown(bloc.close);

      await _pump(
        tester,
        BlocProvider<CartBloc>.value(
          value: bloc,
          child: Center(
            child: SizedBox(
              width: 137,
              height: 263,
              child: ProductGridCard(
                _product(outOfStock: true, name: 'Premium Cashews W320'),
              ),
            ),
          ),
        ),
        size: const Size(390, 844),
      );

      expect(find.text('Out of Stock'), findsOneWidget);
      expect(find.text('OUT OF STOCK'), findsOneWidget);
    });
  });

  group('AuthScaffold lays out', () {
    for (final entry in sizes.entries) {
      testWidgets('on ${entry.key}', (tester) async {
        await _pump(
          tester,
          MaterialApp(
            home: AuthScaffold(
              title: 'Welcome to F2H Fresh!',
              subtitle: 'Login to access fresh dairy & more!',
              heroAction: AuthSkipButton(onTap: () {}),
              children: [
                AuthField(
                  controller: TextEditingController(),
                  hint: 'Email or Phone',
                  icon: Icons.mail_outline_rounded,
                ),
                const SizedBox(height: 14),
                AuthField(
                  controller: TextEditingController(),
                  hint: 'Password',
                  icon: Icons.lock_outline_rounded,
                  isPassword: true,
                ),
                const SizedBox(height: 20),
                AuthPrimaryButton(label: 'Sign In', onTap: () {}),
                const SizedBox(height: 22),
                const AuthDivider(),
                const SizedBox(height: 18),
                GoogleAuthButton(onTap: () {}),
              ],
            ),
          ),
          size: entry.value,
        );

        expect(find.text('Sign In'), findsOneWidget);
        expect(find.text('Continue with Google'), findsOneWidget);
        expect(find.text('Skip'), findsOneWidget);
      });
    }

    testWidgets('at 1.3x text scale', (tester) async {
      await _pump(
        tester,
        MaterialApp(
          home: AuthScaffold(
            title: 'Forgot Password?',
            subtitle:
                "No worries! Enter your email and we'll send you a code to "
                'reset your password.',
            showBack: true,
            children: [
              AuthField(
                controller: TextEditingController(),
                hint: 'Email Address',
                icon: Icons.mail_outline_rounded,
              ),
              const SizedBox(height: 20),
              AuthPrimaryButton(label: 'Send Reset Code', onTap: () {}),
            ],
          ),
        ),
        size: const Size(390, 844),
        textScale: 1.3,
      );
    });
  });
}
