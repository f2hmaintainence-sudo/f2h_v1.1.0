import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/pickup_required_dialog.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';

class ContainerItemState {
  final String containerId;
  final String name;

  /// Containers in current order being delivered today (editable by partner/customer)
  int deliveringToday;
  final int initialDeliveringToday;

  /// Containers customer currently holds from previous orders (editable by partner/customer)
  int customerBalance;
  final int initialCustomerBalance;

  /// Empty container collection at delivery time
  bool isCollecting;
  int returned;
  int damaged;
  int lost;

  ContainerItemState({
    required this.containerId,
    required this.name,
    required this.deliveringToday,
    required this.customerBalance,
    int? initialDeliveringToday,
    int? initialCustomerBalance,
    this.isCollecting = false,
    this.returned = 0,
    this.damaged = 0,
    this.lost = 0,
  })  : initialDeliveringToday = initialDeliveringToday ?? deliveringToday,
        initialCustomerBalance = initialCustomerBalance ?? customerBalance;

  /// Maximum empties collectable = what customer currently holds with them
  int get maxCollectable => customerBalance.clamp(0, 999);

  /// Net balance remaining with customer after delivery & returns
  int get projectedBalance => customerBalance + deliveringToday - returned - damaged - lost;
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
    List<Map<String, dynamic>>? containerDeliveries,
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
  int _currentStep = 1; // 1: Arrived, 2: Handover & Pay, 3: Containers, 4: Photo, 5: Success

  bool _directHandover = true;
  bool _photoTaken = false;
  bool _isUpi = true;
  bool _paymentConfirmed = false;
  String? _imagePath;
  Uint8List? _imageBytes;
  Map<String, dynamic>? _paymentQrData;
  bool _isLoadingQr = false;

  final Map<String, ContainerItemState> _containerStates = {};

  @override
  void initState() {
    super.initState();
    if (widget.stop.isCod && widget.stop.codAmount > 0) {
      _fetchPaymentQr();
    }

    // Populate container items from stop containerBalances
    for (var bal in widget.stop.containerBalances) {
      final isGlass = bal.name.toLowerCase().contains('bottle') ||
          bal.containerId == 'PKG_GLASS_BOTTLE' ||
          bal.containerId == 'CONT-001';
      final exp = bal.expected > 0
          ? bal.expected
          : (isGlass ? widget.stop.emptyBottlesExpected : 0);
      final withCust = bal.balance > 0
          ? bal.balance
          : (isGlass ? widget.stop.bottlesWithCustomer : 0);

      _containerStates[bal.containerId] = ContainerItemState(
        containerId: bal.containerId,
        name: bal.name.isNotEmpty ? bal.name : 'Glass Bottle',
        deliveringToday: exp,
        customerBalance: withCust,
        isCollecting: withCust > 0,
        returned: withCust > 0 ? withCust : 0,
      );
    }

    // Support fallback default Glass Bottle if containerBalances is empty but stop has bottles
    if (_containerStates.isEmpty) {
      final exp = widget.stop.emptyBottlesExpected;
      final outstanding = widget.stop.bottlesWithCustomer;
      if (exp > 0 || outstanding > 0) {
        _containerStates['CONT-001'] = ContainerItemState(
          containerId: 'CONT-001',
          name: 'Glass Bottle',
          deliveringToday: exp > 0 ? exp : 1,
          customerBalance: outstanding,
          isCollecting: outstanding > 0,
          returned: outstanding > 0 ? outstanding : 0,
        );
      }
    }

    _checkLostImage();
  }

