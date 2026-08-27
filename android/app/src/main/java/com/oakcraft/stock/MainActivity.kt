package com.oakcraft.stock

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity(), WebAppBridge.Host {

    private lateinit var root: LinearLayout
    private lateinit var statusScrim: View
    private lateinit var navScrim: View
    private lateinit var content: View
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var web: WebView
    private lateinit var lockView: View

    private lateinit var prefs: Prefs
    private lateinit var store: WebStore
    private lateinit var updater: Updater
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var appLock: AppLock

    private var contentReady = false
    private var locked = false
    private var authInFlight = false
    private var leftAt = 0L
    private var lastBackAt = 0L
    private var askedCameraThisSession = false
    private var updateCheckedThisLaunch = false

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var pendingChooser: (() -> Unit)? = null

    // ------------------------------------------------------------ launchers
    private val scanLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val code = result.data?.getStringExtra(ScannerActivity.EXTRA_CODE)
            if (result.resultCode == RESULT_OK && !code.isNullOrBlank()) {
                jsCall("onScan", code)
            } else {
                jsCall("onScanCancelled")
            }
        }

    private val credentialLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            appLock.onCredentialResult(result.resultCode == RESULT_OK)
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = filePathCallback
            filePathCallback = null
            if (cb == null) return@registerForActivityResult
            var uris: Array<Uri>? = null
            if (result.resultCode == RESULT_OK) {
                val data = result.data
                uris = when {
                    data == null || (data.dataString == null && data.clipData == null) ->
                        cameraPhotoUri?.let { arrayOf(it) }
                    data.clipData != null -> {
                        val clip = data.clipData!!
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    }
                    data.dataString != null -> arrayOf(Uri.parse(data.dataString))
                    else -> null
                }
            }
            cb.onReceiveValue(uris ?: arrayOf())
            cameraPhotoUri = null
        }

    private val cameraPermForChooser =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            val p = pendingChooser
            pendingChooser = null
            p?.invoke()
        }

    // ------------------------------------------------------------ lifecycle
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)

        prefs = Prefs(this)
        store = WebStore(this)
        updater = Updater(this, store)

        setContentView(R.layout.activity_main)
        root = findViewById(R.id.root)
        statusScrim = findViewById(R.id.statusScrim)
        navScrim = findViewById(R.id.navScrim)
        content = findViewById(R.id.content)
        swipe = findViewById(R.id.swipe)
        web = findViewById(R.id.web)
        lockView = findViewById(R.id.lock)

        appLock = AppLock(this, credentialLauncher)
        findViewById<Button>(R.id.lockBtn).setOnClickListener { promptUnlock() }

        splash.setKeepOnScreenCondition { !contentReady }
        web.postDelayed({ contentReady = true }, 4500)

        setupInsets()
        setupWebView()
        setupSwipe()
        setupBack()

        if (prefs.lockEnabled && appLock.available()) {
            locked = true
            lockView.visibility = View.VISIBLE
        }

        web.loadUrl(WebAppPathHandler.BASE + "index.html")
    }

    override fun onStart() {
        super.onStart()
        val awayFor = if (leftAt == 0L) 0L else SystemClock.elapsedRealtime() - leftAt
        if (prefs.lockEnabled && appLock.available() && (locked || awayFor > LOCK_GRACE_MS)) {
            locked = true
            lockView.visibility = View.VISIBLE
            promptUnlock()
        } else if (!prefs.lockEnabled) {
            locked = false
            lockView.visibility = View.GONE
        }
    }

    override fun onPause() {
        super.onPause()
        leftAt = SystemClock.elapsedRealtime()
        if (prefs.lockEnabled && appLock.available() && !authInFlight) {
            lockView.visibility = View.VISIBLE
        }
    }

    override fun onDestroy() {
        runCatching { web.removeJavascriptInterface("AndroidBridge") }
        super.onDestroy()
    }

    // ------------------------------------------------------------ chrome
    private fun setupInsets() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            statusScrim.updateLayoutParams { height = bars.top }
            navScrim.updateLayoutParams { height = maxOf(bars.bottom, ime.bottom) }
            content.setPadding(bars.left, 0, bars.right, 0)
            WindowInsetsCompat.CONSUMED
        }
        val night = (resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = false          // the strip is always dark oak
            isAppearanceLightNavigationBars = !night
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(WebAppPathHandler.DOMAIN)
            .addPathHandler("/", WebAppPathHandler(this, store))
            .build()

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString OakcraftStock/${BuildConfig.VERSION_NAME}"
            // keep the dense billing tables readable without letting a 200% system
            // font setting break the layout
            textZoom = (resources.configuration.fontScale * 100f).toInt().coerceIn(85, 130)
        }

        // The web app ships its own dark theme; stop WebView darkening it a second time.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)
        }

        web.setBackgroundColor(ContextCompat.getColor(this, R.color.app_bg))
        web.isVerticalScrollBarEnabled = true
        web.overScrollMode = View.OVER_SCROLL_NEVER

        web.addJavascriptInterface(WebAppBridge(this, BuildConfig.VERSION_NAME), "AndroidBridge")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url ?: return false
                if (url.host.equals(WebAppPathHandler.DOMAIN, ignoreCase = true)) return false
                openExternal(url.toString())
                return true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                contentReady = true
                if (!updateCheckedThisLaunch) {
                    updateCheckedThisLaunch = true
                    view.postDelayed({ checkForUpdate(false) }, 2500)
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean = showFileChooser(callback, params)

            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                runOnUiThread {
                    val wantsCamera = request.resources.contains(
                        android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE
                    )
                    val granted = ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                    if (wantsCamera && granted) request.grant(request.resources) else request.deny()
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                cb: android.webkit.GeolocationPermissions.Callback?
            ) {
                cb?.invoke(origin, false, false)
            }
        }

        web.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val name = guessName(url, contentDisposition, mimeType)
            when {
                url.startsWith("data:") -> saveDataUrl(url, name, mimeType)
                url.startsWith("blob:") -> jsCall("captureBlobUrl", url, name, mimeType)
                url.startsWith("http") -> openExternal(url)
                else -> toast(getString(R.string.save_failed), false)
            }
        }
    }

    private fun setupSwipe() {
        swipe.setColorSchemeColors(
            ContextCompat.getColor(this, R.color.gold_500),
            ContextCompat.getColor(this, R.color.oak_800)
        )
        swipe.setOnRefreshListener {
            jsCall("onPullRefresh")
            checkForUpdate(false)
            swipe.postDelayed({ swipe.isRefreshing = false }, 900)
        }
        // only allow the gesture when the page is already at the top
        web.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            swipe.isEnabled = scrollY == 0
        }
    }

    private fun setupBack() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (locked) {
                    moveTaskToBack(true)
                    return
                }
                web.evaluateJavascript(
                    "(function(){try{return (window.OakNative && OakNative.back) ? !!OakNative.back() : false}catch(e){return false}})()"
                ) { result ->
                    if (result == "true") return@evaluateJavascript
                    if (web.canGoBack()) {
                        web.goBack()
                    } else {
                        val now = SystemClock.elapsedRealtime()
                        if (now - lastBackAt < 2200) {
                            finishAndRemoveTask()
                        } else {
                            lastBackAt = now
                            toast(getString(R.string.exit_confirm), false)
                        }
                    }
                }
            }
        })
    }

    // ------------------------------------------------------------ file chooser
    private fun showFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams
    ): Boolean {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = callback

        val accept = params.acceptTypes.orEmpty().filter { it.isNotBlank() }
        val wantsImage = accept.isEmpty() || accept.any {
            it.startsWith("image/") || it == "*/*"
        }
        val hasCameraPerm = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

        if (wantsImage && !hasCameraPerm && !askedCameraThisSession) {
            askedCameraThisSession = true
            pendingChooser = { launchChooser(params, accept) }
            return try {
                cameraPermForChooser.launch(Manifest.permission.CAMERA)
                true
            } catch (e: Exception) {
                pendingChooser = null
                launchChooser(params, accept)
            }
        }
        return launchChooser(params, accept)
    }

    private fun launchChooser(
        params: WebChromeClient.FileChooserParams,
        accept: List<String>
    ): Boolean {
        val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (accept.size == 1) accept[0] else "*/*"
            if (accept.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, accept.toTypedArray())
            if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }
        val chooser = Intent.createChooser(pick, getString(R.string.choose_file))

        val wantsImage = accept.isEmpty() || accept.any { it.startsWith("image/") || it == "*/*" }
        if (wantsImage) {
            cameraIntent()?.let { chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(it)) }
        }
        return try {
            fileChooserLauncher.launch(chooser)
            true
        } catch (e: Exception) {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
            false
        }
    }

    private fun cameraIntent(): Intent? {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) return null
        return try {
            val dir = File(cacheDir, "camera").apply { mkdirs() }
            val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
            val uri = Downloads.uriFor(this, file)
            cameraPhotoUri = uri
            Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }.takeIf { it.resolveActivity(packageManager) != null }
        } catch (e: Exception) {
            null
        }
    }

    // ------------------------------------------------------------ bridge host
    override fun printPage() = runOnUiThread {
        try {
            val manager = getSystemService(Context.PRINT_SERVICE) as PrintManager
            val jobName = getString(R.string.app_name)
            val adapter = web.createPrintDocumentAdapter(jobName)
            val attributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build()
            manager.print(jobName, adapter, attributes)
        } catch (e: Exception) {
            toast(getString(R.string.print_failed), false)
        }
    }

    override fun toast(message: String, long: Boolean) = runOnUiThread {
        Toast.makeText(this, message, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
    }

    override fun vibrate(ms: Long) {
        Haptics.tick(this, ms)
    }

    override fun startScan() = runOnUiThread {
        try {
            scanLauncher.launch(Intent(this, ScannerActivity::class.java))
        } catch (e: Exception) {
            toast(getString(R.string.scanner_no_camera), false)
        }
    }

    override fun openExternal(url: String) = runOnUiThread {
        val uri = try {
            Uri.parse(url)
        } catch (e: Exception) {
            null
        }
        if (uri == null) return@runOnUiThread
        val scheme = uri.scheme?.lowercase()
        if (scheme !in ALLOWED_EXTERNAL_SCHEMES) {
            toast(getString(R.string.no_app_for_link), false)
            return@runOnUiThread
        }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            toast(getString(R.string.no_app_for_link), false)
        } catch (e: Exception) {
            toast(getString(R.string.no_app_for_link), false)
        }
    }

    override fun shareText(text: String, subject: String) = runOnUiThread {
        try {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
                if (subject.isNotBlank()) putExtra(Intent.EXTRA_SUBJECT, subject)
            }
            startActivity(Intent.createChooser(send, getString(R.string.share_bill)))
        } catch (e: Exception) {
            toast(getString(R.string.no_app_for_link), false)
        }
    }

    override fun onAppReady() {
        runOnUiThread { contentReady = true }
    }

    override fun applyThemeColor(hex: String, dark: Boolean) = runOnUiThread {
        val bar = runCatching { Color.parseColor(hex) }.getOrNull() ?: return@runOnUiThread
        val page = if (dark) 0xFF14100C.toInt() else 0xFFF7F4EE.toInt()
        statusScrim.setBackgroundColor(bar)
        navScrim.setBackgroundColor(page)
        root.setBackgroundColor(page)
        web.setBackgroundColor(page)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = isLightColour(bar)
            isAppearanceLightNavigationBars = !dark
        }
    }

    override fun onBlob(
        action: String,
        name: String,
        mime: String,
        bytes: ByteArray,
        extra: String
    ): Boolean {
        val meta = runCatching { JSONObject(extra) }.getOrNull() ?: JSONObject()
        when (action) {
            "save" -> {
                val saved = Downloads.save(this, name, mime, bytes)
                if (saved == null) {
                    toast(getString(R.string.save_failed), false)
                    return false
                }
                toast(getString(R.string.saved_to_downloads, saved.displayName), true)
                return true
            }
            "share" -> {
                val uri = Downloads.shareable(this, name, bytes) ?: return false
                shareFile(uri, mime, meta.optString("title"), meta.optString("text"))
                return true
            }
            "pdfshare", "pdfsave" -> {
                val html = String(bytes, Charsets.UTF_8)
                runOnUiThread {
                    val out = File(File(cacheDir, "shared").apply { mkdirs() }, Downloads.safeName(name))
                    PdfMaker.render(this, html, out) { file ->
                        if (file == null) {
                            toast(getString(R.string.pdf_failed), false)
                            return@render
                        }
                        if (action == "pdfsave") {
                            val saved = Downloads.save(this, name, "application/pdf", file.readBytes())
                            if (saved == null) toast(getString(R.string.save_failed), false)
                            else toast(getString(R.string.saved_to_downloads, saved.displayName), true)
                        } else {
                            shareFile(
                                Downloads.uriFor(this, file), "application/pdf",
                                meta.optString("title"), meta.optString("text")
                            )
                        }
                    }
                }
                return true
            }
            else -> return false
        }
    }

    private fun shareFile(uri: Uri, mime: String, title: String, text: String) = runOnUiThread {
        try {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mime.ifBlank { "*/*" }
                putExtra(Intent.EXTRA_STREAM, uri)
                if (title.isNotBlank()) putExtra(Intent.EXTRA_SUBJECT, title)
                if (text.isNotBlank()) putExtra(Intent.EXTRA_TEXT, text)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(send, getString(R.string.share_bill)))
        } catch (e: Exception) {
            toast(getString(R.string.no_app_for_link), false)
        }
    }

    // ------------------------------------------------------------ app lock
    override fun lockAvailable(): Boolean = appLock.available()

    override fun lockEnabled(): Boolean = prefs.lockEnabled

    override fun requestLockChange(enabled: Boolean) = runOnUiThread {
        if (!enabled) {
            authInFlight = true
            appLock.authenticate(
                getString(R.string.lock_prompt_title),
                getString(R.string.lock_off_subtitle)
            ) { ok ->
                authInFlight = false
                if (ok) {
                    prefs.lockEnabled = false
                    locked = false
                    lockView.visibility = View.GONE
                }
                jsCall("onLockChanged", if (prefs.lockEnabled) "1" else "0")
            }
            return@runOnUiThread
        }
        if (!appLock.available()) {
            toast(getString(R.string.lock_needs_screen_lock), true)
            jsCall("onLockChanged", "0")
            return@runOnUiThread
        }
        authInFlight = true
        appLock.authenticate(
            getString(R.string.lock_prompt_confirm),
            getString(R.string.lock_prompt_subtitle)
        ) { ok ->
            authInFlight = false
            if (ok) prefs.lockEnabled = true
            jsCall("onLockChanged", if (prefs.lockEnabled) "1" else "0")
            if (ok) toast(getString(R.string.lock_on), false)
        }
    }

    private fun promptUnlock() {
        if (authInFlight) return
        authInFlight = true
        appLock.authenticate(
            getString(R.string.lock_prompt_title),
            getString(R.string.lock_prompt_subtitle)
        ) { ok ->
            authInFlight = false
            if (ok) {
                locked = false
                lockView.visibility = View.GONE
            }
        }
    }

    // ------------------------------------------------------------ updates
    override fun checkForUpdate(loud: Boolean) {
        val url = prefs.updateUrl
        if (url.isBlank()) {
            if (loud) toast(getString(R.string.update_off), false)
            return
        }
        if (!isOnline()) {
            if (loud) toast(getString(R.string.update_offline), false)
            return
        }
        if (loud) toast(getString(R.string.update_checking), false)
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { updater.check(url) }
            prefs.lastCheckAt = System.currentTimeMillis()
            prefs.lastCheckNote = result.message
            if (result.changed) {
                jsCall("onUpdateReady", result.version)
                if (!loud) toast(getString(R.string.update_ready), true)
            } else if (loud) {
                toast(result.message, true)
            }
        }
    }

    override fun updateInfoJson(): String = try {
        JSONObject().apply {
            put("appVersion", BuildConfig.VERSION_NAME)
            put("webVersion", store.activeVersion())
            put("bundledVersion", store.bundledManifest()?.optString("version", "").orEmpty())
            put("usingDownloaded", store.liveManifest() != null)
            put("url", prefs.updateUrl)
            put("lastCheckAt", prefs.lastCheckAt)
            put("lastNote", prefs.lastCheckNote)
            put("online", isOnline())
        }.toString()
    } catch (e: Exception) {
        "{}"
    }

    override fun setUpdateUrl(url: String) {
        prefs.updateUrl = url
        toast(getString(R.string.update_url_saved), false)
    }

    override fun syncConfigJson(): String = try {
        val url = BuildConfig.SYNC_URL
        val token = BuildConfig.SYNC_TOKEN
        if (url.isBlank() || token.isBlank()) {
            "{}"
        } else {
            JSONObject().apply {
                put("url", url)
                put("token", token)
                put("locked", true)
            }.toString()
        }
    } catch (e: Exception) {
        "{}"
    }

    override fun resetWebFiles() {
        val ok = store.resetToBundled()
        runOnUiThread {
            toast(
                getString(if (ok) R.string.update_reset_ok else R.string.update_reset_fail),
                true
            )
            if (ok) web.postDelayed({ web.loadUrl(WebAppPathHandler.BASE + "index.html") }, 700)
        }
    }

    override fun exitApp() {
        runOnUiThread { finishAndRemoveTask() }
    }

    // ------------------------------------------------------------ helpers
    private fun jsCall(fn: String, vararg args: String) = runOnUiThread {
        val quoted = args.joinToString(",") { JSONObject.quote(it) }
        val js = "(function(){try{ if(window.OakNative && OakNative.$fn) OakNative.$fn($quoted); }catch(e){}})()"
        try {
            web.evaluateJavascript(js, null)
        } catch (e: Exception) {
            // the page may not be loaded yet — nothing to do
        }
    }

    private fun saveDataUrl(url: String, name: String, mime: String) {
        try {
            val comma = url.indexOf(',')
            if (comma < 0) return
            val head = url.substring(5, comma)
            val body = url.substring(comma + 1)
            val bytes = if (head.contains("base64")) {
                android.util.Base64.decode(body, android.util.Base64.DEFAULT)
            } else {
                Uri.decode(body).toByteArray(Charsets.UTF_8)
            }
            val realMime = head.substringBefore(';').ifBlank { mime }
            val saved = Downloads.save(this, name, realMime, bytes)
            if (saved == null) toast(getString(R.string.save_failed), false)
            else toast(getString(R.string.saved_to_downloads, saved.displayName), true)
        } catch (e: Exception) {
            toast(getString(R.string.save_failed), false)
        }
    }

    private fun guessName(url: String, contentDisposition: String?, mime: String?): String {
        val guessed = try {
            android.webkit.URLUtil.guessFileName(url, contentDisposition, mime)
        } catch (e: Exception) {
            null
        }
        return Downloads.safeName(guessed ?: "oakcraft-file")
    }

    private fun isOnline(): Boolean = try {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    } catch (e: Exception) {
        false
    }

    private fun isLightColour(colour: Int): Boolean {
        val r = Color.red(colour)
        val g = Color.green(colour)
        val b = Color.blue(colour)
        return (0.299 * r + 0.587 * g + 0.114 * b) > 160
    }

    private companion object {
        const val LOCK_GRACE_MS = 60_000L
        val ALLOWED_EXTERNAL_SCHEMES = setOf("http", "https", "tel", "mailto", "sms", "whatsapp", "upi", "geo")
    }
}
