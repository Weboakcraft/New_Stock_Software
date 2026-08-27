package com.oakcraft.stock

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * Fingerprint / face / screen-lock gate for the app.
 *
 * Nothing is stored by us: the phone's own keyguard does the checking, so there is
 * no PIN of ours to leak. Biometrics are offered when they are enrolled, with the
 * device screen lock always available as the fallback.
 */
class AppLock(
    private val activity: FragmentActivity,
    private val credentialLauncher: ActivityResultLauncher<Intent>
) {

    private var pending: ((Boolean) -> Unit)? = null

    private val keyguard: KeyguardManager?
        get() = activity.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager

    /** True when this phone can lock the app at all (a screen lock or biometric is set up). */
    fun available(): Boolean {
        if (keyguard?.isDeviceSecure == true) return true
        return BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun authenticate(title: String, subtitle: String, onResult: (Boolean) -> Unit) {
        val hasBiometric = BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS

        if (!hasBiometric) {
            launchCredential(title, onResult)
            return
        }

        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onResult(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    when (errorCode) {
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_NO_BIOMETRICS,
                        BiometricPrompt.ERROR_HW_NOT_PRESENT,
                        BiometricPrompt.ERROR_HW_UNAVAILABLE,
                        BiometricPrompt.ERROR_LOCKOUT,
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> launchCredential(title, onResult)
                        else -> onResult(false)
                    }
                }
            }
        )

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .setNegativeButtonText(activity.getString(R.string.lock_use_screen_lock))
            .setConfirmationRequired(false)
            .build()

        try {
            prompt.authenticate(info)
        } catch (e: Exception) {
            launchCredential(title, onResult)
        }
    }

    private fun launchCredential(title: String, onResult: (Boolean) -> Unit) {
        val km = keyguard
        if (km == null || !km.isDeviceSecure) {
            onResult(false)
            return
        }
        @Suppress("DEPRECATION")
        val intent: Intent? = km.createConfirmDeviceCredentialIntent(
            title, activity.getString(R.string.lock_prompt_subtitle)
        )
        if (intent == null) {
            onResult(false)
            return
        }
        pending = onResult
        try {
            credentialLauncher.launch(intent)
        } catch (e: Exception) {
            pending = null
            onResult(false)
        }
    }

    fun onCredentialResult(ok: Boolean) {
        val cb = pending
        pending = null
        cb?.invoke(ok)
    }
}
