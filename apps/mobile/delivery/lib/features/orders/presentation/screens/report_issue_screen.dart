import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class ReportIssueScreen extends StatefulWidget {
  final DeliveryOrderModel? order;

  const ReportIssueScreen({super.key, this.order});

  @override
  State<ReportIssueScreen> createState() => _ReportIssueScreenState();
}

class _ReportIssueScreenState extends State<ReportIssueScreen> {
  final TextEditingController _remarksController = TextEditingController();
  
  String? _selectedIssue;
  bool _isSubmitting = false;

  List<Map<String, dynamic>> get _quickIssues => widget.order != null ? [
    {
      'label': 'Customer Not Available',
      'icon': Icons.person_off_rounded,
      'defaultDesc': 'Tried calling customer multiple times, door locked, customer not available.',
      'color': Colors.red,
    },
    {
      'label': 'Wrong Address',
      'icon': Icons.wrong_location_rounded,
      'defaultDesc': 'Customer address details are incorrect or customer relocated.',
      'color': Colors.orange,
    },
    {
      'label': 'Damaged Product',
      'icon': Icons.broken_image_rounded,
      'defaultDesc': 'Product damaged during transit (leakage/spillage). Need replacement.',
      'color': Colors.amber,
    },
    {
      'label': 'Location Not Found',
      'icon': Icons.explore_off_rounded,
      'defaultDesc': 'Unable to find customer location on route map, phone unreachable.',
      'color': Colors.blue,
    },
    {
      'label': 'Traffic Delay',
      'icon': Icons.traffic_rounded,
      'defaultDesc': 'Severe traffic jam or vehicle breakdown leading to delays.',
      'color': Colors.indigo,
    },
    {
      'label': 'Bottle Issue',
      'icon': Icons.opacity_rounded,
      'defaultDesc': 'Mismatch in bottle return counts or damaged/lost return bottles.',
      'color': Colors.teal,
    },
  ] : [
    {
      'label': 'KYC Verification',
      'icon': Icons.verified_user_rounded,
      'defaultDesc': 'My document proofs are uploaded but KYC verification is still pending. Need activation.',
      'color': Colors.blue,
    },
    {
      'label': 'Account Status',
      'icon': Icons.lock_rounded,
      'defaultDesc': 'My account is showing inactive. Please check and activate my account.',
      'color': Colors.orange,
    },
    {
      'label': 'Document Re-upload',
      'icon': Icons.upload_file_rounded,
      'defaultDesc': 'I need assistance in re-uploading documents or editing my profile info.',
      'color': Colors.teal,
    },
    {
      'label': 'App Error / Bug',
      'icon': Icons.bug_report_rounded,
      'defaultDesc': 'I am facing a technical bug/error in the application.',
      'color': Colors.red,
    },
  ];

  @override
  void dispose() {
    _remarksController.dispose();
    super.dispose();
  }

  void _selectIssue(Map<String, dynamic> issue) {
    setState(() {
      _selectedIssue = issue['label'];
      _remarksController.text = issue['defaultDesc'];
    });
  }

  Future<void> _submitReport() async {
    if (_selectedIssue == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please select an issue first!'),
          backgroundColor: kDanger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      if (widget.order != null) {
        // Failed order issue report — route through BLoC so state stays consistent
        context.read<DeliverySessionBloc>().add(UpdateStopStatusEvent(
          orderId: widget.order!.orderId,
          newStatus: 'failed',
          notes: '$_selectedIssue: ${_remarksController.text}',
        ));
      } else {
        // Onboarding/Verification dashboard issue report — direct API call
        final String category = _selectedIssue!.toLowerCase().replaceAll(' / ', '_').replaceAll(' ', '_');
        final String priority = (category.contains('kyc') || category.contains('account')) ? 'high' : 'medium';
        final dioClient = sl<DioClient>();
        await dioClient.dio.post(
          ApiEndpoints.supportTickets,
          data: {
            'category': category,
            'subject': _selectedIssue!,
            'description': _remarksController.text,
            'priority': priority,
          },
        );
      }

      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Issue reported successfully: $_selectedIssue'),
          backgroundColor: widget.order != null ? kDanger : kSuccess,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );

      // Return to previous screen
      Navigator.pop(context);
      if (widget.order != null) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit report: $e'),
          backgroundColor: kDanger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(title: 'Report Issue'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.order != null) ...[
              Text(
                'Stop #${widget.order!.stop} · ${widget.order!.customerName}',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kTextSub),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 8),
            const Text(
              'What issue did you encounter?',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: kText),
            ),
            const SizedBox(height: 16),

            // Grid layout of 5 Quick Issue Buttons
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.45,
              ),
              itemCount: _quickIssues.length,
              itemBuilder: (ctx, idx) {
                final issue = _quickIssues[idx];
                final isSelected = _selectedIssue == issue['label'];
                final itemColor = issue['color'] as Color;

                return GestureDetector(
                  onTap: () => _selectIssue(issue),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      color: isSelected ? itemColor.withValues(alpha: 0.08) : kSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? itemColor : kBorder,
                        width: isSelected ? 2 : 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: kText.withValues(alpha: 0.01),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isSelected ? itemColor.withValues(alpha: 0.12) : kBgDeep,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            issue['icon'] as IconData,
                            color: isSelected ? itemColor : kTextSub,
                            size: 20,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          issue['label'] as String,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 12.5,
                            color: isSelected ? itemColor : kText,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Description Input Field
            if (_selectedIssue != null) ...[
              const Text(
                'ADDITIONAL REMARKS',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.5),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _remarksController,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: 'Describe details of the issue...',
                  hintStyle: const TextStyle(color: kMuted, fontSize: 13),
                  fillColor: kSurface,
                  filled: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: kBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: kDanger, width: 1.5),
                  ),
                ),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: _selectedIssue == null
          ? null
          : Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSurface,
                border: const Border(top: BorderSide(color: kBorderLt)),
              ),
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitReport,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kDanger,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _isSubmitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text(
                        'SUBMIT ISSUE REPORT',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5),
                      ),
              ),
            ),
    );
  }
}
