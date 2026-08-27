package com.oakcraft.stock

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File
import java.io.FileOutputStream
import kotlin.math.ceil
import kotlin.math.max

/**
 * Turns a bill's print HTML into a real PDF.
 *
 * The HTML is laid out in an off-screen WebView at A4 width and then drawn onto
 * PDF pages, so the text stays selectable vector text rather than a screenshot.
 * Must be called on the main thread.
 */
object PdfMaker {

    private const val PAGE_W_PT = 595      // A4 at 72 dpi
    private const val PAGE_H_PT = 842
    private const val RENDER_W_PX = 1190   // ~150 dpi A4 width — crisp without being huge
    private const val MAX_HEIGHT_PX = 60_000

    @SuppressLint("SetJavaScriptEnabled")
    fun render(context: Context, html: String, out: File, done: (File?) -> Unit) {
        val web = WebView(context)
        web.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        web.setBackgroundColor(Color.WHITE)
        web.settings.javaScriptEnabled = false
        web.settings.loadWithOverviewMode = false
        web.settings.useWideViewPort = false
        web.settings.blockNetworkLoads = true          // bills only ever use inline data: images
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false

        var finished = false
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (finished) return
                finished = true
                // one more frame so web fonts and data: images have painted
                view.postDelayed({
                    val file = try {
                        draw(view, out)
                    } catch (e: Throwable) {
                        null
                    }
                    view.destroy()
                    done(file)
                }, 450)
            }
        }

        web.loadDataWithBaseURL(WebAppPathHandler.BASE, html, "text/html", "utf-8", null)
    }

    private fun draw(web: WebView, out: File): File? {
        web.measure(
            View.MeasureSpec.makeMeasureSpec(RENDER_W_PX, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        val height = max(web.measuredHeight, 1).coerceAtMost(MAX_HEIGHT_PX)
        web.layout(0, 0, RENDER_W_PX, height)

        val scale = PAGE_W_PT.toFloat() / RENDER_W_PX
        val pageHeightPx = (PAGE_H_PT / scale).toInt().coerceAtLeast(1)
        val pageCount = ceil(height.toFloat() / pageHeightPx).toInt().coerceIn(1, 200)

        val doc = PdfDocument()
        try {
            for (i in 0 until pageCount) {
                val info = PdfDocument.PageInfo.Builder(PAGE_W_PT, PAGE_H_PT, i + 1).create()
                val page = doc.startPage(info)
                val canvas = page.canvas
                canvas.drawColor(Color.WHITE)
                canvas.save()
                canvas.scale(scale, scale)
                canvas.translate(0f, -(i.toFloat() * pageHeightPx))
                web.draw(canvas)
                canvas.restore()
                doc.finishPage(page)
            }
            out.parentFile?.mkdirs()
            FileOutputStream(out).use { doc.writeTo(it) }
        } finally {
            doc.close()
        }
        return if (out.length() > 0) out else null
    }
}
