import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/theme/app_colors.dart';

/// Bottom offset for the [AnimatedPositioned] that hosts a [FloatingCartBar].
///
/// AppShell's Scaffold sets `extendBody: true`, so Flutter hands the body a
/// `MediaQuery.padding.bottom` equal to the bottom nav bar's height. The bar's
/// own `SafeArea` consumes that, which already parks the pill directly on top
/// of the nav bar — adding a positive offset as well stacked a second nav-bar
/// height of empty space beneath it. Hence 0 while the nav bar is visible.
///
/// When the nav bar slides away it still occupies its layout slot, so the
/// reported padding does not shrink; the offset goes negative to claw that
/// space back and let the pill settle just above the device's gesture inset.
double floatingCartBarBottomOffset(
  BuildContext context, {
  required bool isNavVisible,
}) {
  if (isNavVisible) return 0;
  final mq = MediaQuery.of(context);
  return (mq.viewPadding.bottom + 4) - mq.padding.bottom;
}

/// Wrap a screen's body with this so any [FloatingCartBar] inside it collapses
/// to a compact pill while the user scrolls down, and expands again when they
/// scroll back up. Without the scope the bar simply stays expanded.
class CartBarScrollScope extends StatefulWidget {
  final Widget child;
  const CartBarScrollScope({required this.child, super.key});

  static ValueListenable<bool>? maybeOf(BuildContext context) => context
      .dependOnInheritedWidgetOfExactType<_CartBarScrollScopeMarker>()
      ?.isCompact;

  @override
  State<CartBarScrollScope> createState() => _CartBarScrollScopeState();
}

class _CartBarScrollScopeState extends State<CartBarScrollScope> {
  /// Content scrolled past this offset before the bar is allowed to collapse,
  /// so a tiny drag at the top of a list does not shrink it.
  static const double _collapseThreshold = 40;

  final ValueNotifier<bool> _isCompact = ValueNotifier<bool>(false);

  @override
  void dispose() {
    _isCompact.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification notification) {
    // Horizontal carousels (and their auto-scroll) must not touch the bar.
    if (notification.metrics.axis != Axis.vertical) return false;

    if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta ?? 0;
      if (delta > 1.0 && notification.metrics.pixels > _collapseThreshold) {
        if (!_isCompact.value) _isCompact.value = true;
      } else if (delta < -1.0 || notification.metrics.pixels <= _collapseThreshold) {
        if (_isCompact.value) _isCompact.value = false;
      }
    } else if (notification is UserScrollNotification) {
      if (notification.direction == ScrollDirection.reverse &&
          notification.metrics.pixels > _collapseThreshold) {
        if (!_isCompact.value) _isCompact.value = true;
      } else if (notification.direction == ScrollDirection.forward ||
          notification.metrics.pixels <= _collapseThreshold) {
        if (_isCompact.value) _isCompact.value = false;
      }
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: _onScroll,
      child: _CartBarScrollScopeMarker(
        isCompact: _isCompact,
        child: widget.child,
      ),
    );
  }
}

class _CartBarScrollScopeMarker extends InheritedWidget {
  final ValueListenable<bool> isCompact;

  const _CartBarScrollScopeMarker({
    required this.isCompact,
    required super.child,
  });

  @override
  bool updateShouldNotify(_CartBarScrollScopeMarker oldWidget) =>
      oldWidget.isCompact != isCompact;
}

class FloatingCartBar extends StatefulWidget {
  const FloatingCartBar({super.key});

  @override
  State<FloatingCartBar> createState() => _FloatingCartBarState();
}

