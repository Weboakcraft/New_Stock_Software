package com.oakcraft.stock

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Decides which copy of the web app the WebView reads.
 *
 * The APK always carries a complete copy under `assets/web/`. An over-the-air
 * update writes only the files that actually differ into `filesDir/weblive/`,
 * next to the manifest they came from. Every read checks the overlay first and
 * falls back to the APK, so a partial or abandoned update can never leave the
 * app with a missing file.
 */
class WebStore(private val context: Context) {

    val liveDir: File get() = File(context.filesDir, "weblive")
    val stageDir: File get() = File(context.filesDir, "weblive-new")
    val oldDir: File get() = File(context.filesDir, "weblive-old")

    /** The overlay copy of [relPath], or null when the APK copy should be used. */
    fun overlayFile(relPath: String): File? {
        if (relPath.isEmpty() || relPath.contains("..")) return null
        return try {
            val root = liveDir.canonicalFile
            val f = File(liveDir, relPath).canonicalFile
            if (f.path == root.path || !f.path.startsWith(root.path + File.separator)) null
            else if (f.isFile) f else null
        } catch (e: Exception) {
            null
        }
    }

    fun bundledManifest(): JSONObject? = try {
        context.assets.open("web/version.json").use {
            JSONObject(String(it.readBytes(), Charsets.UTF_8))
        }
    } catch (e: Exception) {
        null
    }

    fun liveManifest(): JSONObject? = try {
        val f = File(liveDir, "version.json")
        if (f.isFile) JSONObject(f.readText(Charsets.UTF_8)) else null
    } catch (e: Exception) {
        null
    }

    /** The manifest describing what is actually being served right now. */
    fun activeManifest(): JSONObject? = liveManifest() ?: bundledManifest()

    fun activeVersion(): String = activeManifest()?.optString("version", "").orEmpty()

    fun activeBuiltAt(): Long = activeManifest()?.optLong("builtAt", 0L) ?: 0L

    fun bundledShas(): Map<String, String> = shasOf(bundledManifest())

    /** Throws away a downloaded overlay and goes back to the copy inside the APK. */
    fun resetToBundled(): Boolean {
        return try {
            liveDir.deleteRecursively()
            stageDir.deleteRecursively()
            oldDir.deleteRecursively()
            true
        } catch (e: Exception) {
            false
        }
    }

    companion object {
        fun shasOf(manifest: JSONObject?): Map<String, String> {
            val out = HashMap<String, String>()
            val files = manifest?.optJSONArray("files") ?: return out
            for (i in 0 until files.length()) {
                val o = files.optJSONObject(i) ?: continue
                val p = o.optString("path", "")
                val s = o.optString("sha256", "")
                if (p.isNotEmpty() && s.isNotEmpty()) out[p] = s.lowercase()
            }
            return out
        }

        fun sha256(file: File): String = try {
            val md = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { ins ->
                val buf = ByteArray(16384)
                while (true) {
                    val n = ins.read(buf)
                    if (n <= 0) break
                    md.update(buf, 0, n)
                }
            }
            md.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }

        fun sha256(bytes: ByteArray): String = try {
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }
    }
}
