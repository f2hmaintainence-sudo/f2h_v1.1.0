import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/pickup_required_dialog.dart';


class ContainerReturnInput {
  final String containerId;
  final String name;
  final int balance;
  final int expected;
  bool isChecked;
  int returned;
  int damaged;
  int lost;

  ContainerReturnInput({
    required this.containerId,
    required this.name,
    required this.balance,
    this.expected = 0,
    this.isChecked = false,
    this.returned = 0,
    this.damaged = 0,
    this.lost = 0,
  });
}

class DeliveryConfirmationSheet extends StatefulWidget {
  final GroupedStop stop;
  final Function(
    String status,
    int emptyBottles,
    int returnedContainers,
    int damagedContainers,
    int lostContainers,
    String notes,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    List<Map<String, dynamic>> containerReturns,
  ) onConfirm;

  const DeliveryConfirmationSheet({
    super.key,
    required this.stop,
    required this.onConfirm,
  });

  @override
  State<DeliveryConfirmationSheet> createState() => _DeliveryConfirmationSheetState();
}

class _DeliveryConfirmationSheetState extends State<DeliveryConfirmationSheet> {
  int _currentStep = 1; // 1 to 4
  int _returnedContainers = 0;
  int _damagedContainers = 0;
  int _lostContainers = 0;
  
  bool _directHandover = true;
  bool _photoTaken = false;
  bool _isUpi = true;
  bool _paymentConfirmed = false;
  String? _imagePath;
  final Map<String, ContainerReturnInput> _containerInputs = {};

  void _syncLegacyCounts() {
    int returned = 0;
    int damaged = 0;
    int lost = 0;
    for (var input in _containerInputs.values) {
      returned += input.returned;
      damaged += input.damaged;
      lost += input.lost;
    }
    _returnedContainers = returned;
    _damagedContainers = damaged;
    _lostContainers = lost;
  }
  
  @override
  void initState() {
    super.initState();
    
    // Populate container inputs from stop containerBalances
    for (var bal in widget.stop.containerBalances) {
      final expected = widget.stop.emptyBottlesExpected;
      final isGlass = bal.name.toLowerCase().contains('bottle') || bal.containerId == 'PKG_GLASS_BOTTLE';
      
      _containerInputs[bal.containerId] = ContainerReturnInput(
        containerId: bal.containerId,
        name: bal.name,
        balance: bal.balance,
        expected: isGlass ? expected : 0,
        isChecked: (isGlass && expected > 0),
        returned: (isGlass && expected > 0) ? expected : 0,
      );
    }
    
    // Also support fallback default Glass Bottle if containerBalances is empty
    if (_containerInputs.isEmpty) {
      final outstanding = widget.stop.bottlesWithCustomer;
      if (outstanding > 0) {
        _containerInputs['PKG_GLASS_BOTTLE'] = ContainerReturnInput(
          containerId: 'PKG_GLASS_BOTTLE',
          name: 'Glass Bottle',
          balance: outstanding,
          expected: outstanding,
          isChecked: true,
          returned: outstanding,
        );
      }
    }

    _syncLegacyCounts();
    _checkLostImage();
  }

  Future<void> _checkLostImage() async {
    try {
      final ImagePicker picker = ImagePicker();
      final LostDataResponse response = await picker.retrieveLostData();
      if (response.isEmpty) return;
      if (response.file != null) {
        setState(() {
          _imagePath = response.file!.path;
          _photoTaken = true;
          // Only restore to step 3 if user had already reached step 3.
          // Do NOT skip steps 1→2 by jumping to 3 from the start.
          if (_currentStep >= 3) {
            _currentStep = 3;
          }
        });
      }
    } catch (_) {}
  }

  void _nextStep() {
    if (_currentStep < 4) {
      setState(() {
        _currentStep++;
      });
      if (_currentStep == 4) {
        _triggerSuccess();
      }
    }
  }

