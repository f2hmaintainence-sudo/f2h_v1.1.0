import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/section_card.dart';

class NotificationsPreferencesScreen extends StatelessWidget {
  const NotificationsPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded && state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.successMessage!), backgroundColor: kSuccess),
          );
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Notifications & Language', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Failed to load preferences'));
            }

            final prefs = state.preferences;
            final push = prefs['push_notifications'] == true;
            final email = prefs['email_notifications'] == true;
            final sms = prefs['sms_notifications'] == true;
            final promo = prefs['promotional_notifications'] == true;
            final language = prefs['language_preference']?.toString() ?? 'en';

            void togglePreference(String key, dynamic value) {
              final newPrefs = Map<String, dynamic>.from(prefs);
              newPrefs[key] = value;
              context.read<ProfileBloc>().add(UpdatePreferencesEvent(newPrefs));
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  title: 'Notification Settings',
                  icon: Icons.notifications_active_rounded,
                  children: [
                    SwitchListTile(
                      title: const Text('Push Notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                      subtitle: const Text('Get real-time order alerts and updates', style: TextStyle(fontSize: 11)),
                      value: push,
                      activeColor: kPrimary,
                      onChanged: (val) => togglePreference('push_notifications', val),
                    ),
                    const Divider(height: 1, color: kBorderLt),
                    SwitchListTile(
                      title: const Text('Email Notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                      subtitle: const Text('Receive daily shift statements and earnings report', style: TextStyle(fontSize: 11)),
                      value: email,
                      activeColor: kPrimary,
                      onChanged: (val) => togglePreference('email_notifications', val),
                    ),
                    const Divider(height: 1, color: kBorderLt),
                    SwitchListTile(
                      title: const Text('SMS Notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                      subtitle: const Text('Get notifications regarding payouts and critical info via SMS', style: TextStyle(fontSize: 11)),
                      value: sms,
                      activeColor: kPrimary,
                      onChanged: (val) => togglePreference('sms_notifications', val),
                    ),
                    const Divider(height: 1, color: kBorderLt),
                    SwitchListTile(
                      title: const Text('Promotional Notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                      subtitle: const Text('Stay updated with rider incentive schemes and referral rewards', style: TextStyle(fontSize: 11)),
                      value: promo,
                      activeColor: kPrimary,
                      onChanged: (val) => togglePreference('promotional_notifications', val),
                    ),
                  ],
                ),
                SectionCard(
                  title: 'Language Configuration',
                  icon: Icons.language_rounded,
                  children: [
                    const Text('App Language', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: language,
                      decoration: InputDecoration(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kBorder)),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'en', child: Text('English', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
                        DropdownMenuItem(value: 'hi', child: Text('हिन्दी (Hindi)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
                        DropdownMenuItem(value: 'kn', child: Text('ಕನ್ನಡ (Kannada)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
                        DropdownMenuItem(value: 'te', child: Text('తెలుగు (Telugu)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
                        DropdownMenuItem(value: 'ta', child: Text('தமிழ் (Tamil)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold))),
                      ],
                      onChanged: (val) {
                        if (val != null) togglePreference('language_preference', val);
                      },
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
