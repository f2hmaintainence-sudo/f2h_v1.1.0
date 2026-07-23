import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/document_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/status_banner.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/image_upload_field.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  void _openDocumentForm(BuildContext context, {DocumentModel? document}) {
    final formKey = GlobalKey<FormState>();
    final numberController = TextEditingController(text: document?.documentNumber ?? '');
    final issueController = TextEditingController(text: document?.issueDate?.split('T')[0] ?? '');
    final expiryController = TextEditingController(text: document?.expiryDate?.split('T')[0] ?? '');
    
    String selectedType = document?.documentType ?? 'aadhaar';
    File? frontFile;
    File? backFile;

    final documentTypes = ['aadhaar', 'pan', 'driving_license', 'police_verification', 'other'];

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
                          document == null ? 'Upload Document Proof' : 'Update Document',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kPrimary),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(dialogContext),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),
                  
                  // Doc Type Dropdown
                  const Text('Document Type', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: selectedType,
                    onChanged: document == null
                        ? (val) {
                            if (val != null) setModalState(() => selectedType = val);
                          }
                        : null,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kBorder)),
                    ),
                    items: documentTypes.map((t) => DropdownMenuItem(
                      value: t,
                      child: Text(t.toUpperCase().replaceAll('_', ' '), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    )).toList(),
                  ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'Document ID Number',
                    controller: numberController,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Enter document number' : null,
                    placeholder: 'e.g. 1234 5678 9012',
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: EditableField(
                          label: 'Issue Date',
                          controller: issueController,
                          placeholder: 'YYYY-MM-DD',
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime(2000),
                              lastDate: DateTime.now(),
                            );
                            if (date != null) {
                              setModalState(() {
                                issueController.text = date.toIso8601String().split('T')[0];
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: EditableField(
                          label: 'Expiry Date (If applicable)',
                          controller: expiryController,
                          placeholder: 'YYYY-MM-DD',
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now().add(const Duration(days: 365)),
                              firstDate: DateTime.now(),
                              lastDate: DateTime(2050),
                            );
                            if (date != null) {
                              setModalState(() {
                                expiryController.text = date.toIso8601String().split('T')[0];
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  Row(
                    children: [
                      Expanded(
                        child: ImageUploadField(
                          label: 'Front Image',
                          initialImageUrl: document?.frontImage,
                          selectedFile: frontFile,
                          onImageSelected: (file) {
                            setModalState(() {
                              frontFile = file;
                            });
                          },
                        ),
                      ),
                      if (selectedType != 'pan' && selectedType != 'police_verification') ...[
                        const SizedBox(width: 12),
                        Expanded(
                          child: ImageUploadField(
                            label: 'Back Image',
                            initialImageUrl: document?.backImage,
                            selectedFile: backFile,
                            onImageSelected: (file) {
                              setModalState(() {
                                backFile = file;
                              });
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        if (formKey.currentState!.validate()) {
                          final data = {
                            'document_type': selectedType,
                            'document_number': numberController.text.trim(),
                            'issue_date': issueController.text.trim().isEmpty ? null : issueController.text.trim(),
                            'expiry_date': expiryController.text.trim().isEmpty ? null : expiryController.text.trim(),
                          };

                          if (document == null) {
                            dialogContext.read<ProfileBloc>().add(
                              AddDocumentEvent(data, frontFile: frontFile, backFile: backFile),
                            );
                          } else {
                            dialogContext.read<ProfileBloc>().add(
                              UpdateDocumentEvent(document.id.toString(), data, frontFile: frontFile, backFile: backFile),
                            );
                          }
                          Navigator.pop(dialogContext);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Submit Verification Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
        appBar: AppBar(
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Verify Identification Docs', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Failed to load documents list'));
            }

            final documents = state.documents;
            String overallStatus = 'verified';
            for (var d in documents) {
              if (d.verificationStatus == 'rejected') overallStatus = 'rejected';
              if (d.verificationStatus == 'pending' && overallStatus != 'rejected') overallStatus = 'pending';
            }

            return RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(FetchDocumentsEvent());
              },
              color: kPrimary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (documents.isNotEmpty)
                    StatusBanner(
                      status: overallStatus,
                    ),
                  if (documents.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: kBorder),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.assignment_ind_rounded, size: 60, color: kMuted),
                          SizedBox(height: 12),
                          Text(
                            'No Verification Proofs Found',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: kText),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Please upload identification documents (Aadhaar, PAN, DL) to verify your rider account.',
                            style: TextStyle(color: kTextSub, fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...documents.map((doc) => DocumentCard(
                          document: doc,
                          onTap: () => _openDocumentForm(context, document: doc),
                          onDelete: () {
                            context.read<ProfileBloc>().add(DeleteDocumentEvent(doc.id.toString()));
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
                label: const Text('Add Document Proof', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => _openDocumentForm(context),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
