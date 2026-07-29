import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/vehicle_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/status_banner.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/image_upload_field.dart';

class VehicleInfoScreen extends StatefulWidget {
  const VehicleInfoScreen({super.key});

  @override
  State<VehicleInfoScreen> createState() => _VehicleInfoScreenState();
}

class _VehicleInfoScreenState extends State<VehicleInfoScreen> {
  void _openVehicleForm(BuildContext context, {VehicleModel? vehicle}) {
    final formKey = GlobalKey<FormState>();
    final registrationController = TextEditingController(text: vehicle?.registrationNumber ?? '');
    final brandController = TextEditingController(text: vehicle?.brand ?? '');
    final modelController = TextEditingController(text: vehicle?.model ?? '');
    final colorController = TextEditingController(text: vehicle?.color ?? '');
    final rcController = TextEditingController(text: vehicle?.rcNumber ?? '');
    final insuranceController = TextEditingController(text: vehicle?.insuranceNumber ?? '');
    final insuranceExpiryController = TextEditingController(text: vehicle?.insuranceExpiry?.split('T')[0] ?? '');

    String selectedType = vehicle?.vehicleType ?? 'bike';
    bool isPrimary = vehicle?.isPrimary ?? true;
    File? rcFrontFile;
    File? rcBackFile;
    File? insuranceFile;

    final vehicleTypes = ['bike', 'scooter', 'cycle', 'electric_bike', 'other'];

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
                          vehicle == null ? 'Register Vehicle details' : 'Update Vehicle details',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kPrimary),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(dialogContext),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),

                  // Vehicle Type
                  const Text('Vehicle Type', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: selectedType,
                    onChanged: (val) {
                      if (val != null) setModalState(() => selectedType = val);
                    },
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kBorder)),
                    ),
                    items: vehicleTypes.map((t) => DropdownMenuItem(
                      value: t,
                      child: Text(t.toUpperCase().replaceAll('_', ' '), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    )).toList(),
                  ),
                  const SizedBox(height: 12),

                  EditableField(
                    label: 'Registration Number',
                    controller: registrationController,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Enter registration number' : null,
                    placeholder: 'e.g. KA-03-HA-1234',
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: EditableField(
                          label: 'Brand',
                          controller: brandController,
                          placeholder: 'e.g. Honda',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: EditableField(
                          label: 'Model',
                          controller: modelController,
                          placeholder: 'e.g. Activa',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: EditableField(
                          label: 'Color',
                          controller: colorController,
                          placeholder: 'e.g. Black',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: EditableField(
                          label: 'RC Number',
                          controller: rcController,
                          placeholder: 'RC Card Number',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: EditableField(
                          label: 'Insurance Number',
                          controller: insuranceController,
                          placeholder: 'Policy ID Number',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: EditableField(
                          label: 'Insurance Expiry',
                          controller: insuranceExpiryController,
                          placeholder: 'YYYY-MM-DD',
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now().add(const Duration(days: 30)),
                              firstDate: DateTime.now(),
                              lastDate: DateTime(2050),
                            );
                            if (date != null) {
                              setModalState(() {
                                insuranceExpiryController.text = date.toIso8601String().split('T')[0];
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  SwitchListTile(
                    title: const Text('Mark as Primary Vehicle', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    value: isPrimary,
                    activeThumbColor: kPrimary,
                    onChanged: (val) {
                      setModalState(() => isPrimary = val);
                    },
                  ),
                  const SizedBox(height: 16),

                  Row(
                    children: [
                      Expanded(
                        child: ImageUploadField(
                          label: 'RC Front Copy',
                          initialImageUrl: vehicle?.rcFrontImage,
                          selectedFile: rcFrontFile,
                          onImageSelected: (file) {
                            setModalState(() {
                              rcFrontFile = file;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ImageUploadField(
                          label: 'RC Back Copy',
                          initialImageUrl: vehicle?.rcBackImage,
                          selectedFile: rcBackFile,
                          onImageSelected: (file) {
                            setModalState(() {
                              rcBackFile = file;
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ImageUploadField(
                          label: 'Insurance Document',
                          initialImageUrl: vehicle?.insuranceImage,
                          selectedFile: insuranceFile,
                          onImageSelected: (file) {
                            setModalState(() {
                              insuranceFile = file;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(child: SizedBox()),
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
                            'vehicle_type': selectedType,
                            'registration_number': registrationController.text.trim().toUpperCase(),
                            'brand': brandController.text.trim(),
                            'model': modelController.text.trim(),
                            'color': colorController.text.trim(),
                            'rc_number': rcController.text.trim(),
                            'insurance_number': insuranceController.text.trim(),
                            'insurance_expiry': insuranceExpiryController.text.trim().isEmpty ? null : insuranceExpiryController.text.trim(),
                            'is_primary': isPrimary,
                          };

                          if (vehicle == null) {
                            dialogContext.read<ProfileBloc>().add(
                              AddVehicleEvent(data, rcFrontFile: rcFrontFile, rcBackFile: rcBackFile, insuranceFile: insuranceFile),
                            );
                          } else {
                            dialogContext.read<ProfileBloc>().add(
                              UpdateVehicleEvent(vehicle.id.toString(), data, rcFrontFile: rcFrontFile, rcBackFile: rcBackFile, insuranceFile: insuranceFile),
                            );
                          }
                          Navigator.pop(dialogContext);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Submit Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
          title: const Text('Rider Vehicle Details', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Failed to load vehicle details'));
            }

            final vehicles = state.vehicles;
            String overallStatus = 'verified';
            for (var v in vehicles) {
              if (v.verificationStatus == 'rejected') overallStatus = 'rejected';
              if (v.verificationStatus == 'pending' && overallStatus != 'rejected') overallStatus = 'pending';
            }

            return RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(FetchVehiclesEvent());
              },
              color: kPrimary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (vehicles.isNotEmpty)
                    StatusBanner(
                      status: overallStatus,
                    ),
                  if (vehicles.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: kBorder),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.motorcycle_rounded, size: 60, color: kMuted),
                          SizedBox(height: 12),
                          Text(
                            'No Registered Vehicles Found',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: kText),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Please configure a vehicle profile to proceed with deliveries.',
                            style: TextStyle(color: kTextSub, fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...vehicles.map((v) => VehicleCard(
                          vehicle: v,
                          onTap: () => _openVehicleForm(context, vehicle: v),
                          onDelete: () {
                            context.read<ProfileBloc>().add(DeleteVehicleEvent(v.id.toString()));
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
                label: const Text('Add Vehicle details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => _openVehicleForm(context),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
