import 'package:flutter/material.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';

class ContainersTrackerModal extends StatefulWidget {
  final List<GroupedStop> groupedStops;
  final DeliveryRun? currentRun;

  const ContainersTrackerModal({
    super.key,
    required this.groupedStops,
    this.currentRun,
  });

  static void show(
    BuildContext context,
    List<GroupedStop> groupedStops, {
    DeliveryRun? currentRun,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => ContainersTrackerModal(
          groupedStops: groupedStops,
          currentRun: currentRun,
        ),
      ),
    );
  }

  @override
  State<ContainersTrackerModal> createState() => _ContainersTrackerModalState();
}

class _ContainersTrackerModalState extends State<ContainersTrackerModal> {
  bool _isLoading = true;
  int _totalCollected = 0;
  int _totalSubmitted = 0;
  int _totalDamaged = 0;
  int _totalRemaining = 0;
  List<Map<String, dynamic>> _containerBreakdown = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchContainerStatus();
  }

  int _parseNum(dynamic val) {
    if (val == null) return 0;
    if (val is num) return val.toInt();
    if (val is String) return double.tryParse(val)?.toInt() ?? 0;
    return 0;
  }

  Future<void> _fetchContainerStatus() async {
    try {
      final dioClient = sl<DioClient>();
      final runIdParam = widget.currentRun?.runId;
      final response = await dioClient.dio.get(
        ApiEndpoints.containerSummary,
        queryParameters: runIdParam != null && runIdParam.isNotEmpty ? {'run_id': runIdParam} : null,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = Map<String, dynamic>.from(response.data as Map);
        final rawBreakdown = (data['container_breakdown'] as List<dynamic>? ?? []);
        final List<Map<String, dynamic>> parsedList = [];

        for (final item in rawBreakdown) {
          parsedList.add(Map<String, dynamic>.from(item as Map));
        }

        if (mounted) {
          setState(() {
            _totalCollected = _parseNum(data['total_collected']);
            _totalSubmitted = _parseNum(data['total_submitted']);
            _totalDamaged = _parseNum(data['total_damaged']);
            _totalRemaining = _parseNum(data['total_remaining']);
            _containerBreakdown = parsedList;
            _isLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _submitContainersToHub() async {
    final messenger = ScaffoldMessenger.of(context);
    final runIdParam = widget.currentRun?.runId;
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Emerald Icon Avatar
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFA7F3D0), width: 1.5),
                ),
                child: const Icon(
                  Icons.assignment_return_rounded,
                  size: 28,
                  color: Color(0xFF059669),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              const Text(
                'Submit Containers to Hub',
                style: TextStyle(
                  fontSize: 17.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),

              // Body
              Text(
                'Are you sure you want to submit all ${_totalCollected > 0 ? _totalCollected : "collected"} containers back to the hub?',
                style: const TextStyle(
                  fontSize: 13.5,
                  color: Color(0xFF475569),
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),

              // Side-by-Side Action Buttons (Cancel & Submit All)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(color: Color(0x3316A34A), blurRadius: 8, offset: Offset(0, 3)),
                        ],
                      ),
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text(
                          'Submit All',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm != true) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final dioClient = sl<DioClient>();
      final resp = await dioClient.dio.post(
        ApiEndpoints.submitAllContainers,
        data: runIdParam != null && runIdParam.isNotEmpty ? {'run_id': runIdParam} : {},
      );

      if (resp.statusCode == 200) {
        await _fetchContainerStatus();
        if (mounted) {
          await showDialog(
            context: context,
            builder: (ctx) => Dialog(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Emerald Checkmark Avatar Icon
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFA7F3D0), width: 2),
                        boxShadow: const [
                          BoxShadow(color: Color(0x20059669), blurRadius: 12, offset: Offset(0, 4)),
                        ],
                      ),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        size: 36,
                        color: Color(0xFF059669),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Title
                    const Text(
                      'Containers Submitted!',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.3,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),

                    // Subtitle Confirmation
                    const Text(
                      'All collected containers for this delivery run have been successfully submitted back to the hub.',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF475569),
                        height: 1.45,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 22),

                    // Got It Button
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'Got It',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
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
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Failed to submit containers. Please try again.'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final runIdStr = widget.currentRun != null && widget.currentRun!.runId.isNotEmpty
        ? widget.currentRun!.runId
        : 'Active Delivery Run';
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final bool canSubmit = _totalRemaining > 0 &&
        (widget.groupedStops.isEmpty ||
            widget.groupedStops.every((stop) {
              final status = stop.status.toLowerCase();
              return status == 'delivered' || status == 'completed' || status == 'failed' || status == 'cancelled';
            }));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Container Reconciliation Status',
              style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 1),
            Text(
              'Run #$runIdStr • Hub Return Ledger',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Header Read-Only Summary Banner with Responsive Spacing
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(color: Color(0x080F172A), blurRadius: 8, offset: Offset(0, 3)),
              ],
            ),
            child: Column(
              children: [
                // Run & Reconciliation Pill Bar (Responsive Wrap for all screen sizes)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            const Icon(Icons.local_shipping_rounded, size: 16, color: Color(0xFF0284C7)),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Run: $runIdStr',
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _totalRemaining == 0 && _totalCollected > 0
                              ? const Color(0xFFECFDF5)
                              : const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: _totalRemaining == 0 && _totalCollected > 0
                                ? const Color(0xFFA7F3D0)
                                : const Color(0xFFFDE68A),
                          ),
                        ),
                        child: Text(
                          _totalRemaining == 0 && _totalCollected > 0
                              ? 'SUBMITTED'
                              : 'PENDING HUB RETURN',
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            color: _totalRemaining == 0 && _totalCollected > 0
                                ? const Color(0xFF15803D)
                                : const Color(0xFFB45309),
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // 4 Responsive Stat Cards (Submitted, Broken, Collected, Balance)
                Row(
                  children: [
                    _buildStatCard(
                      label: 'Submitted',
                      count: '$_totalSubmitted',
                      icon: Icons.check_circle_rounded,
                      color: const Color(0xFF16A34A),
                      bgColor: const Color(0xFFECFDF5),
                      borderColor: const Color(0xFFA7F3D0),
                    ),
                    const SizedBox(width: 6),
                    _buildStatCard(
                      label: 'Broken',
                      count: '$_totalDamaged',
                      icon: Icons.error_outline_rounded,
                      color: const Color(0xFFDC2626),
                      bgColor: const Color(0xFFFEF2F2),
                      borderColor: const Color(0xFFFECACA),
                    ),
                    const SizedBox(width: 6),
                    _buildStatCard(
                      label: 'Collected',
                      count: '$_totalCollected',
                      icon: Icons.all_inbox_rounded,
                      color: const Color(0xFF2563EB),
                      bgColor: const Color(0xFFEFF6FF),
                      borderColor: const Color(0xFFBFDBFE),
                    ),
                    const SizedBox(width: 6),
                    _buildStatCard(
                      label: 'Balance',
                      count: '$_totalRemaining',
                      icon: Icons.pending_actions_rounded,
                      color: const Color(0xFFD97706),
                      bgColor: const Color(0xFFFFFBEB),
                      borderColor: const Color(0xFFFDE68A),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Containers Breakdown List ONLY (No Customer Info)
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF059669)))
                : _containerBreakdown.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Colors.white, Color(0xFFF0FDF4)],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFA7F3D0), width: 1.5),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x0C059669),
                                  blurRadius: 16,
                                  offset: Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 52,
                                  height: 52,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF6EE7B7), width: 1.5),
                                  ),
                                  child: const Icon(
                                    Icons.all_inbox_outlined,
                                    size: 26,
                                    color: Color(0xFF059669),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                const Text(
                                  'No Containers Tracked',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'No active crate or container returns required for this delivery run.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF047857),
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _containerBreakdown.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final item = _containerBreakdown[index];
                          final cName = item['container_name']?.toString() ?? 'Container Item';
                          final cId = item['container_id']?.toString() ?? '';
                          final collected = _parseNum(item['collected_quantity']);
                          final submitted = _parseNum(item['submitted_quantity']);
                          final damaged = _parseNum(item['damaged_quantity']);
                          final remaining = _parseNum(item['remaining_quantity']);

                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                              boxShadow: const [
                                BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 3)),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(9),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFF6FF),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(Icons.inventory_2_rounded, size: 22, color: Color(0xFF2563EB)),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            cName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w900,
                                              fontSize: 14,
                                              color: Color(0xFF0F172A),
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Container Code: $cId',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Responsive Wrap Badges for Mobile Widths
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    _buildContainerBadge(
                                      label: 'Collected: $collected',
                                      color: const Color(0xFF2563EB),
                                      bgColor: const Color(0xFFEFF6FF),
                                    ),
                                    _buildContainerBadge(
                                      label: 'Submitted: $submitted',
                                      color: const Color(0xFF16A34A),
                                      bgColor: const Color(0xFFECFDF5),
                                    ),
                                    _buildContainerBadge(
                                      label: 'Broken: $damaged',
                                      color: const Color(0xFFDC2626),
                                      bgColor: const Color(0xFFFEF2F2),
                                    ),
                                    _buildContainerBadge(
                                      label: 'Balance: $remaining',
                                      color: const Color(0xFFD97706),
                                      bgColor: const Color(0xFFFFFBEB),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),

          // Premium Emerald Gradient "Submit All Containers to Hub" Button (Hides when _totalRemaining == 0)
          if (canSubmit)
            Container(
              padding: EdgeInsets.fromLTRB(14, 10, 14, bottomInset + 10),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -3)),
                ],
              ),
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: const [
                    BoxShadow(color: Color(0x3316A34A), blurRadius: 10, offset: Offset(0, 4)),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _isSubmitting ? null : _submitContainersToHub,
                    borderRadius: BorderRadius.circular(26),
                    child: Center(
                      child: _isSubmitting
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.assignment_return_rounded, size: 20, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Submit All Containers to Hub',
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String count,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required Color borderColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 12, color: color),
                const SizedBox(width: 2),
                Text(
                  count,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContainerBadge({
    required String label,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}
