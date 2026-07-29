import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';


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
  
  @override
  void initState() {
    super.initState();
    final outstanding = widget.stop.bottlesWithCustomer;
    _returnedContainers = (outstanding + widget.stop.emptyBottlesExpected) > 0
        ? widget.stop.emptyBottlesExpected
        : 0;
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
          _currentStep = 3;
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
              ListTile(
                leading: const Icon(Icons.photo_library_rounded, color: Colors.blue),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  _takePhoto(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _triggerSuccess() {
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
                  color: kMuted.withOpacity(0.3),
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
                if (_currentStep < 4) {
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
                          color: kPrimary.withOpacity(0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        )
                      ] : null,
                    ),
                    child: Center(
                      child: isCompleted
                          ? const Icon(Icons.check_rounded, color: kPrimary, size: 18)
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
        const SizedBox(height: 24),
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

  Widget _buildStepConfirmCustomer() {
    final outstanding = widget.stop.bottlesWithCustomer;
    final displayedOutstanding = outstanding > 0 ? -outstanding : 0;
    int deliveredToday = 0;
    for (var p in widget.stop.products) {
      if (p.productName.toLowerCase().contains('bottle') || p.productName.toLowerCase().contains('milk')) {
        deliveredToday += p.quantity;
      }
    }
    final expectedToday = widget.stop.emptyBottlesExpected;
    final projectedBalance = outstanding + deliveredToday - _returnedContainers - _damagedContainers - _lostContainers;
    final displayedProjected = projectedBalance > 0 ? -projectedBalance : 0;

    return Column(
      key: const ValueKey('step_confirm'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Step 2: Confirm Customer',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        
        // Handover Mode Selector
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
        
        // Empty Bottle Returns Section
        if (outstanding > 0 || expectedToday > 0 || deliveredToday > 0)
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
                const Row(
                  children: [
                    Icon(Icons.opacity_rounded, color: Colors.teal, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'EMPTY BOTTLE RETURNS',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: kTextSub, letterSpacing: 0.5),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // 1. Returned Counter Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Returned Bottles',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kText),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Good condition bottles returned',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline_rounded, color: Colors.teal, size: 26),
                          onPressed: _returnedContainers > 0
                              ? () => setState(() => _returnedContainers--)
                              : null,
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            '$_returnedContainers',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kText),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.teal, size: 26),
                          onPressed: () => setState(() => _returnedContainers++),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // 2. Damaged Counter Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Damaged Bottles',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kText),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Broken or unusable bottles',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline_rounded, color: Colors.orange, size: 26),
                          onPressed: _damagedContainers > 0
                              ? () => setState(() => _damagedContainers--)
                              : null,
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            '$_damagedContainers',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kText),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.orange, size: 26),
                          onPressed: () => setState(() => _damagedContainers++),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // 3. Lost Counter Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Lost Bottles',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kText),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Bottles declared lost by customer',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline_rounded, color: Colors.red, size: 26),
                          onPressed: _lostContainers > 0
                              ? () => setState(() => _lostContainers--)
                              : null,
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            '$_lostContainers',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kText),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.red, size: 26),
                          onPressed: () => setState(() => _lostContainers++),
                        ),
                      ],
                    ),
                  ],
                ),

                const Divider(height: 24, color: kBorderLt),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        children: [
                          const Text(
                            'Outstanding',
                            style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$displayedOutstanding',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                          ),
                        ],
                      ),
                    ),
                    Container(width: 1, height: 25, color: kBorderLt),
                    Expanded(
                      child: Column(
                        children: [
                          const Text(
                            'Delivered',
                            style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '+$deliveredToday',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kPrimary),
                          ),
                        ],
                      ),
                    ),
                    Container(width: 1, height: 25, color: kBorderLt),
                    Expanded(
                      child: Column(
                        children: [
                          const Text(
                            'Projected',
                            style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$displayedProjected',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.teal),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        const SizedBox(height: 16),
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
              const Text(
                'PAYMENT DETAILS',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
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
                  'CONFIRM CUSTOMER & DETAILS',
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
        const SizedBox(height: 20),
        
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
                        Icon(Icons.camera_enhance_rounded, color: kPrimary.withOpacity(0.8), size: 48),
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
                      color: Colors.black.withOpacity(0.2),
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
                  color: Colors.red.withOpacity(0.8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.red.withOpacity(0.4),
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
