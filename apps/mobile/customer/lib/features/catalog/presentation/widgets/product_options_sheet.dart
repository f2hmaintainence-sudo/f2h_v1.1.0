import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import '../../../../core/session/customer_session_cubit.dart';
import '../../../../core/widgets/custom_date_picker.dart';
import '../../data/models/product_model.dart';
import '../../../subscription/presentation/bloc/subscription_bloc.dart';
import '../../../subscription/presentation/bloc/subscription_event.dart';
import '../../../subscription/presentation/bloc/subscription_state.dart';

class ProductOptionsSheet extends StatefulWidget {
  final Product product;
  const ProductOptionsSheet({required this.product, super.key});

  @override
  State<ProductOptionsSheet> createState() => _ProductOptionsSheetState();
}

class _ProductOptionsSheetState extends State<ProductOptionsSheet> {
  int _quantity = 1;
  bool _isSubscription = true;
  String _scheduleType = 'daily';
  final List<String> _selectedDays = ['mon', 'wed', 'fri'];
  String _deliverySlot = 'Morning (6:00 AM - 8:00 AM)';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));

  final List<String> _slots = [
    'Morning (6:00 AM - 8:00 AM)',
    'Evening (6:00 PM - 8:00 PM)'
  ];

  final List<(String, String)> _daysOfWeek = [
    ('Mon', 'mon'),
    ('Tue', 'tue'),
    ('Wed', 'wed'),
    ('Thu', 'thu'),
    ('Fri', 'fri'),
    ('Sat', 'sat'),
    ('Sun', 'sun'),
  ];

  int get _maxStock => widget.product.maxStock;

  @override
  Widget build(BuildContext context) {
    if (!widget.product.isSubscribable && _isSubscription) {
      _isSubscription = false;
    }

    return BlocListener<SubscriptionBloc, SubscriptionState>(
      listener: (context, state) {
        if (state is SubscriptionActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message), backgroundColor: kPrimary),
          );
          Navigator.of(context).pop();
        } else if (state is SubscriptionError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message), backgroundColor: Colors.red),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Drag Handle


              // Header Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withOpacity(0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        widget.product.emoji,
                        style: const TextStyle(fontSize: 34),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.product.displayName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: kText,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${widget.product.vendor} · ${widget.product.unit}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: kTextSub,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${widget.product.price.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: kPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: kBgDeep,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close, size: 18, color: kTextMid),
                    ),
                  ),
                ],
              ),
              const Divider(height: 24, color: kBorderLt),

              // Quantity Selector
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Select Quantity',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: kText,
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    child: Row(
                      children: [
                        _qtyBtn(Icons.remove, () {
                          if (_quantity > 1) setState(() => _quantity--);
                        }),
                        Container(
                          width: 36,
                          alignment: Alignment.center,
                          child: Text(
                            '$_quantity',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: kPrimary,
                            ),
                          ),
                        ),
                        _qtyBtn(Icons.add, () {
                          if (_quantity < _maxStock) {
                            setState(() => _quantity++);
                          } else {
                            F2HToast.error(context, 'Only $_maxStock unit(s) available in stock');
                          }
                        }),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Purchase Mode Tiles
              Row(
                children: [
                  Expanded(
                    child: _modeTile(
                      title: 'Buy Once',
                      subtitle: 'Single delivery',
                      selected: !_isSubscription,
                      icon: Icons.shopping_bag_outlined,
                      enabled: widget.product.isOneTime,
                      onTap: () => setState(() => _isSubscription = false),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _modeTile(
                      title: 'Subscribe',
                      subtitle: 'Daily freshness',
                      selected: _isSubscription,
                      icon: Icons.autorenew_rounded,
                      enabled: widget.product.isSubscribable,
                      onTap: () => setState(() => _isSubscription = true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              if (_isSubscription) ...[
                // Delivery Frequency
                const Text(
                  'Delivery Frequency',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _freqBtn('Daily', 'daily'),
                    const SizedBox(width: 8),
                    _freqBtn('Alternate', 'alternate'),
                    const SizedBox(width: 8),
                    _freqBtn('Custom', 'weekly'),
                  ],
                ),
                const SizedBox(height: 16),

                if (_scheduleType == 'weekly') ...[
                  const Text(
                    'Select Custom Days',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: kTextSub,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _daysOfWeek.map((day) {
                      final isSelected = _selectedDays.contains(day.$2);
                      return ChoiceChip(
                        showCheckmark: false,
                        label: Text(day.$1),
                        selected: isSelected,
                        selectedColor: kPrimary,
                        backgroundColor: kSurface,
                        disabledColor: kBgDeep,
                        side: BorderSide(
                          color: isSelected ? kPrimary : kBorder,
                          width: 1,
                        ),
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : kTextMid,
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedDays.add(day.$2);
                            } else {
                              if (_selectedDays.length > 1) {
                                _selectedDays.remove(day.$2);
                              }
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
              ],

              // Delivery Slot
              const Text(
                'Delivery Slot',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _deliverySlot,
                dropdownColor: kSurface,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: kPrimary),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  fillColor: kSurface,
                  filled: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: kBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: kBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: kPrimary, width: 1.5),
                  ),
                ),
                items: _slots
                    .map((s) => DropdownMenuItem(
                          value: s,
                          child: Text(
                            s,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: kText,
                            ),
                          ),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _deliverySlot = val);
                },
              ),
              const SizedBox(height: 20),

              // Delivery Date Selector
              if (_isSubscription) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: kBgDeep,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Start Date',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                      GestureDetector(
                        onTap: () async {
                          final picked = await showCustomDatePicker(
                            context: context,
                            initialDate: _startDate,
                            firstDate: DateTime.now().add(const Duration(days: 1)),
                            lastDate: DateTime.now().add(const Duration(days: 30)),
                            title: 'Start Date',
                          );
                          if (picked != null) {
                            setState(() => _startDate = picked);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: kBorder, width: 1),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today_rounded, size: 14, color: kPrimary),
                              const SizedBox(width: 6),
                              Text(
                                '${_startDate.day}/${_startDate.month}/${_startDate.year}',
                                style: const TextStyle(
                                  color: kPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Action CTA Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    if (_isSubscription && !widget.product.isSubscribable) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Subscription is not available for this item'),
                          backgroundColor: Colors.red,
                        ),
                      );
                      return;
                    }
                    if (!_isSubscription && !widget.product.isOneTime) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('One-time order is not available for this item'),
                          backgroundColor: Colors.red,
                        ),
                      );
                      return;
                    }

                    final dateStr =
                        '${_startDate.year}-${_startDate.month.toString().padLeft(2, '0')}-${_startDate.day.toString().padLeft(2, '0')}';
                    final cleanSlot =
                        _deliverySlot.startsWith('Morning') ? 'Morning' : 'Evening';

                    if (_isSubscription) {
                      final profile =
                          context.read<CustomerSessionCubit>().state.profile;
                      if (profile == null || profile.customerId.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Customer profile is still loading. Please try again.'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }
                      context.read<SubscriptionBloc>().add(CreateSubscriptionRequested(
                            customerId: profile.customerId,
                            branchId: profile.branchId,
                            variantId: widget.product.id,
                            morningQty: cleanSlot == 'Evening' ? 0 : _quantity,
                            eveningQty: cleanSlot == 'Evening' ? _quantity : 0,
                            scheduleType: _scheduleType,
                            deliverySlot: cleanSlot,
                            startDate: dateStr,
                            unitPrice: widget.product.price,
                            customDays: _scheduleType == 'weekly' ? _selectedDays : [],
                            paymentType: 'prepaid',
                            autoRenew: true,
                          ));
                    } else {
                      context.read<SubscriptionBloc>().add(PlaceOneTimeOrderRequested(
                            variantId: widget.product.id,
                            quantity: _quantity,
                            unitPrice: widget.product.price,
                            deliverySlot: cleanSlot,
                            scheduledDate: dateStr,
                          ));
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    elevation: 2,
                    shadowColor: kPrimary.withOpacity(0.3),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                  child: Text(
                    _isSubscription ? 'Subscribe Now' : 'Confirm Order',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
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

  Widget _qtyBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withOpacity(0.1),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Icon(icon, color: kPrimary, size: 16),
        ),
      );

  Widget _modeTile({
    required String title,
    required String subtitle,
    required bool selected,
    required IconData icon,
    bool enabled = true,
    required VoidCallback onTap,
  }) =>
      GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: !enabled
                ? kBgDeep
                : (selected ? kPrimaryPl : kSurface),
            border: Border.all(
              color: selected ? kPrimary : kBorder,
              width: selected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: kPrimary.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon,
                color: !enabled
                    ? kMuted.withOpacity(0.5)
                    : (selected ? kPrimary : kTextSub),
                size: 24,
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: !enabled ? kMuted : (selected ? kPrimary : kText),
                    ),
                  ),
                  if (selected && title == 'Subscribe')
                    const SizedBox.shrink(),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                enabled ? subtitle : 'Unavailable',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: selected ? kPrimary.withOpacity(0.8) : kTextSub,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _freqBtn(String text, String type) {
    final selected = _scheduleType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _scheduleType = type),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? kPrimary : kSurface,
            border: Border.all(
              color: selected ? kPrimary : kBorder,
              width: 1,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: kPrimary.withOpacity(0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              color: selected ? Colors.white : kTextMid,
            ),
          ),
        ),
      ),
    );
  }
}
