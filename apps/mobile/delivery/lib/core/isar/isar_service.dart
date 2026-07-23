import 'package:flutter/foundation.dart';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:f2h_delivery/auth/data/models/auth_local_model.dart';

class IsarService {
  static Isar? isar;

  static Future<void> init() async {
    if (kIsWeb) return;
    if (Isar.getInstance() != null) {
      isar = Isar.getInstance()!;
      return;
    }
    final dir = await getApplicationDocumentsDirectory();
    isar = await Isar.open(
      [AuthLocalModelSchema],
      directory: dir.path,
      inspector: false,
    );
  }
}