class _FloatingCartBarState extends State<FloatingCartBar>
    with SingleTickerProviderStateMixin {
  static const Duration _resizeDuration = Duration(milliseconds: 320);
  static const Curve _resizeCurve = Curves.fastOutSlowIn;

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
        tween: Tween<double>(
          begin: 1.0,
          end: 1.12,
        ).chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 1.12,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.easeOutBack)),
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

        final totalAvatarCircles =
            visibleItems.length + (showRemaining ? 1 : 0);

        final compactListenable = CartBarScrollScope.maybeOf(context);

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
                  child: compactListenable == null
                      ? _buildPill(
                          isCompact: false,
                          visibleItems: visibleItems,
                          showRemaining: showRemaining,
                          remainingCount: remainingCount,
                          totalAvatarCircles: totalAvatarCircles,
                          totalCount: totalCount,
                        )
                      : ValueListenableBuilder<bool>(
                          valueListenable: compactListenable,
                          builder: (context, isCompact, _) => AnimatedSize(
                            duration: _resizeDuration,
                            curve: _resizeCurve,
                            alignment: Alignment.bottomCenter,
                            child: _buildPill(
                              isCompact: isCompact,
                              visibleItems: visibleItems,
                              showRemaining: showRemaining,
                              remainingCount: remainingCount,
                              totalAvatarCircles: totalAvatarCircles,
                              totalCount: totalCount,
                            ),
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

  /// The cart pill itself. Smoothly animates size, avatars, text and chevron
  /// between full and compact states.
  Widget _buildPill({
    required bool isCompact,
    required List<dynamic> visibleItems,
    required bool showRemaining,
    required int remainingCount,
    required int totalAvatarCircles,
    required int totalCount,
  }) {
    final avatarSize = isCompact ? 22.0 : 32.0;
    final avatarOverlap = isCompact ? 11.0 : 16.0;
    final avatarSlotSize = avatarSize + 2;
    final avatarStackWidth = totalAvatarCircles == 1
        ? avatarSlotSize
        : avatarSlotSize + (totalAvatarCircles - 1) * avatarOverlap;

    return AnimatedContainer(
      duration: _resizeDuration,
      curve: _resizeCurve,
      height: isCompact ? 36 : 48,
      padding: EdgeInsets.symmetric(horizontal: isCompact ? 10 : 14),
      decoration: BoxDecoration(
        color: kPrimary,
        borderRadius: BorderRadius.circular(isCompact ? 18 : 24),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: isCompact ? 0.28 : 0.35),
            blurRadius: isCompact ? 8 : 14,
            offset: Offset(0, isCompact ? 2 : 5),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Product Image Avatars
          if (visibleItems.isNotEmpty)
            AnimatedContainer(
              duration: _resizeDuration,
              curve: _resizeCurve,
              width: avatarStackWidth,
              height: avatarSlotSize,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  for (int idx = 0; idx < visibleItems.length; idx++)
                    AnimatedPositioned(
                      duration: _resizeDuration,
                      curve: _resizeCurve,
                      left: idx * avatarOverlap,
                      top: 0,
                      child: AnimatedContainer(
                        duration: _resizeDuration,
                        curve: _resizeCurve,
                        width: avatarSize,
                        height: avatarSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.2),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.4),
                            width: 1.0,
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(avatarSize / 2),
                          child: buildProductImage(
                            visibleItems[idx].productName,
                            imageAsset: visibleItems[idx].imageAsset,
                            width: avatarSize,
                            height: avatarSize,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  if (showRemaining)
                    AnimatedPositioned(
                      duration: _resizeDuration,
                      curve: _resizeCurve,
                      left: visibleItems.length * avatarOverlap,
                      top: 0,
                      child: AnimatedContainer(
                        duration: _resizeDuration,
                        curve: _resizeCurve,
                        width: avatarSize,
                        height: avatarSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: kPrimaryMid,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.4),
                            width: 1.0,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            '+$remainingCount',
                            style: TextStyle(
                              fontSize: isCompact ? 8.5 : 9.5,
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
            AnimatedContainer(
              duration: _resizeDuration,
              curve: _resizeCurve,
              width: avatarSize,
              height: avatarSize,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.shopping_bag_outlined,
                color: Colors.white,
                size: isCompact ? 13 : 17,
              ),
            ),

          SizedBox(width: isCompact ? 8 : 10),

          // Fluid Cross-Fade between Expanded and Compact text formats
          AnimatedCrossFade(
            duration: _resizeDuration,
            firstCurve: Curves.easeOutCubic,
            secondCurve: Curves.easeOutCubic,
            sizeCurve: Curves.fastOutSlowIn,
            crossFadeState: isCompact
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
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
            secondChild: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'View cart • $totalCount',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.1,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ],
            ),
          ),

          // Smoothly animate the right chevron circle
          AnimatedSize(
            duration: _resizeDuration,
            curve: _resizeCurve,
            child: isCompact
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: Container(
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
                  ),
          ),
        ],
      ),
    );
  }
}
