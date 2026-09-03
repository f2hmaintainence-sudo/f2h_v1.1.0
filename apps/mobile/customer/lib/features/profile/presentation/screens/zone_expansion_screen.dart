import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════════════
//  ZONE EXPANSION REQUESTS SCREEN — Customer Profile Screen Option
// ══════════════════════════════════════════════════════════════════

class ZoneExpansionScreen extends StatefulWidget {
  const ZoneExpansionScreen({super.key});

  @override
  State<ZoneExpansionScreen> createState() => _ZoneExpansionScreenState();
}

class _ZoneExpansionScreenState extends State<ZoneExpansionScreen> {
  final DioClient _dioClient = DioClient();
  bool _isLoading = true;
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() => _isLoading = true);
    try {
      final response = await _dioClient.dio.get(ApiEndpoints.zoneExpansionMyRequests);
      if (response.data != null && response.data['status'] == true) {
        setState(() {
          _requests = response.data['data'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _openNewRequestSheet() {
    final latController = TextEditingController();
    final lngController = TextEditingController();
    final addressController = TextEditingController();
    final descController = TextEditingController();
    bool isDetectingLocation = false;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> detectCurrentLocation() async {
              setSheetState(() => isDetectingLocation = true);
              try {
                LocationPermission permission = await Geolocator.checkPermission();
                if (permission == LocationPermission.denied) {
                  permission = await Geolocator.requestPermission();
                }
                if (permission == LocationPermission.denied ||
                    permission == LocationPermission.deniedForever) {
                  if (ctx.mounted) {
                    F2HToast.error(ctx, 'Location permission is required to detect GPS coordinates');
                  }
                  setSheetState(() => isDetectingLocation = false);
                  return;
                }

                final pos = await Geolocator.getCurrentPosition(
                  locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
                );
                latController.text = pos.latitude.toStringAsFixed(6);
                lngController.text = pos.longitude.toStringAsFixed(6);
                if (addressController.text.trim().isEmpty) {
                  addressController.text = 'Current GPS Location (${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)})';
                }
                setSheetState(() => isDetectingLocation = false);
              } catch (err) {
                setSheetState(() => isDetectingLocation = false);
                if (ctx.mounted) {
                  F2HToast.error(ctx, 'Could not fetch current GPS location');
                }
              }
            }

            Future<void> submit() async {
              final lat = double.tryParse(latController.text.trim());
              final lng = double.tryParse(lngController.text.trim());

              if (lat == null || lng == null) {
                F2HToast.error(ctx, 'Please provide valid latitude and longitude');
                return;
              }

              setSheetState(() => isSubmitting = true);
              try {
                final payload = {
                  'latitude': lat,
                  'longitude': lng,
                  'address_label': addressController.text.trim().isNotEmpty ? addressController.text.trim() : null,
                  'description': descController.text.trim().isNotEmpty ? descController.text.trim() : null,
                };

                final res = await _dioClient.dio.post(
                  ApiEndpoints.zoneExpansionRequest,
                  data: payload,
                );

                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  if (mounted) {
                    F2HToast.success(
                      context,
                      res.data?['message'] ?? 'Zone expansion request submitted successfully!',
                    );
                    _fetchRequests();
                  }
                }
              } catch (e) {
                setSheetState(() => isSubmitting = false);
                if (ctx.mounted) {
                  F2HToast.error(ctx, extractErrorMessage(e));
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
              ),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 5,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade300,
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(
                              Icons.radar_rounded,
                              color: Color(0xFFD97706),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Request Delivery Expansion',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w900,
                                    color: kText,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Request delivery to your area',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: kTextSub,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // GPS Quick Button
                      InkWell(
                        onTap: isDetectingLocation ? null : detectCurrentLocation,
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: kBgDeep,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kBorder),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.my_location_rounded,
                                color: isDetectingLocation ? kMuted : kPrimary,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  isDetectingLocation
                                      ? 'Detecting current GPS location...'
                                      : 'Use Current GPS Location',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isDetectingLocation ? kMuted : kPrimaryMid,
                                  ),
                                ),
                              ),
                              if (isDetectingLocation)
                                const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Coordinates Row
                      Row(
                        children: [
                          Expanded(
                            child: _buildInput(
                              label: 'Latitude',
                              controller: latController,
                              hint: 'e.g. 12.9716',
                              keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildInput(
                              label: 'Longitude',
                              controller: lngController,
                              hint: 'e.g. 77.5946',
                              keyboard: const TextInputType.numberWithOptions(decimal: true, signed: true),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Address / Area
                      _buildInput(
                        label: 'Area / Landmark / Address',
                        controller: addressController,
                        hint: 'e.g. Apartment Name, Road, Pincode',
                      ),
                      const SizedBox(height: 14),

                      // Description
                      _buildInput(
                        label: 'Additional Remarks (Optional)',
                        controller: descController,
                        hint: 'e.g. We have 50+ families looking for fresh organic milk daily',
                        maxLines: 2,
                      ),
                      const SizedBox(height: 22),

                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: isSubmitting ? null : submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kPrimary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 0,
                          ),
                          child: isSubmitting
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'SUBMIT ZONE REQUEST',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildInput({
    required String label,
    required TextEditingController controller,
    required String hint,
    TextInputType keyboard = TextInputType.text,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: kTextSub,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: kBorder),
          ),
          child: TextField(
            controller: controller,
            keyboardType: keyboard,
            maxLines: maxLines,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: kMuted, fontSize: 12),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Zone Expansion Requests',
          style: TextStyle(
            color: kText,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewRequestSheet,
        backgroundColor: kPrimary,
        icon: const Icon(Icons.add_location_alt_rounded, color: Colors.white, size: 20),
        label: const Text(
          'Request Area',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 13,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              onRefresh: _fetchRequests,
              color: kPrimary,
              child: _requests.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      itemCount: _requests.length,
                      itemBuilder: (context, index) {
                        final req = _requests[index];
                        return _buildRequestCard(req);
                      },
                    ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFDE68A), width: 2),
              ),
              child: const Icon(
                Icons.radar_rounded,
                size: 48,
                color: Color(0xFFD97706),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No Zone Requests Yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Looking for delivery in an area outside our current delivery radius?\nRequest coverage and our operations team will evaluate expansion to your location!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _openNewRequestSheet,
              icon: const Icon(Icons.add_location_alt_rounded, size: 18),
              label: const Text(
                'Request Coverage for My Area',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestCard(dynamic req) {
    final status = (req['status'] ?? 'pending').toString().toLowerCase();
    final branchName = req['branch_name'] ?? 'Nearest Hub';
    final distKm = req['distance_km'];
    final address = req['address_label'] ?? 'Coordinates (${req['latitude']}, ${req['longitude']})';
    final desc = req['description'];
    final createdAt = req['created_at'] != null ? req['created_at'].toString().split('T').first : '';

    Color statusBg;
    Color statusFg;
    IconData statusIcon;
    String statusLabel;

    switch (status) {
      case 'noted':
        statusBg = const Color(0xFFDCFCE7);
        statusFg = const Color(0xFF15803D);
        statusIcon = Icons.check_circle_rounded;
        statusLabel = 'Noted for Expansion';
        break;
      case 'rejected':
        statusBg = const Color(0xFFFEE2E2);
        statusFg = const Color(0xFFDC2626);
        statusIcon = Icons.cancel_rounded;
        statusLabel = 'Currently Outside Feasibility';
        break;
      default:
        statusBg = const Color(0xFFFEF3C7);
        statusFg = const Color(0xFFB45309);
        statusIcon = Icons.hourglass_top_rounded;
        statusLabel = 'Under Review';
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorderLt, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 13, color: statusFg),
                    const SizedBox(width: 5),
                    Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusFg,
                      ),
                    ),
                  ],
                ),
              ),
              if (createdAt.isNotEmpty)
                Text(
                  createdAt,
                  style: const TextStyle(fontSize: 11, color: kTextSub),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_rounded, size: 16, color: kPrimary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  address,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: kText,
                  ),
                ),
              ),
            ],
          ),
          if (distKm != null || branchName != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: kBgDeep,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.storefront_rounded, size: 13, color: kTextSub),
                  const SizedBox(width: 5),
                  Text(
                    branchName,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kTextMid),
                  ),
                  if (distKm != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      '• ${(double.tryParse(distKm.toString()) ?? 0).toStringAsFixed(1)} km from hub',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF2563EB)),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (desc != null && desc.toString().trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Remarks: "${desc.toString().trim()}"',
              style: const TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: kTextSub,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
