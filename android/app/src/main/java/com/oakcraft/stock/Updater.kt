package com.oakcraft.stock

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Pulls newer web files from the published website into the phone.
 *
 * Only files whose SHA-256 differs from the copy inside the APK are stored, every
 * download is verified against the hash in the manifest before it is kept, and the
 * new set is swapped in as a whole — so an interrupted update leaves the previous
 * version running untouched.
 */
class Updater(private val context: Context, private val store: WebStore) {

    data class Result(
        val ok: Boolean,
        val changed: Boolean,
        val version: String,
        val message: String
    )

    fun check(baseUrlRaw: String, force: Boolean = false): Result {
        val active = store.activeVersion()
        val base = baseUrlRaw.trim().trimEnd('/')
        if (base.isEmpty()) return Result(false, false, active, "Auto-update is switched off")

        val manifestUrl = try {
            URL("$base/version.json")
        } catch (e: Exception) {
            return Result(false, false, active, "That update address is not a valid link")
        }
        if (!manifestUrl.protocol.equals("https", true)) {
            return Result(false, false, active, "The update address must start with https://")
        }

        val text = fetchText(manifestUrl)
            ?: return Result(false, false, active, "Could not reach $base")

        val remote = try {
            JSONObject(text)
        } catch (e: Exception) {
            return Result(false, false, active, "That address did not return an Oakcraft version file")
        }

        val remoteVersion = remote.optString("version", "")
        val files = remote.optJSONArray("files")
        if (remoteVersion.isEmpty() || files == null || files.length() == 0) {
            return Result(false, false, active, "That address did not return an Oakcraft version file")
        }
        if (files.length() > MAX_FILES) {
            return Result(false, false, active, "The update looks wrong (too many files) — nothing was changed")
        }
        if (remoteVersion == active) {
            return Result(true, false, active, "Already up to date")
        }

        val remoteBuiltAt = remote.optLong("builtAt", 0L)
        val activeBuiltAt = store.activeBuiltAt()
        if (!force && remoteBuiltAt in 1 until activeBuiltAt) {
            return Result(true, false, active, "This app is already newer than the website")
        }

        val bundled = store.bundledShas()

        // Work out what has to be fetched, and reject anything oversized up front.
        var totalBytes = 0L
        val wanted = ArrayList<Triple<String, String, Long>>() // path, sha, bytes
        for (i in 0 until files.length()) {
            val o = files.optJSONObject(i) ?: continue
            val path = o.optString("path", "").trimStart('/')
            val sha = o.optString("sha256", "").lowercase()
            val bytes = o.optLong("bytes", 0L)
            if (path.isEmpty() || sha.length != 64 || path.contains("..") || path.startsWith("/")) {
                return Result(false, false, active, "The update contains an unsafe file name — nothing was changed")
            }
            if (bytes > MAX_FILE_BYTES) {
                return Result(false, false, active, "The update contains a file that is too large — nothing was changed")
            }
            totalBytes += bytes
            wanted.add(Triple(path, sha, bytes))
        }
        if (totalBytes > MAX_TOTAL_BYTES) {
            return Result(false, false, active, "The update is too large — nothing was changed")
        }

        val stage = store.stageDir
        stage.deleteRecursively()
        if (!stage.mkdirs()) return Result(false, false, active, "No room on the phone for the update")

        var downloaded = 0
        try {
            for ((path, sha, _) in wanted) {
                // A file that is byte-identical to the one inside the APK needs no overlay copy.
                if (bundled[path] == sha) continue

                val existing = store.overlayFile(path)
                val target = File(stage, path)
                target.parentFile?.mkdirs()

                if (existing != null && WebStore.sha256(existing) == sha) {
                    existing.copyTo(target, overwrite = true)
                    continue
                }

                val fileUrl = try {
                    URL("$base/$path")
                } catch (e: Exception) {
                    return fail(stage, active, "The update address is not valid")
                }
                if (!fileUrl.protocol.equals("https", true) || fileUrl.host != manifestUrl.host) {
                    return fail(stage, active, "The update tried to load a file from somewhere else — nothing was changed")
                }

                val bytes = fetchBytes(fileUrl)
                    ?: return fail(stage, active, "The download stopped part-way — nothing was changed")
                if (WebStore.sha256(bytes) != sha) {
                    return fail(stage, active, "A downloaded file did not match its checksum — nothing was changed")
                }
                target.writeBytes(bytes)
                downloaded++
            }

            File(stage, "version.json").writeText(text, Charsets.UTF_8)

            // Swap the whole set in at once.
            val old = store.oldDir
            old.deleteRecursively()
            val live = store.liveDir
            if (live.exists() && !live.renameTo(old)) {
                live.deleteRecursively()
            }
            if (!stage.renameTo(live)) {
                old.renameTo(live)   // put the previous set back
                return fail(stage, active, "Could not install the update — nothing was changed")
            }
            old.deleteRecursively()
        } catch (e: Exception) {
            return fail(stage, active, "Could not install the update (${e.javaClass.simpleName})")
        }

        return Result(
            true, true, remoteVersion,
            if (downloaded == 0) "Updated to $remoteVersion"
            else "Updated to $remoteVersion ($downloaded file${if (downloaded == 1) "" else "s"})"
        )
    }

    private fun fail(stage: File, version: String, message: String): Result {
        stage.deleteRecursively()
        return Result(false, false, version, message)
    }

    private fun open(url: URL): HttpURLConnection {
        val c = url.openConnection() as HttpURLConnection
        c.connectTimeout = TIMEOUT
        c.readTimeout = TIMEOUT
        c.instanceFollowRedirects = true
        c.useCaches = false
        c.setRequestProperty("Cache-Control", "no-cache")
        c.setRequestProperty("User-Agent", "OakcraftStock/${BuildConfig.VERSION_NAME}")
        return c
    }

    private fun fetchText(url: URL): String? = fetchBytes(url)?.toString(Charsets.UTF_8)

    private fun fetchBytes(url: URL): ByteArray? {
        var conn: HttpURLConnection? = null
        return try {
            conn = open(url)
            if (conn.responseCode !in 200..299) return null
            conn.inputStream.use { ins ->
                val out = java.io.ByteArrayOutputStream()
                val buf = ByteArray(16384)
                var total = 0L
                while (true) {
                    val n = ins.read(buf)
                    if (n <= 0) break
                    total += n
                    if (total > MAX_FILE_BYTES) return null
                    out.write(buf, 0, n)
                }
                out.toByteArray()
            }
        } catch (e: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private companion object {
        const val TIMEOUT = 20_000
        const val MAX_FILES = 500
        const val MAX_FILE_BYTES = 8L * 1024 * 1024
        const val MAX_TOTAL_BYTES = 48L * 1024 * 1024
    }
}
