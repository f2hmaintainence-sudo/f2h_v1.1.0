import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';

class VersionChecker {
  static const String _defaultPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.f2h.delivery';

  /// Checks for updates. Returns [true] if a forced update is required and active, blocking navigation.
  static Future<bool> checkUpdates(BuildContext context) async {
    if (kIsWeb) return false;
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      final platform = defaultTargetPlatform == TargetPlatform.iOS
          ? 'ios_delivery'
          : 'android_delivery';

      final checkUrl = '${ApiEndpoints.baseUrl}/app/check-version';
      final response = await http.get(
        Uri.parse(checkUrl),
        headers: {
          'x-app-platform': platform,
          'x-app-version': currentVersion,
        },
      ).timeout(const Duration(seconds: 5));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final updateRequired = data['updateRequired'] as bool? ?? false;
        final forceUpdate = data['forceUpdate'] as bool? ?? false;
        final updateUrl = data['storeUrl'] as String? ?? '';
        final message = data['message'] as String? ?? '';
        final title = data['updateTitle'] as String? ?? 'Update Available';
        final releaseNotes = data['releaseNotes'] as String? ?? 'Bug fixes and performance improvements.';
        final fileSize = data['fileSize'] as String? ?? '';

        if (updateRequired) {
          if (!context.mounted) return false;
          _showUpdateDialog(
            context,
            updateUrl,
            forceUpdate,
            message,
            title,
            releaseNotes,
            fileSize,
          );
          return forceUpdate; // Return true if it is a forced update
        }
      }
    } catch (e) {
      debugPrint('Delivery app version check error: $e');
    }
    return false;
  }

  static void _showUpdateDialog(
    BuildContext context,
    String url,
    bool forceUpdate,
    String message,
    String title,
    String releaseNotes,
    String fileSize,
  ) {
    showDialog(
      context: context,
      barrierDismissible: !forceUpdate,
      builder: (context) {
        return PopScope(
          canPop: !forceUpdate,
          child: Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            elevation: 10,
            backgroundColor: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Icon mockup
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                      ),
                      child: const Center(
                        child: Text(
                          'DP',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  
                  // Dialog Title
                  Text(
                    title.isNotEmpty ? title : (forceUpdate ? 'Update Required' : 'Update Available'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Prompt Message
                  Text(
                    message.isNotEmpty ? message : 'A new version of the delivery partner app is available. Please update to continue.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Release notes block
                  const Text(
                    "WHAT'S NEW",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF94A3B8),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 120),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                    ),
                    child: SingleChildScrollView(
                      child: Text(
                        releaseNotes,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF475569),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Metadata info like file size
                  if (fileSize.isNotEmpty && fileSize != '0 MB' && fileSize != '0.00 MB')
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'File Size',
                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                        ),
                        Text(
                          fileSize,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF1E293B), fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  const SizedBox(height: 24),

                  // Actions
                  Row(
                    children: [
                      if (!forceUpdate) ...[
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: const BorderSide(color: Color(0xFFE2E8F0)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            onPressed: () => Navigator.pop(context),
                            child: const Text(
                              'LATER',
                              style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F172A),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: () async {
                            final targetUrl = url.trim().isNotEmpty ? url.trim() : _defaultPlayStoreUrl;
                            final uri = Uri.parse(targetUrl);
                            try {
                              await launchUrl(uri, mode: LaunchMode.externalApplication);
                            } catch (e) {
                              debugPrint('Could not launch update URL: $e');
                              try {
                                await launchUrl(Uri.parse(_defaultPlayStoreUrl), mode: LaunchMode.externalApplication);
                              } catch (_) {}
                            }
                            if (!forceUpdate && context.mounted) {
                              Navigator.pop(context);
                            }
                          },
                          child: const Text(
                            'UPDATE NOW',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
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
      },
    );
  }
}
