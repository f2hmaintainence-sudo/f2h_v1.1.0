import 'dart:io';
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
    try {
      isar = await Isar.open(
        [AuthLocalModelSchema],
        directory: dir.path,
        inspector: false,
      );
    } catch (e) {
      // Schema mismatch (e.g. "Collection id is invalid") after a package
      // upgrade or code-gen change. Wipe the stale DB and re-open fresh.
      // Auth tokens live in flutter_secure_storage — no data loss.
      debugPrint('[IsarService] DB schema error, wiping and retrying: $e');
      try {
        final dbFile = File('${dir.path}/default.isar');
        final lockFile = File('${dir.path}/default.isar.lock');
        if (await dbFile.exists()) await dbFile.delete();
        if (await lockFile.exists()) await lockFile.delete();
      } catch (_) {}
      isar = await Isar.open(
        [AuthLocalModelSchema],
        directory: dir.path,
        inspector: false,
      );
    }
  }
}