  Future<void> _fetchPaymentQr() async {
    if (widget.stop.runId == null || widget.stop.addressId.isEmpty) return;
    setState(() => _isLoadingQr = true);
    try {
      final qr = await sl<OrdersRepository>().getPaymentQr(
        runId: widget.stop.runId!,
        addressId: widget.stop.addressId,
      );
      if (mounted && qr != null) {
        setState(() {
          _paymentQrData = qr;
          _isLoadingQr = false;
        });
      } else {
        if (mounted) setState(() => _isLoadingQr = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingQr = false);
    }
  }

  Future<void> _checkLostImage() async {
    try {
      final ImagePicker picker = ImagePicker();
      final LostDataResponse response = await picker.retrieveLostData();
      if (response.isEmpty) return;
      if (response.file != null) {
        final bytes = await response.file!.readAsBytes();
        if (!mounted) return;
        setState(() {
          _imagePath = response.file!.path;
          _imageBytes = bytes;
          _photoTaken = true;
          if (_currentStep >= 4) {
            _currentStep = 4;
          }
        });
      }
    } catch (_) {}
  }

  void _nextStep() {
    if (_currentStep < 5) {
      setState(() {
        _currentStep++;
      });
      if (_currentStep == 5) {
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
        final bytes = await photo.readAsBytes();
        if (!mounted) return;
        setState(() {
          _imagePath = photo.path;
          _imageBytes = bytes;
          _photoTaken = true;
        });
      }
    } catch (e) {
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
    String finalPaymentMode = widget.stop.isCod ? (_isUpi ? 'upi' : 'cash') : 'prepaid';
    String finalPaymentStatus = 'paid';
    String mockPhotoPath = _photoTaken
        ? (_imagePath ?? 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop')
        : '';

    int totalReturned = 0;
    int totalDamaged = 0;
    int totalLost = 0;

    final List<Map<String, dynamic>> containerReturns = [];
    final List<Map<String, dynamic>> containerDeliveries = [];

    for (var entry in _containerStates.entries) {
      final s = entry.value;
      totalReturned += s.returned;
      totalDamaged += s.damaged;
      totalLost += s.lost;

      containerReturns.add({
        'container_id': s.containerId,
        'name': s.name,
        'returned': s.returned,
        'damaged': s.damaged,
        'lost': s.lost,
        'customer_balance': s.customerBalance,
        'projected_balance': s.projectedBalance,
      });

      containerDeliveries.add({
        'container_id': s.containerId,
        'name': s.name,
        'quantity': s.deliveringToday,
        'delivered': s.deliveringToday,
      });
    }

    final totalEmptyBottles = totalReturned + totalDamaged + totalLost;

    // Immediately trigger status update with container returns and container deliveries
    widget.onConfirm(
      'delivered',
      totalEmptyBottles,
      totalReturned,
      totalDamaged,
      totalLost,
      '$handoverDetails · $paymentDetails',
      finalPaymentMode,
      finalPaymentStatus,
      mockPhotoPath,
      containerReturns,
      containerDeliveries,
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
            if (_currentStep < 5) _buildStepperProgress(),
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
    final stepLabels = ['Arrived', 'Handover & Pay', 'Containers', 'Proof Photo'];
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        // Background Connecting Lines
        Positioned(
          top: 17,
          left: 28,
          right: 28,
          child: Row(
            children: List.generate(stepLabels.length - 1, (index) {
              final isPassed = _currentStep > (index + 1);
              return Expanded(
                child: Container(
                  height: 3,
                  color: isPassed ? kPrimary : kBorder,
                ),
              );
            }),
          ),
        ),

        // Step Indicators and Labels
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(stepLabels.length, (index) {
            final stepNum = index + 1;
            final isActive = _currentStep == stepNum;
            final isCompleted = _currentStep > stepNum;

            return GestureDetector(
              onTap: () {
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
                      boxShadow: isActive
                          ? [
                              BoxShadow(
                                color: kPrimary.withValues(alpha: 0.25),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              )
                            ]
                          : null,
                    ),
                    child: Center(
                      child: isCompleted
                          ? const Icon(Icons.check_rounded, color: kPrimary, size: 18)
                          : stepNum > _currentStep
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
                  const SizedBox(height: 6),
                  Text(
                    stepLabels[index],
                    style: TextStyle(
                      fontSize: 10,
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
        return _buildStepHandoverAndPayment();
      case 3:
        return _buildStepContainerManagement();
      case 4:
        return _buildStepPhoto();
      case 5:
        return _buildStepSuccess();
      default:
        return const SizedBox();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: ARRIVED AT LOCATION
  // ══════════════════════════════════════════════════════════════════════════
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
        const SizedBox(height: 6),
        Text(
          'Confirm that you are at ${widget.stop.customerName}\'s delivery location.',
          style: const TextStyle(fontSize: 12.5, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),

        // Customer Info Card
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
                    const SizedBox(height: 3),
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
                'ARRIVED AT LOCATION →',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: HANDOVER & PAYMENT
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildStepHandoverAndPayment() {
    return Column(
      key: const ValueKey('step_handover_payment'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 2: Handover & Payment',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        const Text(
          'Select delivery handover mode and confirm payment.',
          style: TextStyle(fontSize: 12, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),

        // Handover Mode Selector
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

        // Payment Details Card
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
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: kBorder),
                          ),
                          padding: const EdgeInsets.all(8),
                          child: _isLoadingQr
                              ? const Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(kPrimary)),
                                  ),
                                )
                              : _ScannerAnimationWrapper(
                                  child: Image.network(
                                    _paymentQrData?['qr_image_url'] as String? ??
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
                        if (_paymentQrData?['provider'] == 'razorpay') ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                            ),
                            child: const Text(
                              '⚡ Dynamic UPI Gateway QR',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8)),
                            ),
                          ),
                        ],
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
                  'PROCEED TO CONTAINERS (STEP 3) →',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: CONTAINER MANAGEMENT & COLLECTION (AFTER STEP TWO)
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildStepContainerManagement() {
    final hasContainers = _containerStates.isNotEmpty;

    return Column(
      key: const ValueKey('step_container_management'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 3: Container Management',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        const Text(
          'Review delivered containers, update customer holding count & collect empties.',
          style: TextStyle(fontSize: 12, color: kTextSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),

        if (!hasContainers) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              children: [
                const Icon(Icons.inventory_2_outlined, color: kMuted, size: 36),
                const SizedBox(height: 12),
                const Text(
                  'No Returnable Containers',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: kText),
                ),
                const SizedBox(height: 6),
                const Text(
                  'This order does not include returnable containers, and the customer has no active container balance.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: kTextSub, height: 1.3),
                ),
              ],
            ),
          ),
        ] else ...[
          ..._containerStates.values.map((state) {
            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorder),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x06000000),
                    blurRadius: 8,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Container Header
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(19)),
                      border: Border(bottom: BorderSide(color: kBorderLt)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: kPrimaryPl,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.inventory_2_rounded, color: kPrimary, size: 18),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                state.name,
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: kText),
                              ),
                              Text(
                                'ID: ${state.containerId}',
                                style: const TextStyle(fontSize: 10, color: kTextSub),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Text(
                            'Delivering: ${state.deliveringToday}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.teal),
                          ),
                        ),
                      ],
                    ),
                  ),

                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── SECTION A: Current Order Container Quantity (Editable) ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Current Order Containers',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kText),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Delivering today (modify if adjusted)',
                                  style: TextStyle(fontSize: 10.5, color: kTextSub),
                                ),
                              ],
                            ),
                            _buildMiniStepper(
                              value: state.deliveringToday,
                              color: kPrimary,
                              onDec: state.deliveringToday > 0
                                  ? () => setState(() => state.deliveringToday--)
                                  : null,
                              onInc: () => setState(() => state.deliveringToday++),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Divider(height: 1, color: kBorderLt),
                        const SizedBox(height: 14),

                        // ── SECTION B: Customer Held Balance (Editable) ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Customer Held Containers',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kText),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Containers currently held with customer',
                                  style: TextStyle(fontSize: 10.5, color: kTextSub),
                                ),
                              ],
                            ),
                            _buildMiniStepper(
                              value: state.customerBalance,
                              color: Colors.orange.shade800,
                              onDec: state.customerBalance > 0
                                  ? () => setState(() {
                                        state.customerBalance--;
                                        if (state.returned > (state.customerBalance - state.damaged - state.lost)) {
                                          state.returned = (state.customerBalance - state.damaged - state.lost).clamp(0, 999);
                                        }
                                      })
                                  : null,
                              onInc: () => setState(() {
                                    state.customerBalance++;
                                    state.returned = (state.customerBalance - state.damaged - state.lost).clamp(0, 999);
                                  }),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // ── SECTION C: Container Returns & Collection ──
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.swap_vertical_circle_rounded, color: Colors.teal, size: 18),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Collect Empties Today',
                                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.teal),
                                      ),
                                    ],
                                  ),
                                  // Quick Presets
                                  Row(
                                    children: [
                                      GestureDetector(
                                        onTap: () {
                                          setState(() {
                                            state.returned = state.customerBalance;
                                            state.damaged = 0;
                                            state.lost = 0;
                                          });
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: Colors.teal.shade300),
                                          ),
                                          child: const Text(
                                            'Collect All',
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.teal),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      GestureDetector(
                                        onTap: () {
                                          setState(() {
                                            state.returned = 0;
                                            state.damaged = 0;
                                            state.lost = 0;
                                          });
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: kBorder),
                                          ),
                                          child: const Text(
                                            'None',
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kTextSub),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),

                              // Counters Row
                              Row(
                                children: [
                                  // Returned Stepper
                                  Expanded(
                                    child: _buildCompactCounter(
                                      label: 'Returned / Collected',
                                      value: state.returned,
                                      color: Colors.teal,
                                      onDec: state.returned > 0
                                          ? () => setState(() => state.returned--)
                                          : null,
                                      onInc: (state.returned + state.damaged + state.lost) < state.customerBalance
                                          ? () => setState(() => state.returned++)
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  // Damaged/Lost Stepper
                                  Expanded(
                                    child: _buildCompactCounter(
                                      label: 'Damaged / Lost',
                                      value: state.damaged + state.lost,
                                      color: Colors.red.shade700,
                                      onDec: (state.damaged + state.lost) > 0
                                          ? () => setState(() {
                                                if (state.lost > 0) {
                                                  state.lost--;
                                                } else if (state.damaged > 0) {
                                                  state.damaged--;
                                                }
                                              })
                                          : null,
                                      onInc: (state.returned + state.damaged + state.lost) < state.customerBalance
                                          ? () => setState(() => state.lost++)
                                          : null,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // ── SECTION D: Dynamic Balance Preview Card ──
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: kBgDeep,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kBorder),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Net Balance with Customer:',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kTextSub),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '(${state.customerBalance} held + ${state.deliveringToday} deliv - ${state.returned} ret - ${state.damaged + state.lost} lost)',
                                    style: const TextStyle(fontSize: 9.5, color: kMuted),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: state.projectedBalance <= 0
                                      ? const Color(0xFFECFDF5)
                                      : const Color(0xFFFFF1F2),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: state.projectedBalance <= 0
                                        ? const Color(0xFF6EE7B7)
                                        : const Color(0xFFFECDD3),
                                  ),
                                ),
                                child: Text(
                                  state.projectedBalance <= 0
                                      ? '0 Cleared ✓'
                                      : '${state.projectedBalance} with Customer',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: state.projectedBalance <= 0 ? Colors.teal : kDanger,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],

        const SizedBox(height: 16),

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
            Expanded(
              child: ElevatedButton(
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
                    Text(
                      'CONFIRM CONTAINERS (PROCEED) →',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: PROOF PHOTO
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildStepPhoto() {
    return Column(
      key: const ValueKey('step_photo'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 4: Delivery Proof Photo',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
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
                  'Delivering: ' + widget.stop.products.map((p) => '${p.quantity}x ${p.productName}').join(', '),
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
                    if (_imageBytes != null)
                      Image.memory(
                        _imageBytes!,
                        fit: BoxFit.cover,
                        gaplessPlayback: true,
                      )
                    else
                      Image.network(
                        'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop',
                        fit: BoxFit.cover,
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
              onPressed: () => setState(() => _currentStep = 3),
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
                    _imageBytes = null;
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
                  _photoTaken ? 'COMPLETE DELIVERY' : 'TAKE PHOTO',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: SUCCESS ANIMATION
  // ══════════════════════════════════════════════════════════════════════════
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
          'Automatically updating and routing...',
          style: TextStyle(fontSize: 11, color: kPrimary, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 30),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER WIDGETS
  // ══════════════════════════════════════════════════════════════════════════
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

  Widget _buildMiniStepper({
    required int value,
    required Color color,
    required VoidCallback? onDec,
    required VoidCallback? onInc,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: kBgDeep,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: onDec,
            child: Container(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.remove_rounded, size: 18, color: onDec != null ? color : kMuted),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              '$value',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: color),
            ),
          ),
          GestureDetector(
            onTap: onInc,
            child: Container(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.add_rounded, size: 18, color: onInc != null ? color : kMuted),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactCounter({
    required String label,
    required int value,
    required Color color,
    required VoidCallback? onDec,
    required VoidCallback? onInc,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      decoration: BoxDecoration(
        color: value > 0 ? color.withValues(alpha: 0.08) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: value > 0 ? color.withValues(alpha: 0.4) : kBorder),
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
          const SizedBox(height: 6),
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
                padding: const EdgeInsets.symmetric(horizontal: 8),
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

  Widget _buildItemsSection({bool showReturnsInfo = true}) {
    final outstanding = widget.stop.bottlesWithCustomer;
    final hasReturnable = outstanding > 0 || widget.stop.emptyBottlesExpected > 0;

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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF0FDF4),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(19)),
                border: Border(top: BorderSide(color: Color(0xFFBBF7D0))),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.swap_vertical_circle_rounded, color: Colors.teal, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'Container Management Active',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.teal.shade800),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Configured in Step 3',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.teal.shade700),
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
              top: 124 * value,
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

    void drawPositioningMarker(double x, double y, double s) {
      canvas.drawRect(Rect.fromLTWH(x, y, s, s), paint);
      canvas.drawRect(Rect.fromLTWH(x + s / 7, y + s / 7, s * 5 / 7, s * 5 / 7), Paint()..color = Colors.white);
      canvas.drawRect(Rect.fromLTWH(x + s * 2 / 7, y + s * 2 / 7, s * 3 / 7, s * 3 / 7), paint);
    }

    final mSize = size.width * 0.28;
    drawPositioningMarker(0, 0, mSize);
    drawPositioningMarker(size.width - mSize, 0, mSize);
    drawPositioningMarker(0, size.height - mSize, mSize);

    final cellSize = size.width / 15;
    for (int r = 0; r < 15; r++) {
      for (int c = 0; c < 15; c++) {
        if ((r < 5 && c < 5) || (r < 5 && c >= 10) || (r >= 10 && c < 5)) {
          continue;
        }
        final val = (r * 7 + c * 13 + (r + c) * 3) % 5 == 0 || (r * c + r + c) % 3 == 0;
        if (val) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize, cellSize),
            paint,
          );
        }
      }
    }

    final logoSize = size.width * 0.22;
    final logoRect = Rect.fromLTWH(
      (size.width - logoSize) / 2,
      (size.height - logoSize) / 2,
      logoSize,
      logoSize,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(logoRect, const Radius.circular(4)),
      Paint()..color = const Color(0xFF1B5E20),
    );

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
