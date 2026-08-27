package com.oakcraft.stock

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Size
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Full-screen camera barcode scanner. Returns the code in the "code" extra. */
class ScannerActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var executor: ExecutorService
    private var camera: androidx.camera.core.Camera? = null
    private var torchOn = false
    private var handled = false

    private val scanner by lazy {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                    Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39, Barcode.FORMAT_CODE_93,
                    Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A,
                    Barcode.FORMAT_UPC_E, Barcode.FORMAT_ITF, Barcode.FORMAT_CODABAR,
                    Barcode.FORMAT_QR_CODE, Barcode.FORMAT_DATA_MATRIX
                )
                .build()
        )
    }

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) start() else {
            Toast.makeText(this, R.string.scanner_no_permission, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scanner)
        previewView = findViewById(R.id.preview)
        executor = Executors.newSingleThreadExecutor()

        findViewById<Button>(R.id.closeBtn).setOnClickListener { finish() }
        findViewById<Button>(R.id.torchBtn).setOnClickListener {
            torchOn = !torchOn
            camera?.cameraControl?.enableTorch(torchOn)
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            start()
        } else {
            askCamera.launch(Manifest.permission.CAMERA)
        }
    }

    private fun start() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = try {
                future.get()
            } catch (e: Exception) {
                Toast.makeText(this, R.string.scanner_no_camera, Toast.LENGTH_LONG).show()
                finish()
                return@addListener
            }

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            @Suppress("DEPRECATION")
            val analysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor) { proxy -> analyse(proxy) }

            try {
                provider.unbindAll()
                camera = provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis
                )
            } catch (e: Exception) {
                Toast.makeText(this, R.string.scanner_no_camera, Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun analyse(proxy: ImageProxy) {
        if (handled) {
            proxy.close()
            return
        }
        val bitmap = try {
            proxy.toBitmap()
        } catch (e: Throwable) {
            null
        }
        if (bitmap == null) {
            proxy.close()
            return
        }
        val image = InputImage.fromBitmap(bitmap, proxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { codes ->
                val value = codes.firstOrNull { !it.rawValue.isNullOrBlank() }?.rawValue
                if (!value.isNullOrBlank()) deliver(value)
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun deliver(code: String) {
        if (handled) return
        handled = true
        runOnUiThread {
            Haptics.tick(this)
            setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_CODE, code))
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (this::executor.isInitialized) executor.shutdown()
        runCatching { scanner.close() }
    }

    companion object {
        const val EXTRA_CODE = "code"
    }
}
