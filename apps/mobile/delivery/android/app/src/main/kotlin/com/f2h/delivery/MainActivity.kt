package com.f2h.delivery

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {

    private var playIntegrity: PlayIntegrityPlugin? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Registered alongside the generated plugins so the Dart
        // PlayIntegrityService has a channel to talk to from first frame.
        playIntegrity = PlayIntegrityPlugin(
            applicationContext,
            flutterEngine.dartExecutor.binaryMessenger,
        ).also { it.register() }
    }

    override fun onDestroy() {
        playIntegrity?.dispose()
        playIntegrity = null
        super.onDestroy()
    }
}
