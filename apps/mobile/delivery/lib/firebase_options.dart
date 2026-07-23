import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:f2h_delivery/core/config/app_config.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return AppConfig.dynamicFirebaseOptions;
  }
}