  Future<void> _takePhoto([ImageSource source = ImageSource.camera]) async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? photo = await picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 70,
      );
      if (photo != null) {
        setState(() {
          _imagePath = photo.path;
          _photoTaken = true;
        });
      }
    } catch (e) {
      print('Error picking image: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not access photo: $e. You can use SKIP PHOTO to complete delivery.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showImageSourcePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Upload Proof Photo',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded, color: kPrimary),
                title: const Text('Take Photo with Camera'),
                onTap: () {
                  Navigator.pop(ctx);
                  _takePhoto(ImageSource.camera);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _triggerSuccess() {
    final sessionState = context.read<DeliverySessionBloc>().state is DeliverySessionLoaded
        ? context.read<DeliverySessionBloc>().state as DeliverySessionLoaded
        : null;
    if (sessionState != null && !sessionState.isPickupConfirmed) {
      if (mounted && Navigator.canPop(context)) {
        Navigator.pop(context);
      }
      showPickupRequiredDialog(
        context,
        orders: sessionState.orders,
        groupedStops: sessionState.groupedStops,
        currentRun: sessionState.currentRun,
      );
      return;
    }

    String paymentDetails = widget.stop.isCod
        ? 'Collected via ${_isUpi ? "UPI" : "Cash"}'
        : 'Prepaid Online';
    String handoverDetails = _directHandover ? 'Handed over directly' : 'Left with security/doorstep';
    String finalPaymentMode = widget.stop.isCod
        ? (_isUpi ? 'upi' : 'cash')
        : 'prepaid';
    String finalPaymentStatus = 'paid';
    String mockPhotoPath = _photoTaken
        ? (_imagePath ?? 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop')
        : '';

    final totalEmptyBottles = _returnedContainers + _damagedContainers + _lostContainers;

    final List<Map<String, dynamic>> containerReturns = _containerInputs.entries.map((e) {
      final input = e.value;
      return {
        'container_id': input.containerId,
        'returned': input.returned,
        'damaged': input.damaged,
        'lost': input.lost,
      };
    }).toList();

    // Immediately trigger status update so data is submitted right away
    widget.onConfirm(
      'delivered',
      totalEmptyBottles,
      _returnedContainers,
      _damagedContainers,
      _lostContainers,
      '$handoverDetails · $paymentDetails',
      finalPaymentMode,
      finalPaymentStatus,
      mockPhotoPath,
      containerReturns,
    );

    // Show success animation briefly then pop sheet safely
    Timer(const Duration(milliseconds: 1500), () {
      if (mounted && Navigator.canPop(context)) {
        Navigator.pop(context);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: kBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: kMuted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Stepper Header
            if (_currentStep < 4) _buildStepperProgress(),
            const SizedBox(height: 20),
  
            // Step Content
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _buildStepContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepperProgress() {
    final stepLabels = ['Arrived', 'Confirm Details', 'Proof Photo'];
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        // Background Connecting Lines
        Positioned(
          top: 17, // Center height of 34px circles
          left: 40,
          right: 40,
          child: Row(
            children: [
              Expanded(
                child: Container(
                  height: 3,
                  color: _currentStep > 1 ? kPrimary : kBorder,
                ),
              ),
              Expanded(
                child: Container(
                  height: 3,
                  color: _currentStep > 2 ? kPrimary : kBorder,
                ),
              ),
            ],
          ),
        ),
        
        // Step Indicators and Labels
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(3, (index) {
            final stepNum = index + 1;
            final isActive = _currentStep == stepNum;
            final isCompleted = _currentStep > stepNum;
            
            return GestureDetector(
              onTap: () {
                // Only allow going BACK to already-completed steps.
                // Forward skipping (e.g. 1→3) is NOT allowed.
                if (stepNum < _currentStep) {
                  setState(() {
                    _currentStep = stepNum;
                  });
                }
              },
              behavior: HitTestBehavior.opaque,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: isCompleted
                          ? kPrimaryPl
                          : (isActive ? kPrimary : kSurface),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isCompleted || isActive ? kPrimary : kBorder,
                        width: 2,
                      ),
                      boxShadow: isActive ? [
                        BoxShadow(
                          color: kPrimary.withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        )
                      ] : null,
                    ),
                    child: Center(
                      child: isCompleted
                          ? const Icon(Icons.check_rounded, color: kPrimary, size: 18)
                          : stepNum > _currentStep
                              // Future step: show lock icon to signal it's not tappable
                              ? Icon(Icons.lock_outline_rounded, color: kMuted, size: 14)
                              : Text(
                                  '$stepNum',
                                  style: TextStyle(
                                    color: isActive ? Colors.white : kTextSub,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13,
                                  ),
                                ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    stepLabels[index],
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: isActive || isCompleted ? FontWeight.w900 : FontWeight.w700,
                      color: isActive || isCompleted ? kPrimary : kTextSub,
                      letterSpacing: 0.1,
                    ),
                  ),
                ],
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 1:
        return _buildStepArrived();
      case 2:
        return _buildStepConfirmCustomer();
      case 3:
        return _buildStepPhoto();
      case 4:
        return _buildStepSuccess();
      default:
        return const SizedBox();
    }
  }

  Widget _buildStepArrived() {
    return Column(
      key: const ValueKey('step_arrived'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 1: Arrived at Location',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Confirm that you are at ${widget.stop.customerName}\'s delivery location.',
          style: const TextStyle(fontSize: 13, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: kPrimaryPl,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.location_on_rounded, color: kPrimary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.stop.customerName,
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: kText),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.stop.address,
                      style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildItemsSection(showReturnsInfo: true),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: _nextStep,
          style: ElevatedButton.styleFrom(
            backgroundColor: kPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 2,
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle_outline_rounded, size: 20),
              SizedBox(width: 8),
              Text(
                'ARRIVED AT LOCATION',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Compact section label with icon used across Step 2 sections
  Widget _buildSectionHeader(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 15, color: kTextSub),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: kTextSub,
            letterSpacing: 0.8,
          ),
        ),
      ],
    );
  }

  /// Compact stepper widget: label on top, [−] value [+] in a pill card
  Widget _buildCompactCounter({
    required String label,
    required int value,
    required Color color,
    required VoidCallback? onDec,
    required VoidCallback? onInc,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: value > 0 ? color.withAlpha(20) : kBgDeep,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: value > 0 ? color.withAlpha(80) : kBorder),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: value > 0 ? color : kTextSub,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              GestureDetector(
                onTap: onDec,
                child: Icon(
                  Icons.remove_circle_rounded,
                  size: 20,
                  color: onDec != null ? color : kMuted,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Text(
                  '$value',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: value > 0 ? color : kText,
                  ),
                ),
              ),
              GestureDetector(
                onTap: onInc,
                child: Icon(
                  Icons.add_circle_rounded,
                  size: 20,
                  color: onInc != null ? color : kMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepConfirmCustomer() {
    return Column(
      key: const ValueKey('step_confirm'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 2: Confirm & Collect',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        const Text(
          'Collect containers, confirm handover & payment.',
          style: TextStyle(fontSize: 12, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),

        // ── Handover Mode Selector ──────────────────────────────────────────
        _buildSectionHeader(Icons.swap_horiz_rounded, 'HANDOVER MODE'),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _directHandover = true),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                    decoration: BoxDecoration(
                      color: _directHandover ? kPrimaryPl : kSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _directHandover ? kPrimary : kBorder,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_pin_rounded, color: _directHandover ? kPrimary : kTextSub, size: 28),
                        const SizedBox(height: 8),
                        Text(
                          'Direct Handover',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            color: _directHandover ? kPrimary : kText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _directHandover = false),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                    decoration: BoxDecoration(
                      color: !_directHandover ? kPrimaryPl : kSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: !_directHandover ? kPrimary : kBorder,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.door_sliding_rounded, color: !_directHandover ? kPrimary : kTextSub, size: 28),
                        const SizedBox(height: 8),
                        Text(
                          'Doorstep / Security',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            color: !_directHandover ? kPrimary : kText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Container / Bottle Returns ──────────────────────────────────────
        if (_containerInputs.isNotEmpty) ...[
          _buildSectionHeader(Icons.swap_vert_circle_outlined, 'EMPTY CONTAINER RETURNS'),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              children: [
                // Summary row at the top
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    children: [
                      const Icon(Icons.inventory_2_outlined, size: 16, color: Colors.teal),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          '${_containerInputs.values.where((i) => i.isChecked).length} of ${_containerInputs.length} container type(s) being returned',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kTextSub),
                        ),
                      ),
                      if (_containerInputs.values.any((i) => i.isChecked))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFF6EE7B7)),
                          ),
                          child: Text(
                            '${_containerInputs.values.fold(0, (s, i) => s + i.returned)} returned',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.teal),
                          ),
                        ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: kBorderLt),

                // One row per container type
                ..._containerInputs.values.map((input) {
                  final outstanding = input.balance;
                  final maxAllowed = outstanding > input.expected ? outstanding : input.expected;
                  final projected = outstanding - input.returned - input.damaged - input.lost;

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Row 1: checkbox + name + balance badge
                            Row(
                              children: [
                                SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: Checkbox(
                                    value: input.isChecked,
                                    activeColor: kPrimary,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    onChanged: (val) {
                                      setState(() {
                                        input.isChecked = val ?? false;
                                        if (input.isChecked) {
                                          input.returned = input.expected > 0
                                              ? input.expected
                                              : (outstanding > 0 ? outstanding : 0);
                                          input.damaged = 0;
                                          input.lost = 0;
                                        } else {
                                          input.returned = 0;
                                          input.damaged = 0;
                                          input.lost = 0;
                                        }
                                        _syncLegacyCounts();
                                      });
                                    },
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    input.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 13,
                                      color: input.isChecked ? kText : kTextSub,
                                    ),
                                  ),
                                ),
                                // Balance badge
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: outstanding > 0 ? const Color(0xFFFFF7ED) : kBgDeep,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: outstanding > 0 ? const Color(0xFFFED7AA) : kBorder,
                                    ),
                                  ),
                                  child: Text(
                                    outstanding > 0 ? 'Balance: $outstanding' : 'None due',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: outstanding > 0 ? Colors.orange.shade700 : kMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            // Row 2 (when checked): Returned, Damaged, Lost counters
                            if (input.isChecked) ...[
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  // Returned counter
                                  Expanded(
                                    child: _buildCompactCounter(
                                      label: 'Returned',
                                      value: input.returned,
                                      color: Colors.teal,
                                      onDec: input.returned > 0
                                          ? () => setState(() { input.returned--; _syncLegacyCounts(); })
                                          : null,
                                      onInc: (input.returned + input.lost) < maxAllowed
                                          ? () => setState(() { input.returned++; _syncLegacyCounts(); })
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // Lost / Damaged counter
                                  Expanded(
                                    child: _buildCompactCounter(
                                      label: 'Lost/Damaged',
                                      value: input.lost,
                                      color: Colors.red,
                                      onDec: input.lost > 0
                                          ? () => setState(() { input.lost--; _syncLegacyCounts(); })
                                          : null,
                                      onInc: (input.returned + input.lost) < maxAllowed
                                          ? () => setState(() { input.lost++; _syncLegacyCounts(); })
                                          : null,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              // Projected balance chip
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  const Icon(Icons.account_balance_wallet_outlined, size: 12, color: kTextSub),
                                  const SizedBox(width: 4),
                                  Text(
                                    'After return: ',
                                    style: const TextStyle(fontSize: 10, color: kTextSub),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: projected <= 0
                                          ? const Color(0xFFECFDF5)
                                          : const Color(0xFFFFF1F2),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      projected <= 0 ? 'Cleared ✓' : '$projected remaining',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        color: projected <= 0 ? Colors.teal : kDanger,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: kBorderLt),
                    ],
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Payment Details ─────────────────────────────────────────────────
        _buildSectionHeader(Icons.payments_outlined, 'PAYMENT'),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!widget.stop.isCod || widget.stop.codAmount == 0)
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(color: Color(0xFFF0FDF4), shape: BoxShape.circle),
                      child: const Icon(Icons.check_circle_rounded, color: kSuccess, size: 16),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Prepaid Online (No Cash/UPI to Collect)',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kText),
                    ),
                  ],
                )
              else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Collect Payment:',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kText),
                    ),
                    Text(
                      '₹${widget.stop.codAmount.round()}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kDanger),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _isUpi = true;
                          _paymentConfirmed = false;
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _isUpi ? kPrimaryPl : kBgDeep,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: _isUpi ? kPrimary : kBorder),
                          ),
                          child: Center(
                            child: Text(
                              'UPI / QR Code',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: _isUpi ? kPrimary : kText,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _isUpi = false;
                          _paymentConfirmed = false;
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: !_isUpi ? kPrimaryPl : kBgDeep,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: !_isUpi ? kPrimary : kBorder),
                          ),
                          child: Center(
                            child: Text(
                              'Cash',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: !_isUpi ? kPrimary : kText,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                if (_isUpi) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: kBgDeep,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: kBorder),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          'Scan to Pay via UPI',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kText),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Collect ₹${widget.stop.codAmount.round()}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: kPrimary),
                        ),
                        const SizedBox(height: 12),
                        // Dynamic UPI QR Code Image
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: kBorder),
                          ),
                          padding: const EdgeInsets.all(8),
                          child: _ScannerAnimationWrapper(
                            child: Image.network(
                              'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${Uri.encodeComponent('upi://pay?pa=f2hfresh@ybl&pn=F2H Fresh&am=${widget.stop.codAmount.round()}&cu=INR&tn=Order_${widget.stop.orders.isNotEmpty ? widget.stop.orders.first.orderId : ""}')}',
                              fit: BoxFit.contain,
                              loadingBuilder: (context, child, loadingProgress) {
                                if (loadingProgress == null) return child;
                                return const Center(
                                  child: SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
                                    ),
                                  ),
                                );
                              },
                              errorBuilder: (context, error, stackTrace) {
                                return CustomPaint(
                                  painter: _QrCodePainter(),
                                );
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.qr_code_scanner_rounded, size: 14, color: kTextSub),
                            SizedBox(width: 4),
                            Text(
                              'Supports Google Pay, PhonePe, Paytm, etc.',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: kTextSub),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    value: _paymentConfirmed,
                    onChanged: (val) => setState(() => _paymentConfirmed = val ?? false),
                    title: Text(
                      'Confirm customer has paid ₹${widget.stop.codAmount.round()} successfully via UPI',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                    ),
                    activeColor: kPrimary,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                ] else ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.payments_rounded, color: kSuccess, size: 36),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'COLLECT CASH PAYMENT',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: kSuccess, letterSpacing: 0.5),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Amount to collect: ₹${widget.stop.codAmount.round()}',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    value: _paymentConfirmed,
                    onChanged: (val) => setState(() => _paymentConfirmed = val ?? false),
                    title: Text(
                      'I confirm that ₹${widget.stop.codAmount.round()} cash has been collected from the customer',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                    ),
                    activeColor: kPrimary,
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                ],
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            ElevatedButton(
              onPressed: () => setState(() => _currentStep = 1),
              style: ElevatedButton.styleFrom(
                backgroundColor: kBgDeep,
                foregroundColor: kTextSub,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: (!widget.stop.isCod || widget.stop.codAmount == 0 || _paymentConfirmed) ? _nextStep : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: (!widget.stop.isCod || widget.stop.codAmount == 0 || _paymentConfirmed) ? kPrimary : kMuted,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text(
                  'DONE — TAKE PROOF PHOTO →',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStepPhoto() {
    return Column(
      key: const ValueKey('step_photo'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 3: Delivery Proof Photo',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        const Text(
          'Upload photo of items placed at location for delivery validation.',
          style: TextStyle(fontSize: 12, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: kPrimaryPl,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: kPrimary.withOpacity(0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: kPrimary, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Take a photo of: ' + widget.stop.products.map((p) => '${p.quantity}x ${p.productName}').join(', '),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: kPrimary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        
        // Camera Viewfinder
        GestureDetector(
          onTap: _showImageSourcePicker,
          child: Container(
            height: 180,
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _photoTaken ? kPrimary : kBorder, width: 2),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (!_photoTaken) ...[
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_enhance_rounded, color: kPrimary.withValues(alpha: 0.8), size: 48),
                        const SizedBox(height: 12),
                        const Text(
                          'Tap to Take Delivery Photo',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kText),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Opens device camera',
                          style: TextStyle(fontSize: 11, color: kTextSub),
                        ),
                      ],
                    ),
                  ] else ...[
                    // Captured photo or fallback simulated photo
                    if (_imagePath != null)
                      Image.file(
                        File(_imagePath!),
                        fit: BoxFit.cover,
                      )
                    else
                      Image.network(
                        'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => Container(
                          color: kPrimaryPl,
                          child: const Center(
                            child: Icon(Icons.check_circle_outline_rounded, color: kPrimary, size: 64),
                          ),
                        ),
                      ),
                    Container(
                      color: Colors.black.withValues(alpha: 0.2),
                    ),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: kPrimary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_rounded, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text(
                              'CAPTURED',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 9),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            ElevatedButton(
              onPressed: () => setState(() => _currentStep = 2),
              style: ElevatedButton.styleFrom(
                backgroundColor: kBgDeep,
                foregroundColor: kTextSub,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 12),
            if (_photoTaken)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _photoTaken = false;
                    _imagePath = null;
                  }),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: kBorder),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('RETAKE', style: TextStyle(fontWeight: FontWeight.w900, color: kTextSub)),
                ),
              )
            else
              Expanded(
                child: OutlinedButton(
                  onPressed: _nextStep,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: kBorder),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('SKIP PHOTO', style: TextStyle(fontWeight: FontWeight.w900, color: kTextSub)),
                ),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _photoTaken ? _nextStep : _showImageSourcePicker,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: Text(
                  _photoTaken ? 'CONFIRM & NEXT' : 'TAKE PHOTO',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStepSuccess() {
    return Column(
      key: const ValueKey('step_success'),
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        Center(
          child: Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: kPrimaryPl,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: kPrimary,
              size: 64,
            ),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Delivery Success!',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Order for ${widget.stop.customerName} marked as delivered.',
          style: const TextStyle(fontSize: 13, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        const Text(
          'Automatically routing to the next delivery...',
          style: TextStyle(fontSize: 11, color: kPrimary, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildItemsSection({bool showReturnsInfo = true}) {
    final outstanding = widget.stop.bottlesWithCustomer;
    final hasReturnable = outstanding > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.shopping_bag_rounded, color: kPrimary, size: 18),
                const SizedBox(width: 8),
                Text(
                  'ITEMS TO DELIVER (${widget.stop.products.length})',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                    color: kTextSub,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          // Deliver Items List
          ...widget.stop.products.map((item) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: kBorderLt)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      item.productName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: kText,
                      ),
                    ),
                  ),
                  Text(
                    '${item.quantity} ${item.unit}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      color: kPrimary,
                    ),
                  ),
                ],
              ),
            );
          }),

          // Returns Info Section if applicable
          if (showReturnsInfo && hasReturnable) ...[
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: kBorder, width: 1)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.swap_horizontal_circle_rounded, color: Colors.teal, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'CONTAINER RETURNS',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 11,
                      color: Colors.teal.shade700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Empty Bottles to Collect',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: kText,
                    ),
                  ),
                  Text(
                    '$outstanding bottle${outstanding == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      color: Colors.teal,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ScannerAnimationWrapper extends StatefulWidget {
  final Widget child;
  const _ScannerAnimationWrapper({required this.child});
  @override
  State<_ScannerAnimationWrapper> createState() => _ScannerAnimationWrapperState();
}

