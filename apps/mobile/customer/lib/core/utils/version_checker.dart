import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

class VersionChecker {
  static final _updater = ShorebirdUpdater();
  static const String _defaultPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.f2h.customer&pcampaignid=web_share';
  static String get _versionApiUrl => '${ApiEndpoints.baseUrl}${ApiEndpoints.appVersion}';

  static Future<void> checkUpdates(BuildContext context) async {
    if (kIsWeb) return;

    // 0. Non-blocking device info reporting in background (never blocks UI)
    _sendDeviceInformation();

    // 1. Check for Minor Updates (Shorebird Patches)
    try {
      if (_updater.isAvailable) {
        final status = await _updater.checkForUpdate();
        if (status == UpdateStatus.outdated) {
          await _updater.update();
          
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('A new update is ready! Restart the app to apply.'),
              duration: const Duration(days: 1), // Keep it visible
              action: SnackBarAction(
                label: 'RESTART',
                textColor: Colors.white,
                onPressed: () {}, // The user can restart manually, or you can implement restart logic
              ),
            ),
          );
          return; // A patch was found, no need to check for major APK update
        } else if (status == UpdateStatus.restartRequired) {
          // Already downloaded, just waiting for restart
          return;
        }
      }
    } catch (e) {
      debugPrint('Shorebird check error: $e');
    }

    // 2. Check for Major Updates (Play Store / App Update)
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      final platform = Platform.isAndroid ? 'android_customer' : 'ios_customer';

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
          if (!context.mounted) return;
          _showUpdateDialog(
            context,
            updateUrl,
            forceUpdate,
            message,
            title,
            releaseNotes,
            fileSize,
          );
        }
      }
    } catch (e) {
      debugPrint('Major version check error: $e');
    }
  }

  // TEMP METHOD: Easily removable
  static Future<void> _sendDeviceInformation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      String? deviceId = prefs.getString('f2h_device_id');
      if (deviceId == null) {
        deviceId = const Uuid().v4();
        await prefs.setString('f2h_device_id', deviceId);
      }

      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo.timeout(const Duration(seconds: 2));
      final packageInfo = await PackageInfo.fromPlatform().timeout(const Duration(seconds: 2));
      
      final currentVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      
      final body = {
        'device_id': deviceId,
        'brand': androidInfo.brand,
        'model': androidInfo.model,
        'hardware': androidInfo.hardware,
        'os_version': androidInfo.version.release,
        'app_version': currentVersion,
      };

      final url = '${ApiEndpoints.baseUrl}${ApiEndpoints.deviceInformation}';
      await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 2));
      debugPrint('Device info sent to backend successfully.');
    } catch (e) {
      debugPrint('Failed to send device info: $e');
    }
  }

  static bool _isUpdateRequired(String currentVersion, String latestVersion) {
    // Expected format: "1.0.1+4"
    final currSplit = currentVersion.split('+');
    final latestSplit = latestVersion.split('+');

    final currVer = currSplit[0];
    final latestVer = latestSplit[0];
    
    final currParts = currVer.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final latestParts = latestVer.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    // 1. Compare major, minor, patch
    for (int i = 0; i < 3; i++) {
      final c = currParts.length > i ? currParts[i] : 0;
      final l = latestParts.length > i ? latestParts[i] : 0;
      if (l > c) return true;
      if (c > l) return false;
    }

    // 2. If versions are exactly the same (e.g., 1.0.1 == 1.0.1), compare build numbers
    final currBuild = currSplit.length > 1 ? (int.tryParse(currSplit[1]) ?? 0) : 0;
    final latestBuild = latestSplit.length > 1 ? (int.tryParse(latestSplit[1]) ?? 0) : 0;

    return latestBuild > currBuild;
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
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFC8E6C9), width: 1),
                      ),
                      child: const Center(
                        child: Text(
                          'F2H',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0C831F),
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
                    message.isNotEmpty ? message : 'A new version of the app is available. Please update to continue using the app.',
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
                            backgroundColor: const Color(0xFF0C831F),
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
                              // Fallback to direct Play Store intent
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
