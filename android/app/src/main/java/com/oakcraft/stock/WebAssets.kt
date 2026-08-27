package com.oakcraft.stock

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.FileInputStream
import java.util.Locale

/**
 * Serves the web app over https://appassets.androidplatform.net/.
 *
 * Using a real https origin (rather than file://) is what keeps IndexedDB, the
 * clipboard and getUserMedia working — WebView treats the loader's domain as a
 * secure context, and the origin never changes, so the shop's data survives every
 * app update.
 */
class WebAppPathHandler(
    context: Context,
    private val store: WebStore
) : WebViewAssetLoader.PathHandler {

    private val fromApk = WebViewAssetLoader.AssetsPathHandler(context)

    override fun handle(path: String): WebResourceResponse? {
        var rel = path.trimStart('/')
        if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html"
        if (rel.contains("..")) return null

        store.overlayFile(rel)?.let { f ->
            return try {
                WebResourceResponse(mimeOf(rel), "utf-8", FileInputStream(f)).apply {
                    responseHeaders = noStoreHeaders()
                }
            } catch (e: Exception) {
                null
            }
        }
        return fromApk.handle("web/$rel")
    }

    private fun noStoreHeaders(): MutableMap<String, String> = mutableMapOf(
        "Cache-Control" to "no-cache",
        "Access-Control-Allow-Origin" to "*"
    )

    companion object {
        const val DOMAIN = "appassets.androidplatform.net"
        const val BASE = "https://$DOMAIN/"

        fun mimeOf(path: String): String {
            val p = path.lowercase(Locale.ROOT)
            return when {
                p.endsWith(".html") || p.endsWith(".htm") -> "text/html"
                p.endsWith(".js") || p.endsWith(".mjs") -> "application/javascript"
                p.endsWith(".css") -> "text/css"
                p.endsWith(".json") -> "application/json"
                p.endsWith(".webmanifest") -> "application/manifest+json"
                p.endsWith(".svg") -> "image/svg+xml"
                p.endsWith(".png") -> "image/png"
                p.endsWith(".jpg") || p.endsWith(".jpeg") -> "image/jpeg"
                p.endsWith(".gif") -> "image/gif"
                p.endsWith(".webp") -> "image/webp"
                p.endsWith(".ico") -> "image/x-icon"
                p.endsWith(".woff2") -> "font/woff2"
                p.endsWith(".woff") -> "font/woff"
                p.endsWith(".ttf") -> "font/ttf"
                p.endsWith(".txt") || p.endsWith(".gs") || p.endsWith(".md") -> "text/plain"
                else -> "application/octet-stream"
            }
        }
    }
}