class _ScannerAnimationWrapperState extends State<_ScannerAnimationWrapper> {
  double _targetValue = 1.0;
  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: _targetValue),
      duration: const Duration(milliseconds: 1500),
      onEnd: () {
        setState(() {
          _targetValue = _targetValue == 1.0 ? 0.0 : 1.0;
        });
      },
      builder: (context, value, child) {
        return Stack(
          children: [
            widget.child,
            Positioned(
              top: 124 * value, // Adjusted top boundary for QR box inside container
              left: 0,
              right: 0,
              child: Container(
                height: 2,
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.red.withValues(alpha: 0.4),
                      blurRadius: 4,
                      spreadRadius: 1,
                    )
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _QrCodePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    // Draw the 3 QR Code positioning markers (square boxes with inner squares)
    void drawPositioningMarker(double x, double y, double s) {
      // Outer square
      canvas.drawRect(Rect.fromLTWH(x, y, s, s), paint);
      // Inner white square
      canvas.drawRect(Rect.fromLTWH(x + s / 7, y + s / 7, s * 5 / 7, s * 5 / 7), Paint()..color = Colors.white);
      // Center black square
      canvas.drawRect(Rect.fromLTWH(x + s * 2 / 7, y + s * 2 / 7, s * 3 / 7, s * 3 / 7), paint);
    }

    final mSize = size.width * 0.28; // Marker size (28% of size)
    
    // Top-left marker
    drawPositioningMarker(0, 0, mSize);
    // Top-right marker
    drawPositioningMarker(size.width - mSize, 0, mSize);
    // Bottom-left marker
    drawPositioningMarker(0, size.height - mSize, mSize);

    // Draw random-looking QR grid blocks
    final cellSize = size.width / 15;
    for (int r = 0; r < 15; r++) {
      for (int c = 0; c < 15; c++) {
        // Skip positioning markers areas
        if ((r < 5 && c < 5) || (r < 5 && c >= 10) || (r >= 10 && c < 5)) {
          continue;
        }
        // Deterministic pseudo-random pattern based on coordinates
        final val = (r * 7 + c * 13 + (r + c) * 3) % 5 == 0 || (r * c + r + c) % 3 == 0;
        if (val) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize, cellSize),
            paint,
          );
        }
      }
    }

    // Draw a small center block for UPI logo placeholder
    final logoSize = size.width * 0.22;
    final logoRect = Rect.fromLTWH(
      (size.width - logoSize) / 2,
      (size.height - logoSize) / 2,
      logoSize,
      logoSize,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(logoRect, const Radius.circular(4)),
      Paint()..color = const Color(0xFF1B5E20), // Forest green background
    );
    
    // Draw a small white plus/icon inside the logo placeholder
    canvas.drawRect(
      Rect.fromLTWH(size.width / 2 - 2, size.height / 2 - 6, 4, 12),
      Paint()..color = Colors.white,
    );
    canvas.drawRect(
      Rect.fromLTWH(size.width / 2 - 6, size.height / 2 - 2, 12, 4),
      Paint()..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
