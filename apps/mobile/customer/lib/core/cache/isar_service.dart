// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : isar_service.dart
// Description : Thread-safe Isar cache database service for Customer App.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'dart:io';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:f2h_customer/auth/data/models/user_model.dart';

class IsarService {
  static Isar? _isar;
  late Future<Isar> db;

  IsarService() {
    db = openDB();
  }

  Future<Isar> openDB() async {
    if (kIsWeb) {
      return Completer<Isar>().future;
    }
    const dbName = 'f2h_local';

    final existing = Isar.getInstance(dbName) ?? Isar.getInstance();
    if (existing != null && existing.isOpen) {
      try {
        existing.getCollectionByNameInternal('UserModel');
        _isar = existing;
        return _isar!;
      } catch (_) {
        try {
          await existing.close();
        } catch (_) {}
      }
    }

    final dir = await getApplicationDocumentsDirectory();

    // Try opening normally first
    try {
      _isar = await Isar.open(
        [UserModelSchema],
        directory: dir.path,
        name: dbName,
        inspector: false,
      );
      return _isar!;
    } catch (e) {
      final checkOpened = Isar.getInstance(dbName) ?? Isar.getInstance();
      if (checkOpened != null && checkOpened.isOpen) {
        _isar = checkOpened;
        return _isar!;
      }

      try {
        final dbFile = File('${dir.path}/$dbName.isar');
        final lockFile = File('${dir.path}/$dbName.isar.lock');
        if (await dbFile.exists()) await dbFile.delete();
        if (await lockFile.exists()) await lockFile.delete();
      } catch (_) {}

      final retryOpened = Isar.getInstance(dbName) ?? Isar.getInstance();
      if (retryOpened != null && retryOpened.isOpen) {
        _isar = retryOpened;
        return _isar!;
      }

      _isar = await Isar.open(
        [UserModelSchema],
        directory: dir.path,
        name: dbName,
        inspector: false,
      );
      return _isar!;
    }
  }

  Future<void> cleanDb() async {
    try {
      final isar = await db;
      await isar.writeTxn(() => isar.clear());
    } catch (_) {}
  }
}
