package com.oakcraft.stock

import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * The `AndroidBridge` object the web app sees.
 *
 * Everything here is called from the WebView's JavaScript thread, so the host
 * implementation is responsible for hopping to the main thread before touching UI.
 *
 * Files move web -> native through a small chunked channel rather than one giant
 * string, because a JavaScript-interface call is a Binder transaction and a whole
 * backup would blow past its ~1 MB limit.
 */
class WebAppBridge(private val host: Host, private val versionName: String) {

    interface Host {
        fun printPage()
        fun toast(message: String, long: Boolean)
        fun startScan()
        fun openExternal(url: String)
        fun shareText(text: String, subject: String)
        fun onAppReady()
        fun applyThemeColor(hex: String, dark: Boolean)
        /** @return true when the payload was accepted */
        fun onBlob(action: String, name: String, mime: String, bytes: ByteArray, extra: String): Boolean
        fun lockAvailable(): Boolean
        fun lockEnabled(): Boolean
        fun requestLockChange(enabled: Boolean)
        fun checkForUpdate(loud: Boolean)
        fun updateInfoJson(): String
        fun setUpdateUrl(url: String)
        fun resetWebFiles()
        fun exitApp()
        fun vibrate(ms: Long)
    }

    private class Pending(val name: String, val mime: String) {
        val out = ByteArrayOutputStream()
        var size = 0L
    }

    private val blobs = ConcurrentHashMap<String, Pending>()
    private val seq = AtomicLong(0)

    // ---------------------------------------------------------------- identity
    @JavascriptInterface fun isApp(): Boolean = true
    @JavascriptInterface fun platform(): String = "android"
    @JavascriptInterface fun appVersion(): String = versionName

    // ---------------------------------------------------------------- printing
    /** Called by the existing UI.print() path in assets/js/ui.js. */
    @JavascriptInterface fun printPage() = host.printPage()

    // ---------------------------------------------------------------- basics
    @JavascriptInterface fun toast(message: String) = host.toast(message, false)
    @JavascriptInterface fun toastLong(message: String) = host.toast(message, true)
    @JavascriptInterface fun vibrate(ms: Int) = host.vibrate(ms.toLong().coerceIn(0L, 400L))
    @JavascriptInterface fun openExternal(url: String) = host.openExternal(url)
    @JavascriptInterface fun shareText(text: String, subject: String) = host.shareText(text, subject)
    @JavascriptInterface fun appReady() = host.onAppReady()
    @JavascriptInterface fun setThemeColor(hex: String, dark: Boolean) = host.applyThemeColor(hex, dark)
    @JavascriptInterface fun exitApp() = host.exitApp()

    // ---------------------------------------------------------------- scanning
    @JavascriptInterface fun scan() = host.startScan()

    // ---------------------------------------------------------------- app lock
    @JavascriptInterface fun lockAvailable(): Boolean = host.lockAvailable()
    @JavascriptInterface fun lockEnabled(): Boolean = host.lockEnabled()
    @JavascriptInterface fun setLockEnabled(enabled: Boolean) = host.requestLockChange(enabled)

    // ---------------------------------------------------------------- updates
    @JavascriptInterface fun checkForUpdate() = host.checkForUpdate(true)
    @JavascriptInterface fun updateInfo(): String = host.updateInfoJson()
    @JavascriptInterface fun setUpdateUrl(url: String) = host.setUpdateUrl(url)
    @JavascriptInterface fun resetWebFiles() = host.resetWebFiles()

    // ---------------------------------------------------------------- file channel
    @JavascriptInterface
    fun blobBegin(name: String, mime: String): String {
        if (blobs.size > 6) return ""
        val id = "oak-" + seq.incrementAndGet()
        blobs[id] = Pending(name, mime)
        return id
    }

    @JavascriptInterface
    fun blobChunk(id: String, base64: String): Boolean {
        val p = blobs[id] ?: return false
        return try {
            val raw = Base64.decode(base64, Base64.DEFAULT)
            if (p.size + raw.size > MAX_BYTES) {
                blobs.remove(id)
                false
            } else {
                p.out.write(raw)
                p.size += raw.size
                true
            }
        } catch (e: Exception) {
            blobs.remove(id)
            false
        }
    }

    /**
     * @param action one of "save", "share", "pdfshare", "pdfsave"
     * @param extra  JSON with optional "title" / "text" for share sheets
     */
    @JavascriptInterface
    fun blobEnd(id: String, action: String, extra: String): Boolean {
        val p = blobs.remove(id) ?: return false
        return try {
            host.onBlob(action, p.name, p.mime, p.out.toByteArray(), extra)
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun blobAbort(id: String) {
        blobs.remove(id)
    }

    private companion object {
        const val MAX_BYTES = 48L * 1024 * 1024
    }
}
