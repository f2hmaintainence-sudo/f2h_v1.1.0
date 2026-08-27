import 'package:url_launcher/url_launcher.dart';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class SupportScreen extends StatefulWidget {
  final int initialTabIndex; // 0: Raise Ticket, 1: My Tickets, 2: Helplines
  const SupportScreen({super.key, this.initialTabIndex = 0});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Raise Ticket Form Controllers
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _selectedCategory = 'payout';
  String _selectedPriority = 'medium';

  final _categories = {
    'payout': 'Payout/Salary Issue',
    'app_bug': 'Application Issue/Bug',
    'customer': 'Customer Misbehavior',
    'inventory': 'Stock/Handover Discrepancy',
    'other': 'Other Enquiries'
  };

  final _priorities = {
    'low': 'Low Priority',
    'medium': 'Medium Priority',
    'high': 'High Priority',
    'critical': 'Critical Priority'
  };

  // Image Attachment state
  final ImagePicker _picker = ImagePicker();
  XFile? _attachmentXFile;
  Uint8List? _attachmentBytes;
  bool _isSubmitting = false;

  // Tickets List state
  List<dynamic> _tickets = [];
  bool _isLoadingTickets = true;
  String? _ticketsError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _tabController.addListener(_handleTabSelection);
    _fetchTickets();
  }

  void _handleTabSelection() {
    if (_tabController.index == 1) {
      _fetchTickets();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  // ─── Fetch Tickets API Call ────────────────────────────────────────────────
  Future<void> _fetchTickets() async {
    if (!mounted) return;
    setState(() {
      _isLoadingTickets = true;
      _ticketsError = null;
    });

    try {
      final dioClient = sl<DioClient>();
      final response = await dioClient.dio.get(ApiEndpoints.supportTickets);
      if (mounted) {
        setState(() {
          _tickets = response.data['data'] as List? ?? [];
          _isLoadingTickets = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _ticketsError = e.toString();
          _isLoadingTickets = false;
        });
      }
    }
  }

  void _showAttachmentViewer(String imageUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 30),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return const SizedBox(
                    height: 200,
                    child: Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  );
                },
                errorBuilder: (context, error, stackTrace) => Container(
                  height: 200,
                  width: double.infinity,
                  color: Colors.white10,
                  child: const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.broken_image_rounded, color: Colors.white60, size: 48),
                        SizedBox(height: 8),
                        Text(
                          'Failed to load image',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Image Picker helper ───────────────────────────────────────────────────
  Future<void> _showAttachmentSourceSelector() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_rounded, color: kPrimary),
              title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.bold)),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded, color: kPrimary),
              title: const Text('Take a Photo', style: TextStyle(fontWeight: FontWeight.bold)),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(source: source, imageQuality: 80);
      if (picked != null) {
        final bytes = await picked.readAsBytes();
        setState(() {
          _attachmentXFile = picked;
          _attachmentBytes = bytes;
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to pick image: $e')),
      );
    }
  }

  // ─── Submit Ticket API Call ────────────────────────────────────────────────
  Future<void> _submitTicket() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final dioClient = sl<DioClient>();
      List<String> attachments = [];

      // 1. Upload file if any is selected
      if (_attachmentBytes != null && _attachmentXFile != null) {
        final String fileName = _attachmentXFile!.name.isNotEmpty
            ? _attachmentXFile!.name
            : 'attachment_${DateTime.now().millisecondsSinceEpoch}.jpg';
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(
            _attachmentBytes!,
            filename: fileName,
          ),
        });

        final uploadResponse = await dioClient.dio.post(
          '${ApiEndpoints.supportTickets}/upload',
          data: formData,
        );

        if (uploadResponse.data['success'] == true && uploadResponse.data['url'] != null) {
          attachments.add(uploadResponse.data['url']);
        }
      }

      // 2. Submit ticket
      final response = await dioClient.dio.post(
        ApiEndpoints.supportTickets,
        data: {
          'category': _selectedCategory,
          'subject': _subjectController.text.trim(),
          'description': _descriptionController.text.trim(),
          'priority': _selectedPriority,
          'attachments': attachments,
        },
      );

      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _attachmentXFile = null;
          _attachmentBytes = null;
          _subjectController.clear();
          _descriptionController.clear();
        });

        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Text('🎟️ '),
                Text('Ticket Raised', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            content: Text(
              'Your support ticket (#${response.data['ticket_id']}) has been registered successfully. Our operations desk will review it shortly.',
              style: const TextStyle(fontSize: 14, height: 1.4),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  _tabController.animateTo(1); // Switch to "My Tickets"
                },
                child: const Text('View Status', style: TextStyle(color: kPrimary, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to raise ticket: $e'), backgroundColor: kRed),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(
        title: 'Support Center',
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: kPrimary,
          indicatorWeight: 3.5,
          indicatorSize: TabBarIndicatorSize.label,
          labelColor: kPrimary,
          unselectedLabelColor: const Color(0xFF64748B),
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Raise Ticket', icon: Icon(Icons.add_comment_rounded, size: 20)),
            Tab(text: 'My Tickets', icon: Icon(Icons.all_inbox_rounded, size: 20)),
            Tab(text: 'Helplines', icon: Icon(Icons.contact_support_rounded, size: 20)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildRaiseTicketTab(),
          _buildMyTicketsTab(),
          _buildHelplineTab(),
        ],
      ),
    );
  }

  // ─── TAB 1: Raise Ticket Form ──────────────────────────────────────────────
  Widget _buildRaiseTicketTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderLt),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Text('💬', style: TextStyle(fontSize: 22)),
                  SizedBox(width: 8),
                  Text(
                    'Create Support Ticket',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Category
              const Text('Issue Category', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedCategory,
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCategory = val);
                },
                items: _categories.entries.map((entry) {
                  return DropdownMenuItem<String>(
                    value: entry.key,
                    child: Text(entry.value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  );
                }).toList(),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kBorder)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
                ),
              ),
              const SizedBox(height: 16),

              // Priority
              const Text('Priority Level', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedPriority,
                onChanged: (val) {
                  if (val != null) setState(() => _selectedPriority = val);
                },
                items: _priorities.entries.map((entry) {
                  return DropdownMenuItem<String>(
                    value: entry.key,
                    child: Text(entry.value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  );
                }).toList(),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kBorder)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
                ),
              ),
              const SizedBox(height: 16),

              // Subject
              const Text('Subject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _subjectController,
                validator: (val) => (val == null || val.trim().isEmpty) ? 'Subject is required' : null,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Brief summary of the issue...',
                  hintStyle: const TextStyle(color: kMuted),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kBorder)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
                ),
              ),
              const SizedBox(height: 16),

              // Description
              const Text('Issue Description', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _descriptionController,
                maxLines: 4,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  hintText: 'Describe details such as orders numbers, times, amounts, or what happened...',
                  hintStyle: const TextStyle(color: kMuted),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kBorder)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
                ),
              ),
              const SizedBox(height: 16),

              // Image Attachment Selector
              const Text('Attachment (Optional Image)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
              const SizedBox(height: 8),
              if (_attachmentBytes != null) ...[
                Stack(
                  children: [
                    Container(
                      height: 160,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: kBorder),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(9),
                        child: Image.memory(_attachmentBytes!, fit: BoxFit.cover),
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _attachmentXFile = null;
                          _attachmentBytes = null;
                        }),
                        child: Container(
                          decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                          padding: const EdgeInsets.all(6),
                          child: const Icon(Icons.close, color: Colors.white, size: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                InkWell(
                  onTap: _showAttachmentSourceSelector,
                  child: Container(
                    height: 80,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: kBgDeep.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: kBorder, style: BorderStyle.solid),
                    ),
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_photo_alternate_rounded, color: kPrimaryMid, size: 28),
                        SizedBox(height: 4),
                        Text('Add Photo Proof / Screenshot', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: kTextSub)),
                      ],
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isSubmitting ? null : _submitTicket,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Submit Support Ticket',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── TAB 2: My Tickets List ────────────────────────────────────────────────
  Widget _buildMyTicketsTab() {
    if (_isLoadingTickets) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }

    if (_ticketsError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: kRed, size: 48),
              const SizedBox(height: 12),
              Text(
                'Failed to load tickets: $_ticketsError',
                style: const TextStyle(color: kTextSub, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchTickets,
                style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
                child: const Text('Retry', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      );
    }

    if (_tickets.isEmpty) {
      return RefreshIndicator(
        onRefresh: _fetchTickets,
        color: kPrimary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                children: [
                  Icon(Icons.confirmation_number_outlined, size: 64, color: kMuted.withValues(alpha: 0.5)),
                  const SizedBox(height: 16),
                  const Text('No tickets raised yet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kTextMid)),
                  const SizedBox(height: 4),
                  const Text('Any support tickets you create will appear here.', style: TextStyle(fontSize: 12, color: kTextSub)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchTickets,
      color: kPrimary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _tickets.length,
        itemBuilder: (context, index) {
          final ticket = _tickets[index];
          return _buildTicketCard(ticket);
        },
      ),
    );
  }

  Widget _buildTicketCard(Map<String, dynamic> ticket) {
    final String tktId = (ticket['ticket_id'] ?? '').toString();
    final String category = (ticket['category'] ?? 'General').toString();
    final String subject = (ticket['subject'] ?? 'No Subject').toString();
    final String desc = (ticket['description'] ?? '').toString();
    final String priority = (ticket['priority'] ?? 'medium').toString().toLowerCase();
    final String status = (ticket['status'] ?? 'open').toString().toLowerCase();
    final String resNotes = (ticket['resolution_notes'] ?? '').toString();

    final dateStr = ticket['created_at'] != null
        ? DateTime.parse(ticket['created_at'].toString()).toLocal().toString().substring(0, 16)
        : '';

    // Status Styling
    Color statusBg;
    Color statusFg;
    if (status == 'open') {
      statusBg = const Color(0xFFFFF3CD);
      statusFg = const Color(0xFF856404);
    } else if (status == 'in_progress') {
      statusBg = const Color(0xFFE0F7FA);
      statusFg = Colors.cyan.shade800;
    } else if (status == 'resolved') {
      statusBg = const Color(0xFFE8F5E9);
      statusFg = Colors.green.shade800;
    } else {
      statusBg = kBgDeep;
      statusFg = kTextSub;
    }

    // Priority Styling
    Color priorityColor = Colors.grey;
    if (priority == 'low') priorityColor = Colors.blue;
    if (priority == 'medium') priorityColor = Colors.orange;
    if (priority == 'high') priorityColor = Colors.redAccent;
    if (priority == 'critical') priorityColor = kRed;

    // Attachments check
    List<dynamic> attachmentsList = [];
    if (ticket['attachments'] != null) {
      if (ticket['attachments'] is List) {
        attachmentsList = ticket['attachments'] as List;
      } else if (ticket['attachments'] is String) {
        try {
          // jsonb might parse as string sometimes
          // ignore: unused_local_variable
          final parsed = ticket['attachments'];
        } catch (_) {}
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Card Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: kBorderLt.withValues(alpha: 0.5),
            child: Row(
              children: [
                Text(
                  'ID: $tktId',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: kText),
                ),
                const SizedBox(width: 8),
                Text(
                  '· $dateStr',
                  style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(color: statusFg, fontWeight: FontWeight.bold, fontSize: 9),
                  ),
                ),
              ],
            ),
          ),

          // Card Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Category & Priority
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: kBgDeep,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _categories[category] ?? category.toUpperCase(),
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: kTextMid),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        border: Border.all(color: priorityColor.withValues(alpha: 0.3)),
                        color: priorityColor.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        priority.toUpperCase(),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: priorityColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Subject
                Text(
                  subject,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: kText),
                ),
                const SizedBox(height: 8),

                // Description
                if (desc.isNotEmpty) ...[
                  Text(
                    desc,
                    style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                ],

                // Attachments Thumbnail list
                if (attachmentsList.isNotEmpty) ...[
                  const Text('ATTACHMENTS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: kMuted, letterSpacing: 0.5)),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 60,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: attachmentsList.length,
                      itemBuilder: (context, idx) {
                        final relativeUrl = attachmentsList[idx].toString();
                        final fullUrl = '${ApiEndpoints.baseUrl}/$relativeUrl';
                        return GestureDetector(
                          onTap: () => _showAttachmentViewer(fullUrl),
                          child: Container(
                            width: 60,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                fullUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (ctx, err, stack) => const Center(
                                  child: Icon(Icons.broken_image_rounded, color: kMuted, size: 20),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],

                // Resolution box
                if (resNotes.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9).withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.green.shade100),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.check_circle_rounded, color: Colors.green.shade800, size: 14),
                            const SizedBox(width: 6),
                            Text(
                              'RESOLUTION NOTES',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green.shade800, letterSpacing: 0.5),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          resNotes,
                          style: const TextStyle(fontSize: 12, color: kTextMid, height: 1.4, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── TAB 3: Helplines & Helpholding ─────────────────────────────────────────
  Widget _buildHelplineTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildHelplineCard(),
      ],
    );
  }

  Widget _buildHelplineCard() {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('📞', style: TextStyle(fontSize: 22)),
              SizedBox(width: 8),
              Text(
                'Supervisor Hotline',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: kPrimary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'In case of deliveries blockage, route issues, accidents, or cash collections, directly reach your branch leader.',
            style: TextStyle(fontSize: 12, color: kTextSub, height: 1.3),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: kBgDeep,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Branch Manager', style: TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.bold)),
                    SizedBox(height: 2),
                    Text('+91 91487 73591', style: TextStyle(fontSize: 15, color: kText, fontWeight: FontWeight.w800)),
                  ],
                ),
                const Spacer(),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.phone_forwarded, size: 16, color: Colors.white),
                  label: const Text('Call Now', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Call Branch Leader'),
                        content: const Text('Do you want to initiate a voice call to +91 91487 73591?'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel', style: TextStyle(color: kTextSub)),
                          ),
                          TextButton(
                            onPressed: () async {
                              Navigator.pop(context);
                              final url = Uri.parse('tel:+919148773591');
                              if (await canLaunchUrl(url)) {
                                await launchUrl(url);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Could not open dialer'), backgroundColor: kRed),
                                );
                              }
                            },
                            child: const Text('Call', style: TextStyle(color: kPrimary, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
