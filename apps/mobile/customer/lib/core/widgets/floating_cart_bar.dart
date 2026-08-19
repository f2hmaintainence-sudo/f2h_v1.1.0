import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class FloatingCartBar extends StatefulWidget {
  const FloatingCartBar({super.key});

  @override
  State<FloatingCartBar> createState() => _FloatingCartBarState();
}

class _FloatingCartBarState extends State<FloatingCartBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;
  late final Animation<double> _scaleAnim;
  int _prevCount = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _scaleAnim = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.12)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.12, end: 1.0)
            .chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 60,
      ),
    ]).animate(_animCtrl);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  void _triggerAddAnimation() {
    if (mounted) {
      _animCtrl.forward(from: 0.0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CartBloc, CartState>(
      listenWhen: (prev, current) => current is CartLoadedState,
      listener: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        int totalCount = 0;
        for (final item in items) {
          totalCount += item.purchaseType == 'subscription'
              ? 1
              : (item.quantity ?? 1);
        }
        if (totalCount > _prevCount && _prevCount > 0) {
          _triggerAddAnimation();
        }
        _prevCount = totalCount;
      },
      builder: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        if (items.isEmpty) {
          _prevCount = 0;
          return const SizedBox.shrink();
        }

        int totalCount = 0;
        for (final item in items) {
          if (item.purchaseType == 'subscription') {
            totalCount += 1;
          } else {
            totalCount += (item.quantity ?? 1);
          }
        }

        if (totalCount == 0) {
          _prevCount = 0;
          return const SizedBox.shrink();
        }

        if (_prevCount == 0 && totalCount > 0) {
          _triggerAddAnimation();
        }
        _prevCount = totalCount;

        // Show max 3 image avatars. If items.length > 3, show 3 avatars + remaining count badge.
        final maxVisibleAvatars = 3;
        final showRemaining = items.length > maxVisibleAvatars;
        final visibleItems = items.take(maxVisibleAvatars).toList();
        final remainingCount = items.length - maxVisibleAvatars;

        final totalAvatarCircles = visibleItems.length + (showRemaining ? 1 : 0);
        final avatarStackWidth = totalAvatarCircles == 1 ? 34.0 : 34.0 + (totalAvatarCircles - 1) * 16.0;

        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Align(
              alignment: Alignment.bottomCenter,
              heightFactor: 1.0,
              child: ScaleTransition(
                scale: _scaleAnim,
                child: GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CartScreen()),
                    );
                  },
                  child: Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: kPrimary,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withValues(alpha: 0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Product Image Avatars (Up to 3 images + optional remaining count badge)
                        if (visibleItems.isNotEmpty)
                          SizedBox(
                            width: avatarStackWidth,
                            height: 34,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                 for (int idx = 0; idx < visibleItems.length; idx++)
                                  Positioned(
                                    left: idx * 16.0,
                                    child: Container(
                                      width: 32,
                                      height: 32,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withValues(alpha: 0.2),
                                        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.0),
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(16),
                                        child: buildProductImage(
                                          visibleItems[idx].productName,
                                          imageAsset: visibleItems[idx].imageAsset,
                                          width: 32,
                                          height: 32,
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                  ),
                                if (showRemaining)
                                  Positioned(
                                    left: visibleItems.length * 16.0,
                                    child: Container(
                                      width: 32,
                                      height: 32,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: kPrimaryMid,
                                        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.0),
                                      ),
                                      child: Center(
                                        child: Text(
                                          '+$remainingCount',
                                          style: const TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w900,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          )
                        else
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.shopping_bag_outlined,
                              color: Colors.white,
                              size: 17,
                            ),
                          ),

                        const SizedBox(width: 10),

                        // "View cart" Title & Subtitle
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'View cart',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                height: 1.1,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              '$totalCount ${totalCount == 1 ? 'item' : 'items'}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: Colors.white.withValues(alpha: 0.85),
                                height: 1.1,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(width: 12),

                        // Right Chevron Arrow Button
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.22),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
