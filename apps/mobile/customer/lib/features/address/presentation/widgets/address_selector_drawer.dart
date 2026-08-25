import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/features/address/presentation/screens/add_address_screen.dart';

class AddressSelectorDrawer extends StatefulWidget {
  const AddressSelectorDrawer({super.key});
  

  static Future<AddressModel?> show(BuildContext context) {
    return showModalBottomSheet<AddressModel?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const AddressSelectorDrawer(),
    );
  }

  @override
  State<AddressSelectorDrawer> createState() => _AddressSelectorDrawerState();
}

class _AddressSelectorDrawerState extends State<AddressSelectorDrawer> {
  static const Color _panelBorder = Color(0xFF9BB2AA);
  String? _expandedAddressId;
  String? _selectedAddressId;
  bool _isUpdating = false;

  void _openAddAddress(BuildContext context, {AddressModel? existing}) {
    final authState = context.read<AuthBloc>().state;
    final sessionState = context.read<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;
    if (!isLoggedIn) {
      F2HToast.error(context, 'Please log in to manage addresses.');
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => AddAddressScreen(existing: existing)),
    );
  }

  // void _selectAddress(BuildContext context, AddressModel address) {
  //   if (address.isDefault || address.id == null) return;

  //   final payload = address.toJson();
  //   payload['is_default'] = true;

  //   context.read<AddressBloc>().add(
  //         UpdateAddressEvent(address.id!, payload),
  //       );
  // }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        return SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              14,
              0,
              14,
              10 + media.viewInsets.bottom,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: media.size.height * 0.82,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: _panelBorder, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildAddressBlock(),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAddressBlock() {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final list = sessionState.addresses;
        final isEmpty = list.isEmpty;

        if (isEmpty) {
          return Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kPrimary.withValues(alpha: 0.20), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: InkWell(
              onTap: () => _openAddAddress(context),
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: kPrimaryPl,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.location_off_rounded, color: kPrimary, size: 24),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'No Delivery Address Added',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kText),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Tap here to add a new address to continue checkout.',
                            style: TextStyle(fontSize: 11, color: kTextSub),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: kMuted),
                  ],
                ),
              ),
            ),
          );
        }

        // Find primary address
        final primaryAddress = list.firstWhere((a) => a.isDefault, orElse: () => list.first);
        _selectedAddressId ??= primaryAddress.addressId;
        if (!list.any((a) => a.addressId == _selectedAddressId)) {
          _selectedAddressId = primaryAddress.addressId;
        }

        if (_expandedAddressId == null && list.isNotEmpty) {
          _expandedAddressId = primaryAddress.addressId;
        }

        return Container(
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kBorder),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: Text(
                  'Delivery Address',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kText),
                ),
              ),
              const Divider(color: kBorderLt, height: 1),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: list.length,
                separatorBuilder: (_, _) => const Divider(color: kBorderLt, height: 1),
                itemBuilder: (context, index) {
                  final addr = list[index];
                  final isSelected = addr.addressId == _selectedAddressId;
                  final isExpanded = addr.addressId == _expandedAddressId;

                  return Container(
                    color: isSelected ? kPrimaryPl.withValues(alpha: 0.12) : Colors.transparent,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      crossAxisAlignment: isExpanded ? CrossAxisAlignment.start : CrossAxisAlignment.center,
                      children: [
                        // Radio checkmark button
                        GestureDetector(
                          onTap: () => _selectAddress(context, addr),
                          child: Padding(
                            padding: const EdgeInsets.only(right: 12, top: 2),
                            child: Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: isSelected
                                    ? null
                                    : Border.all(color: kMuted, width: 2),
                                color: isSelected ? kPrimary : Colors.transparent,
                              ),
                              child: isSelected
                                  ? (_isUpdating
                                      ? const Padding(
                                          padding: EdgeInsets.all(3),
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                          ),
                                        )
                                      : const Icon(Icons.check, color: Colors.white, size: 12))
                                  : null,
                            ),
                          ),
                        ),
                        
                        // Address Details
                        Expanded(
                          child: GestureDetector(
                            onTap: () => _selectAddress(context, addr),
                            behavior: HitTestBehavior.opaque,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        addr.name,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w900,
                                          color: kText,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: kPrimaryPl,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        addr.addressType.toUpperCase(),
                                        style: const TextStyle(
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w800,
                                          color: kPrimary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                if (isExpanded) ...[
                                  Text(
                                    addr.detail,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: kTextSub,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(Icons.phone_android_rounded, size: 10, color: kTextSub),
                                      const SizedBox(width: 4),
                                      Text(
                                        addr.mobileNumber,
                                        style: const TextStyle(
                                          fontSize: 10.5,
                                          color: kTextSub,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ] else ...[
                                  Text(
                                    addr.detail,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: kTextSub,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),

                        // Actions: Edit and Chevron
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 18, color: kPrimaryMid),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () => _editAddress(context, addr),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  if (isExpanded) {
                                    _expandedAddressId = null;
                                  } else {
                                    _expandedAddressId = addr.addressId;
                                  }
                                });
                              },
                              child: Icon(
                                isExpanded
                                    ? Icons.keyboard_arrow_up_rounded
                                    : Icons.keyboard_arrow_down_rounded,
                                size: 20,
                                color: kTextSub,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
              const Divider(color: kBorderLt, height: 1),
              _buildAddAddressButton(context),
            ],
          ),
        );
      },
    );
  }

    Widget _buildAddAddressButton(BuildContext context) {
    return InkWell(
      onTap: () => _openAddAddress(context),
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(20),
        bottomRight: Radius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.add_circle_outline_rounded, color: kPrimary, size: 16),
            SizedBox(width: 6),
            Text(
              'Add New Address',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: kPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectAddress(BuildContext context, AddressModel addr) async {
    final addrId = addr.addressId;
    if (addrId == null || addrId.isEmpty) {
      Navigator.pop(context, addr);
      return;
    }

    // Tapping the already-selected address dismisses the drawer
    if (addrId == _selectedAddressId && !_isUpdating) {
      Navigator.pop(context, addr);
      return;
    }

    if (_isUpdating) return;

    setState(() {
      _selectedAddressId = addrId;
      _expandedAddressId = addrId;
      _isUpdating = true;
    });

    try {
      await context.read<CustomerSessionCubit>().updateDefaultAddress(addrId);
      if (context.mounted) {
        final labelName = addr.area.isNotEmpty
            ? addr.area
            : (addr.city.isNotEmpty ? addr.city : addr.name);
        F2HToast.success(context, 'Delivery address set to $labelName');
        setState(() => _isUpdating = false);
      }
    } catch (e) {
      if (context.mounted) {
        F2HToast.error(context, 'Failed to update delivery address.');
        setState(() => _isUpdating = false);
      }
    }
  }

  void _editAddress(BuildContext context, AddressModel addr) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AddAddressScreen(existing: addr),
      ),
    );
  }


  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: kPrimaryPl,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.location_off_rounded,
              color: kPrimary,
              size: 38,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'No Addresses Saved',
            style: TextStyle(
              color: kText,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
