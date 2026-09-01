import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/guards/auth_guard.dart';
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
      F2HToast.info(
        context,
        'Please sign in to manage addresses.',
        title: 'Sign In Required',
        actionText: 'Sign In',
        onAction: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const LoginScreen(popOnSuccess: true),
            ),
          );
        },
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
        final serviceableList = list.where((a) => a.isServiceable && a.branchIsActive).toList();

        if (serviceableList.isEmpty) {
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorder),
            ),
            child: InkWell(
              onTap: () async {
                Navigator.of(context).pop();
                final result = await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const AddAddressScreen(),
                  ),
                );
                if (result != null && context.mounted) {
                  await context.read<CustomerSessionCubit>().refreshSilently();
                }
              },
              borderRadius: BorderRadius.circular(16),
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
                      child: const Icon(
                        Icons.add_location_alt_outlined,
                        color: kPrimary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Add Delivery Address',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: kText,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'No serviceable address found. Tap here to add an address.',
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

        // Find primary serviceable address
        final primaryAddress = serviceableList.firstWhere(
          (a) => a.isDefault,
          orElse: () => serviceableList.first,
        );
        _selectedAddressId ??= primaryAddress.uniqueId;
        if (!serviceableList.any((a) => a.uniqueId == _selectedAddressId)) {
          _selectedAddressId = primaryAddress.uniqueId;
        }

        if (_expandedAddressId == null && serviceableList.isNotEmpty) {
          _expandedAddressId = primaryAddress.uniqueId;
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
                itemCount: serviceableList.length,
                separatorBuilder: (_, _) => const Divider(color: kBorderLt, height: 1),
                itemBuilder: (context, index) {
                  final addr = serviceableList[index];
                  final isSelected = addr.uniqueId == _selectedAddressId;
                  final isExpanded = addr.uniqueId == _expandedAddressId;

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
                                    : Border.all(
                                        color: kMuted,
                                        width: 2,
                                      ),
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
    final bool isServiceable = addr.isServiceable && addr.branchIsActive;
    if (!isServiceable) {
      final reason = addr.unserviceableReason ??
          'Delivery is currently unavailable at this address because the local branch is inactive.';
      F2HToast.error(
        context,
        reason,
        title: 'Delivery Unavailable',
      );
      return;
    }

    final targetUniqueId = addr.uniqueId;
    final dbAddressId = (addr.addressId != null && addr.addressId!.isNotEmpty)
        ? addr.addressId!
        : ((addr.id != null && addr.id!.isNotEmpty) ? addr.id! : addr.uniqueId);

    if (_isUpdating) return;

    setState(() {
      _selectedAddressId = targetUniqueId;
      _expandedAddressId = targetUniqueId;
      _isUpdating = true;
    });

    try {
      if (dbAddressId.isNotEmpty) {
        await context.read<CustomerSessionCubit>().updateDefaultAddress(dbAddressId);
      }
      if (context.mounted) {
        final labelName = addr.area.isNotEmpty
            ? addr.area
            : (addr.city.isNotEmpty ? addr.city : addr.name);
        F2HToast.success(context, 'Delivery address set to $labelName');
        Navigator.pop(context, addr);
      }
    } catch (e) {
      if (context.mounted) {
        F2HToast.error(context, 'Failed to update delivery address.');
        setState(() => _isUpdating = false);
      }
    }
  }

  void _editAddress(BuildContext context, AddressModel addr) {
    final authState = context.read<AuthBloc>().state;
    final sessionState = context.read<CustomerSessionCubit>().state;
    final isLoggedIn = authState is Authenticated || sessionState.profile != null;
    if (!isLoggedIn) {
      F2HToast.info(
        context,
        'Please sign in to manage addresses.',
        title: 'Sign In Required',
        actionText: 'Sign In',
        onAction: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const LoginScreen(popOnSuccess: true),
            ),
          );
        },
      );
      return;
    }

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
