import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_navigation_helper.dart';
// ══════════════════════════════════════════════════════════
//  MICRO HELPERS
// ══════════════════════════════════════════════════════════
class F2HChip extends StatelessWidget {
  final String t; final Color bg, fg;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  const F2HChip(this.t, this.bg, this.fg, {super.key, this.prefixIcon, this.suffixIcon});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (prefixIcon != null) ...[
          Icon(prefixIcon, size: 14, color: fg),
          const SizedBox(width: 4),
        ],
        Flexible(
          child: Text(
            t,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
        if (suffixIcon != null) ...[
          const SizedBox(width: 4),
          Icon(suffixIcon, size: 14, color: fg),
        ],
      ],
    ),
  );
}

class NotifBtn extends StatelessWidget {
  const NotifBtn({super.key});

  @override
  Widget build(BuildContext context) => Stack(children: [
    Container(width: 36, height: 36,
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(10), border: Border.all(color: kBorder)),
      child: const Center(child: Icon(Icons.notifications_none, size: 20, color: kText))),
    Positioned(top: 2, right: 2, child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        decoration: const BoxDecoration(color: Colors.red, borderRadius: BorderRadius.all(Radius.circular(10))),
        child: const Text('2', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)))),
  ]);
}

class CartBtn extends StatelessWidget {
  const CartBtn({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartBloc, CartState>(
      builder: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        int count = 0;
        for (final item in items) {
          if (item.purchaseType == 'subscription') {
            count += 1;
          } else {
            count += item.quantity ?? 1;
          }
        }

        return GestureDetector(
          onTap: () => CartNavHelper.openCart(context),
          behavior: HitTestBehavior.opaque,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kBorder),
                ),
                child: const Center(
                  child: Icon(
                    Icons.shopping_cart_outlined,
                    size: 20,
                    color: kText,
                  ),
                ),
              ),
              if (count > 0)
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      count > 99 ? '99+' : '$count',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class HBadge extends StatelessWidget {
  final String t;
  final IconData? icon;
  const HBadge(this.t, {this.icon, super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 4),
        ],
        Text(t, style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600)),
      ],
    ));
}

class TrustWidget extends StatelessWidget {
  final String v, l;
  const TrustWidget(this.v, this.l, {super.key});
  @override
  Widget build(BuildContext context) => Expanded(child: Column(children: [
    Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kPrimary)),
    const SizedBox(height: 2),
    Text(l, style: const TextStyle(fontSize: 10, color: kTextSub), textAlign: TextAlign.center),
  ]));
}

class VLine extends StatelessWidget {
  const VLine({super.key});

  @override
  Widget build(BuildContext context) => Container(width: 1, height: 28, color: kBorder);
}

class CatWidget extends StatelessWidget {
  final String e, l;
  const CatWidget(this.e, this.l, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(right: 10),
    child: Column(children: [
      Container(width: 58, height: 58,
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: kBorder),
          boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0,2))]),
        child: Center(child: Text(e, style: const TextStyle(fontSize: 28)))),
      const SizedBox(height: 6),
      Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: kTextSub)),
    ]),
  );
}

class StepWidget extends StatelessWidget {
  final String n, t, d;
  final IconData e;
  const StepWidget(this.n, this.e, this.t, this.d, {super.key});
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Container(width: 36, height: 36,
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
      child: Center(child: Icon(e, size: 18, color: Colors.white))),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('STEP $n · ', style: TextStyle(fontSize: 10, color: kAccent, fontWeight: FontWeight.w700)),
        Expanded(child: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white), overflow: TextOverflow.ellipsis)),
      ]),
      const SizedBox(height: 2),
      Text(d, style: const TextStyle(fontSize: 11, color: Colors.white60)),
    ])),
  ]);
}

class StatWidget extends StatelessWidget {
  final String v, l; final Color c;
  const StatWidget(this.v, this.l, this.c, {super.key});
  @override
  Widget build(BuildContext context) => Expanded(child: Column(children: [
    Text(v, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c)),
    const SizedBox(height: 2),
    Text(l, style: const TextStyle(fontSize: 10, color: kTextSub)),
  ]));
}

class WBtn extends StatelessWidget {
  final String e, l; final Color c;
  const WBtn(this.e, this.l, this.c, {super.key});
  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(12)),
    child: Column(children: [
      Text(e, style: const TextStyle(fontSize: 20)),
      const SizedBox(height: 4),
      Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white), textAlign: TextAlign.center),
    ]),
  ));
}

class SAWidget extends StatelessWidget {
  final String l; final Color fg, bg;
  const SAWidget(this.l, this.fg, this.bg, {super.key});
  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 9),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10), border: Border.all(color: fg.withValues(alpha: 0.2))),
    child: Center(child: Text(l, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg))),
  ));
}

class SecWidget extends StatelessWidget {
  final String t; final List<Widget> items;
  const SecWidget(this.t, this.items, {super.key});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Padding(padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(t.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kTextSub, letterSpacing: 1))),
    Container(
      decoration: BoxDecoration(
        color: kSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: kBorder),
        boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0,2))],
      ),
      child: Column(children: List.generate(items.length, (i) => Column(children: [
        items[i],
        if (i < items.length - 1) const Divider(height: 1, color: kBorderLt, indent: 54),
      ]))),
    ),
  ]);
}

class PIWidget extends StatelessWidget {
  final String t, s;
  final IconData icon;
  final Color iconBg, iconColor;
  final VoidCallback? onTap;
  const PIWidget(this.t, this.s, this.icon, this.iconBg, this.iconColor, {this.onTap, super.key});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconBg,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Icon(
              icon,
              color: iconColor,
              size: 18,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText)),
          if (s.isNotEmpty) ...[const SizedBox(height: 2), Text(s, style: const TextStyle(fontSize: 11, color: kTextSub))],
        ])),
        const Icon(Icons.chevron_right, color: kMuted, size: 18),
      ]),
    ),
  );
}

Widget promiseText(String t) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle_outline, size: 12, color: kPrimary),
        const SizedBox(width: 4),
        Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: kPrimary)),
      ],
    );