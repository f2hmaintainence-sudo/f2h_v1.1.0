import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/section_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/info_tile.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(title: 'Activity Logs'),
      body: BlocBuilder<ProfileBloc, ProfileState>(
        builder: (context, state) {
          if (state is ProfileLoading) {
            return const Center(child: CircularProgressIndicator(color: kPrimary));
          }
          if (state is! ProfileLoaded) {
            return const Center(child: Text('Failed to load activity logs'));
          }

          final activity = state.activity;
          final lastLogin = activity['last_login']?.toString() ?? 'N/A';
          final lastActive = activity['last_active']?.toString() ?? 'N/A';
          final device = activity['device_name']?.toString() ?? 'Unknown Device';
          final os = activity['os']?.toString() ?? 'Unknown';
          final version = activity['app_version']?.toString() ?? '2.5.0';

          String formatDateTime(String dtStr) {
            if (dtStr == 'N/A') return 'N/A';
            try {
              final dt = DateTime.parse(dtStr);
              return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
            } catch (_) {
              return dtStr;
            }
          }

          return RefreshIndicator(
            onRefresh: () async {
              context.read<ProfileBloc>().add(FetchActivityEvent());
            },
            color: kPrimary,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  title: 'Device & Session Logs',
                  icon: Icons.smartphone_rounded,
                  children: [
                    InfoTile(label: 'Registered Device', value: '$device ($os)'),
                    InfoTile(label: 'App Version', value: version),
                    InfoTile(label: 'Last Session Login', value: formatDateTime(lastLogin)),
                    InfoTile(label: 'Last Active Ping', value: formatDateTime(lastActive)),
                  ],
                ),
                SectionCard(
                  title: 'Recent Audit Info',
                  icon: Icons.history_toggle_off_rounded,
                  children: [
                    InfoTile(label: 'System Status', value: 'ONLINE · TRACKING ACTIVE'),
                    InfoTile(
                      label: 'Account Role',
                      value: 'Delivery Partner',
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: kBgDeep,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: kBorder),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.security_rounded, color: kPrimary, size: 16),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Device session tracking is mandatory for route safety and automated payout calculations.',
                              style: TextStyle(fontSize: 11, color: kTextSub, height: 1.3, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    )
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
