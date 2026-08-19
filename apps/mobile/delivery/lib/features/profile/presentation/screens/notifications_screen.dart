import 'package:flutter/material.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: F2hAppBar(title: 'Notifications'),
      body: const Center(
        child: Text('No notifications to display.'),
      ),
    );
  }
}
