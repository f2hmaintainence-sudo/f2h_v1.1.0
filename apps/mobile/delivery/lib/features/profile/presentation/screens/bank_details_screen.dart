import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/bank_account_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/status_banner.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/image_upload_field.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class BankDetailsScreen extends StatefulWidget {
  const BankDetailsScreen({super.key});

  @override
  State<BankDetailsScreen> createState() => _BankDetailsScreenState();
}

class _BankDetailsScreenState extends State<BankDetailsScreen> {
  void _openBankForm(BuildContext context, {BankAccountModel? account}) {
    final formKey = GlobalKey<FormState>();
    final holderController = TextEditingController(text: account?.accountHolderName ?? '');
    final bankNameController = TextEditingController(text: account?.bankName ?? '');
    final numberController = TextEditingController(text: account?.accountNumber ?? '');
    final ifscController = TextEditingController(text: account?.ifscCode ?? '');
    final branchController = TextEditingController(text: account?.branchName ?? '');
    final upiController = TextEditingController(text: account?.upiId ?? '');

    bool isPrimary = account?.isPrimary ?? true;
    File? chequeFile;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (modalContext) => BlocProvider.value(
        value: BlocProvider.of<ProfileBloc>(context),
        child: StatefulBuilder(
          builder: (dialogContext, setModalState) => Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(dialogContext).viewInsets.bottom + 16),
            child: SingleChildScrollView(
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          account == null ? 'Configure Bank Account' : 'Update Bank Account',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kPrimary),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(dialogContext),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'Account Holder Name',
                    controller: holderController,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'Enter account holder name';
                      if (val.trim().length < 2) return 'Holder name must be at least 2 characters';
                      return null;
                    },
                    placeholder: 'Holder Name (As in Bank)',
                  ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'Bank Name',
                    controller: bankNameController,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'Enter bank name';
                      if (val.trim().length < 2) return 'Bank name must be at least 2 characters';
                      return null;
                    },
                    placeholder: 'e.g. State Bank of India',
                  ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'Account Number',
                    controller: numberController,
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'Enter account number';
                      final clean = val.replaceAll(RegExp(r'\s+'), '');
                      if (!RegExp(r'^\d{9,18}$').hasMatch(clean)) {
                        return 'Account number must be between 9 and 18 digits';
                      }
                      return null;
                    },
                    keyboardType: TextInputType.number,
                    placeholder: 'Payout Bank Account Number',
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: EditableField(
                          label: 'IFSC Code',
                          controller: ifscController,
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Enter IFSC code';
                            final clean = val.replaceAll(RegExp(r'\s+'), '').toUpperCase();
                            if (!RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(clean)) {
                              return 'Enter valid 11-character IFSC (e.g. SBIN0001234)';
                            }
                            return null;
                          },
                          placeholder: 'e.g. SBIN0001234',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: EditableField(
                          label: 'Branch Name',
                          controller: branchController,
                          placeholder: 'e.g. Koramangala',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'UPI ID (Optional)',
                    controller: upiController,
                    placeholder: 'e.g. rider@ybl',
                    validator: (val) {
                      if (val != null && val.trim().isNotEmpty) {
                        if (!RegExp(r'^[\w.\-_]+@[\w]+$').hasMatch(val.trim())) {
                          return 'Enter valid UPI ID (e.g. name@bank)';
                        }
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  SwitchListTile(
                    title: const Text('Mark as Primary Payout Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    value: isPrimary,
                    activeThumbColor: kPrimary,
                    onChanged: (val) {
                      setModalState(() => isPrimary = val);
                    },
                  ),
                  const SizedBox(height: 16),

                  ImageUploadField(
                    label: 'Cancelled Cheque / Passbook Image',
                    initialImageUrl: account?.cancelledChequeImage,
                    selectedFile: chequeFile,
                    onImageSelected: (file) {
                      setModalState(() {
                        chequeFile = file;
                      });
                    },
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (formKey.currentState!.validate()) {
                          final data = {
                            'account_holder_name': holderController.text.trim(),
                            'bank_name': bankNameController.text.trim(),
                            'account_number': numberController.text.trim(),
                            'ifsc_code': ifscController.text.trim().toUpperCase(),
                            'branch_name': branchController.text.trim(),
                            'upi_id': upiController.text.trim(),
                            'is_primary': isPrimary,
                          };

                          if (account == null) {
                            dialogContext.read<ProfileBloc>().add(
                              AddBankAccountEvent(data, chequeFile: chequeFile),
                            );
                          } else {
                            dialogContext.read<ProfileBloc>().add(
                              UpdateBankAccountEvent(account.id.toString(), data, chequeFile: chequeFile),
                            );
                          }
                          Navigator.pop(dialogContext);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Save Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

  @override
  Widget build(BuildContext context) {
    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded && state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.successMessage!), backgroundColor: kSuccess),
          );
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: F2hAppBar(title: 'Configure Bank Payouts'),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Failed to load bank accounts'));
            }

            final accounts = state.bankAccounts;
            String overallStatus = 'verified';
            for (var a in accounts) {
              if (a.verificationStatus == 'rejected') overallStatus = 'rejected';
              if (a.verificationStatus == 'pending' && overallStatus != 'rejected') overallStatus = 'pending';
            }

            return RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(FetchBankAccountsEvent());
              },
              color: kPrimary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (accounts.isNotEmpty)
                    StatusBanner(
                      status: overallStatus,
                    ),
                  if (accounts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: kBorder),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.account_balance_rounded, size: 60, color: kMuted),
                          SizedBox(height: 12),
                          Text(
                            'No Configured Payout Accounts',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: kText),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Please configure a primary bank account to receive driver payout settlements.',
                            style: TextStyle(color: kTextSub, fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...accounts.map((acc) => BankAccountCard(
                          account: acc,
                          onTap: () => _openBankForm(context, account: acc),
                          onDelete: () {
                            context.read<ProfileBloc>().add(DeleteBankAccountEvent(acc.id.toString()));
                          },
                        )),
                ],
              ),
            );
          },
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.add_rounded, color: Colors.white),
                label: const Text('Add Bank account', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => _openBankForm(context),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
