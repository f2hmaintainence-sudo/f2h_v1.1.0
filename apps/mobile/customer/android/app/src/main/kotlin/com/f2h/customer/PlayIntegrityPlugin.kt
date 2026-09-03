// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : PlayIntegrityPlugin.kt
// Description : Android bridge to the official Google Play Integrity API
//               (com.google.android.play:integrity), Standard request flow.
//
//               The Standard API is used rather than the Classic one because
//               the protected F2H operations are ordinary user actions that
//               happen many times in a session. Standard is what Google built
//               for that: one expensive warm-up produces a
//               StandardIntegrityTokenProvider, and every later token request
//               off that provider is cheap.
//
//               The provider is the ONLY thing cached, and only for the
//               lifetime Google documents (about an hour). Tokens themselves
//               are never cached or reused — each protected request mints a
//               fresh token bound to that request's hash.
//
//               Nothing secret lives here. The Cloud project NUMBER is public;
//               the service-account credential that decrypts these tokens
//               exists only on the F2H API server.
// ============================================================================

package com.f2h.customer

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityToken
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel

/**
 * MethodChannel surface:
 *   warmUp(cloudProjectNumber: String) -> Boolean
 *   requestToken(requestHash: String)  -> String   (the integrity token)
 *   isWarm()                           -> Boolean
 *
 * Failures come back as MethodChannel errors whose code is one of the
 * PLAY_INTEGRITY_* values below, so the Dart layer can tell "retry after a
 * re-warm" from "this device simply cannot produce a token".
 */
class PlayIntegrityPlugin(
    private val context: Context,
    messenger: BinaryMessenger,
) {

    companion object {
        const val CHANNEL = "com.f2h.security/play_integrity"

        private const val ERR_UNAVAILABLE = "PLAY_INTEGRITY_UNAVAILABLE"
        private const val ERR_NOT_WARMED = "PLAY_INTEGRITY_NOT_WARMED"
        private const val ERR_BAD_ARGUMENT = "PLAY_INTEGRITY_BAD_ARGUMENT"
        private const val ERR_REQUEST_FAILED = "PLAY_INTEGRITY_REQUEST_FAILED"

        /**
         * Google documents a prepared provider as good for roughly an hour.
         * Expiring it early avoids racing the real expiry mid-checkout.
         */
        private const val PROVIDER_TTL_MILLIS = 50L * 60L * 1000L
    }

    private val channel = MethodChannel(messenger, CHANNEL)
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var tokenProvider: StandardIntegrityTokenProvider? = null
    @Volatile private var providerPreparedAt: Long = 0L
    @Volatile private var preparedForProject: Long? = null

    fun register() {
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "warmUp" -> warmUp(call.argument<String>("cloudProjectNumber"), result)
                "requestToken" -> requestToken(call.argument<String>("requestHash"), result)
                "isWarm" -> result.success(isProviderFresh())
                else -> result.notImplemented()
            }
        }
    }

    fun dispose() {
        channel.setMethodCallHandler(null)
        tokenProvider = null
    }

    private fun isProviderFresh(): Boolean =
        tokenProvider != null &&
            (System.currentTimeMillis() - providerPreparedAt) < PROVIDER_TTL_MILLIS

    // ── Warm-up ──────────────────────────────────────────────────────────────

    private fun warmUp(rawProjectNumber: String?, result: MethodChannel.Result) {
        val projectNumber = rawProjectNumber?.trim()?.toLongOrNull()
        if (projectNumber == null || projectNumber <= 0L) {
            result.error(ERR_BAD_ARGUMENT, "cloudProjectNumber must be a positive number", null)
            return
        }

        if (isProviderFresh() && preparedForProject == projectNumber) {
            result.success(true)
            return
        }

        try {
            IntegrityManagerFactory.createStandard(context.applicationContext)
                .prepareIntegrityToken(
                    PrepareIntegrityTokenRequest.builder()
                        .setCloudProjectNumber(projectNumber)
                        .build()
                )
                .addOnSuccessListener { provider ->
                    tokenProvider = provider
                    providerPreparedAt = System.currentTimeMillis()
                    preparedForProject = projectNumber
                    mainHandler.post { result.success(true) }
                }
                .addOnFailureListener { error ->
                    tokenProvider = null
                    // Play Services or the Play Store is absent, the device is
                    // too old, or Google is unreachable. Not fatal — the Dart
                    // layer degrades to sending no token.
                    mainHandler.post { result.error(ERR_UNAVAILABLE, describe(error), null) }
                }
        } catch (error: Throwable) {
            tokenProvider = null
            result.error(ERR_UNAVAILABLE, describe(error), null)
        }
    }

    // ── Per-request token ────────────────────────────────────────────────────

    private fun requestToken(requestHash: String?, result: MethodChannel.Result) {
        if (requestHash.isNullOrBlank()) {
            result.error(ERR_BAD_ARGUMENT, "requestHash is required", null)
            return
        }

        val provider = tokenProvider
        if (provider == null || !isProviderFresh()) {
            // Tell Dart to warm up again rather than failing silently.
            tokenProvider = null
            result.error(ERR_NOT_WARMED, "integrity token provider is not prepared", null)
            return
        }

        try {
            provider
                .request(
                    StandardIntegrityTokenRequest.builder()
                        .setRequestHash(requestHash)
                        .build()
                )
                .addOnSuccessListener { token: StandardIntegrityToken ->
                    mainHandler.post { result.success(token.token()) }
                }
                .addOnFailureListener { error ->
                    mainHandler.post { result.error(ERR_REQUEST_FAILED, describe(error), null) }
                }
        } catch (error: Throwable) {
            result.error(ERR_REQUEST_FAILED, describe(error), null)
        }
    }

    /** Message only — never the token, never anything user-identifying. */
    private fun describe(error: Throwable): String =
        error.message?.take(200) ?: error.javaClass.simpleName
}
