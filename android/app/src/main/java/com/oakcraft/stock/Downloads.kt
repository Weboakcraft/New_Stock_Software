package com.oakcraft.stock

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File

/** Saves a file the web app produced into the phone's Downloads folder. */
object Downloads {

    data class Saved(val uri: Uri, val displayName: String)

    fun save(context: Context, fileName: String, mimeType: String, bytes: ByteArray): Saved? {
        val name = safeName(fileName)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(context, name, mimeType, bytes)
        } else {
            saveLegacy(context, name, bytes)
        }
    }

    private fun saveViaMediaStore(context: Context, name: String, mime: String, bytes: ByteArray): Saved? {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime.ifBlank { "application/octet-stream" })
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
        return try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return null
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            Saved(uri, name)
        } catch (e: Exception) {
            runCatching { resolver.delete(uri, null, null) }
            null
        }
    }

    private fun saveLegacy(context: Context, name: String, bytes: ByteArray): Saved? = try {
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        dir.mkdirs()
        val file = unique(dir, name)
        file.writeBytes(bytes)
        MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), null, null)
        Saved(Uri.fromFile(file), file.name)
    } catch (e: Exception) {
        null
    }

    /** A copy inside cache/shared/ that other apps are allowed to read, for sharing. */
    fun shareable(context: Context, fileName: String, bytes: ByteArray): Uri? = try {
        val dir = File(context.cacheDir, "shared")
        dir.mkdirs()
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 6 * 60 * 60 * 1000L }
            ?.forEach { it.delete() }
        val file = File(dir, safeName(fileName))
        file.writeBytes(bytes)
        uriFor(context, file)
    } catch (e: Exception) {
        null
    }

    fun uriFor(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)

    fun openIntent(context: Context, uri: Uri, mime: String): Intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mime.ifBlank { "*/*" })
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    private fun unique(dir: File, name: String): File {
        var f = File(dir, name)
        if (!f.exists()) return f
        val dot = name.lastIndexOf('.')
        val stem = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 1
        while (f.exists() && i < 500) {
            f = File(dir, "$stem ($i)$ext")
            i++
        }
        return f
    }

    fun safeName(raw: String): String {
        val cleaned = raw.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[^A-Za-z0-9._\\-() ]"), "_")
            .trim()
            .take(120)
        return cleaned.ifBlank { "oakcraft-file" }
    }
}
