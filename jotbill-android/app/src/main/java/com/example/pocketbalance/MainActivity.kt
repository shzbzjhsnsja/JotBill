package com.example.jotbill

import android.app.DownloadManager
import android.content.Intent
import android.graphics.Color
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.util.Base64
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient // 【关键修改】使用原生 WebViewClient，不要 Compat
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.android.gms.tasks.Tasks
import org.json.JSONObject
import java.util.concurrent.Executors
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import javax.net.ssl.HostnameVerifier
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.io.File
import java.io.FileOutputStream
import android.content.ContentValues
import android.provider.MediaStore
import android.os.Build

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val ocrExecutor = Executors.newSingleThreadExecutor()
    private val davExecutor = Executors.newSingleThreadExecutor()

    private var filePickerCallback: ValueCallback<Array<Uri>>? = null
    private val filePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePickerCallback
            filePickerCallback = null
            if (callback == null) return@registerForActivityResult
            if (result.resultCode != RESULT_OK || result.data == null) {
                callback.onReceiveValue(null)
                return@registerForActivityResult
            }

            val uris = buildList<Uri> {
                result.data?.data?.let { add(it) }
                result.data?.clipData?.let { clip ->
                    for (i in 0 until clip.itemCount) {
                        clip.getItemAt(i).uri?.let { add(it) }
                    }
                }
            }
            // 授权读取选中文件，避免 WebView 无法读取 SAF Uri
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            uris.forEach { uri ->
                try {
                    contentResolver.takePersistableUriPermission(uri, flags)
                } catch (_: Exception) {
                    // best-effort；部分 Uri 可能不支持持久化，忽略
                }
            }
            callback.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Allow chrome://inspect/#devices to see WebView console/network logs (debug only)
        WebView.setWebContentsDebuggingEnabled(true)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)

        val rootContainer: View = findViewById(R.id.rootContainer)
        webView = findViewById(R.id.webView)

        val extraTopPx = (8 * resources.displayMetrics.density).toInt()
        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updatePadding(
                left = systemBars.left,
                top = systemBars.top + extraTopPx,
                right = systemBars.right,
                bottom = systemBars.bottom
            )
            insets
        }

        WindowInsetsControllerCompat(window, rootContainer).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.parseColor("#F5F5F7")

        // === WebView 设置 ===
        val webSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        webSettings.allowFileAccessFromFileURLs = true
        webSettings.allowUniversalAccessFromFileURLs = true

        // === WebChromeClient ===
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d("WebViewJS", "${it.message()} -- line ${it.lineNumber()}")
                }
                return super.onConsoleMessage(consoleMessage)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                filePickerCallback?.onReceiveValue(null)
                filePickerCallback = filePathCallback
                // 优先使用 WebView 的 intent，兜底 ACTION_OPEN_DOCUMENT；补充读权限/多选，支持图片和 CSV
                val baseIntent = try {
                    fileChooserParams.createIntent()
                } catch (e: Exception) {
                    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        type = "*/*"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    }
                }
                val intent = baseIntent.apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                    val accept = fileChooserParams.acceptTypes.filter { it.isNotBlank() }
                    if (accept.isNotEmpty()) {
                        putExtra(Intent.EXTRA_MIME_TYPES, accept.toTypedArray())
                        if (type.isNullOrBlank() || type == "*/*") {
                            type = accept.first()
                        }
                    } else if (type.isNullOrBlank()) {
                        type = "*/*"
                    }
                    if (fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                }
                return try {
                    filePickerLauncher.launch(intent)
                    true
                } catch (e: Exception) {
                    filePickerCallback = null
                    Toast.makeText(this@MainActivity, "无法打开文件选择器", Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }

        // 资源加载器 (用于本地加载)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        // === JS Bridge: Native OCR for Android (给 DeepSeek 用文本模型 + 本地 OCR) ===
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun ocrBase64(dataUrl: String?, callbackId: String?) {
                if (dataUrl.isNullOrBlank()) return
                val cbId = callbackId ?: ""
                ocrExecutor.execute {
                    val jsCallback: (String) -> Unit = { payload ->
                        webView.post {
                            val script = "window.__OCR_CB && window.__OCR_CB(${jsonEscape(cbId)}, $payload);"
                            webView.evaluateJavascript(script, null)
                        }
                    }
                    try {
                        val base64Part = dataUrl.substringAfter(",", dataUrl)
                        val imageBytes = Base64.decode(base64Part, Base64.DEFAULT)
                        val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                        val image = InputImage.fromBitmap(bitmap, 0)
                        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                        val result = Tasks.await(recognizer.process(image))
                        val text = result.text ?: ""
                        jsCallback("{\"ok\":true,\"text\":${jsonEscape(text)}}")
                    } catch (e: Exception) {
                        jsCallback("{\"ok\":false,\"error\":${jsonEscape(e.message ?: "OCR failed")}}")
                    }
                }
            }
        }, "AndroidOCR")

        // === JS Bridge: Save File (for backup export on Android) ===
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun saveFile(fileName: String?, content: String?) {
                val name = if (fileName.isNullOrBlank()) "PocketLedger_Backup_${System.currentTimeMillis()}.json" else fileName
                val data = content ?: ""
                try {
                    val resolver = contentResolver
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val values = ContentValues().apply {
                            put(MediaStore.Downloads.DISPLAY_NAME, name)
                            put(MediaStore.Downloads.MIME_TYPE, "application/json")
                            // 保存到 Downloads/PocketLedger 目录
                            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/PocketLedger")
                            put(MediaStore.Downloads.IS_PENDING, 1)
                        }
                        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                            ?: throw Exception("无法创建文件")
                        resolver.openOutputStream(uri)?.use { os ->
                            os.write(data.toByteArray(Charsets.UTF_8))
                        } ?: throw Exception("无法写入文件")
                        // 标记写入完成
                        values.clear()
                        values.put(MediaStore.Downloads.IS_PENDING, 0)
                        resolver.update(uri, values, null, null)
                    } else {
                        // Android 9 及以下，写入公共下载目录的子文件夹
                        val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        val dir = File(downloads, "PocketLedger")
                        if (!dir.exists()) dir.mkdirs()
                        val file = File(dir, name)
                        FileOutputStream(file).use { fos ->
                            fos.write(data.toByteArray(Charsets.UTF_8))
                        }
                    }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "备份已保存到: 下载/PocketLedger/$name", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "备份保存失败: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }, "Android")

        // === JS Bridge: Native WebDAV (bypass CORS) ===
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun davAction(action: String?, host: String?, path: String?, username: String?, password: String?, body: String?, allowInsecureStr: String?, callbackId: String?) {
                val cbId = callbackId ?: ""
                if (action.isNullOrBlank() || host.isNullOrBlank()) {
                    postDavResult(cbId, ok = false, msg = "Missing host or action")
                    return
                }
                // 在内网直接忽略证书校验（自签名）避免报错
                val allowInsecure = true
                davExecutor.execute {
                    try {
                        val base = buildDavUrl(host, path)
                        when (action) {
                            "TEST" -> {
                                val code = propfind(base, username, password, allowInsecure)
                                // 只要能到服务且返回了状态码（含 401/403/405）都视为可达
                                if (code in 200..499) postDavResult(cbId, ok = true, msg = "HTTP $code")
                                else postDavResult(cbId, ok = false, msg = "HTTP $code")
                            }
                            "UPLOAD" -> {
                                if (body == null) { postDavResult(cbId, ok = false, msg = "Missing body"); return@execute }
                                val code = putFile("$base$BACKUP_FILENAME", username, password, body, allowInsecure)
                                if (code in listOf(200, 201, 204)) postDavResult(cbId, ok = true, msg = "OK")
                                else postDavResult(cbId, ok = false, msg = "HTTP $code")
                            }
                            "RESTORE" -> {
                                val result = getFile("$base$BACKUP_FILENAME", username, password, allowInsecure)
                                if (result != null) postDavResult(cbId, ok = true, msg = result) else postDavResult(cbId, ok = false, msg = "Empty response")
                            }
                            else -> postDavResult(cbId, ok = false, msg = "Unknown action")
                        }
                    } catch (e: Exception) {
                        postDavResult(cbId, ok = false, msg = e.message ?: "DAV error")
                    }
                }
            }
        }, "AndroidWebDAV")

        // === WebViewClient (这里改回了原生 WebViewClient) ===
        // 这样写绝对不会再报 overrides nothing 的错
        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request == null || request.url == null) return null
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        // === 下载监听 ===
        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    setTitle(filename)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                }
                val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "开始下载...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "下载失败", Toast.LENGTH_SHORT).show()
            }
        })

        // === 加载网页 (已找回你的注释代码) ===
        webView.loadUrl("http://10.0.0.103:3000/")
        //webView.loadUrl("https://appassets.androidplatform.net/assets/index.html") // 这是你之前用的本地加载

        // === 手势/系统返回：优先让前端后退；仅在首页时退出 Activity ===
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                Log.d(TAG, "系统返回触发，交给前端路由处理")
                val script = """
                    (function() {
                        try {
                            // 允许前端自定义处理
                            if (window.__ANDROID_BACK__) {
                                var res = window.__ANDROID_BACK__();
                                if (res === true || res === "handled") return "handled";
                                if (res === "exit") return "exit";
                            }

                            var path = (location.pathname || "");
                            var hash = (location.hash || "");
                            var atHome = (
                                (path === "/" || path === "") &&
                                (hash === "" || hash === "#" || hash === "#/")
                            );

                            // 如果不是首页，即使 history.length == 1 也尝试后退一次
                            if (!atHome) {
                                history.back();
                                return "handled";
                            }

                            // 已经在首页，交给原生退出
                            return "exit";
                        } catch (e) { return "exit"; }
                    })();
                """.trimIndent()

                webView.evaluateJavascript(script) { result ->
                    when (result?.trim()) {
                        "\"handled\"" -> {
                            Log.d(TAG, "前端已处理返回（handled）")
                        }
                        "\"exit\"" -> {
                            Log.d(TAG, "前端提示退出，结束 Activity（视为首页）")
                            finish()
                        }
                        else -> {
                            Log.d(TAG, "前端结果未知 ($result)，结束 Activity 以防卡死")
                            finish()
                        }
                    }
                }
            }
        })
    }

    companion object {
        private const val TAG = "MainActivity"
        private const val BACKUP_FILENAME = "zenledger_backup.json"

        private fun jsonEscape(text: String): String {
            return JSONObject.quote(text) ?: "\"\""
        }
    }

    private fun buildDavUrl(host: String, path: String?): String {
        var base = host.trim()
        if (base.endsWith("/")) base = base.dropLast(1)
        val p = path?.trim()?.trim('/') ?: ""
        return if (p.isNotEmpty()) "$base/$p/" else "$base/"
    }

    private fun basicAuth(username: String?, password: String?): String {
        val u = username ?: ""
        val p = password ?: ""
        val raw = "$u:$p"
        return "Basic " + Base64.encodeToString(raw.toByteArray(), Base64.NO_WRAP)
    }

    private fun propfind(urlStr: String, username: String?, password: String?, allowInsecure: Boolean): Int {
        // Some NAS block PROPFIND; fallback to GET for connectivity test
        val url = URL(urlStr)
        val conn = openConn(url, allowInsecure)
        conn.requestMethod = "GET"
        conn.setRequestProperty("Authorization", basicAuth(username, password))
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        return conn.responseCode.also { conn.disconnect() }
    }

    private fun putFile(urlStr: String, username: String?, password: String?, body: String, allowInsecure: Boolean): Int {
        val url = URL(urlStr)
        val conn = openConn(url, allowInsecure)
        conn.requestMethod = "PUT"
        conn.doOutput = true
        conn.setRequestProperty("Authorization", basicAuth(username, password))
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.outputStream.use { it.write(body.toByteArray()) }
        return conn.responseCode.also { conn.disconnect() }
    }

    private fun getFile(urlStr: String, username: String?, password: String?, allowInsecure: Boolean): String? {
        val url = URL(urlStr)
        val conn = openConn(url, allowInsecure)
        conn.requestMethod = "GET"
        conn.setRequestProperty("Authorization", basicAuth(username, password))
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        val code = conn.responseCode
        if (code !in 200..299) {
            conn.disconnect()
            throw Exception("HTTP $code")
        }
        val sb = StringBuilder()
        BufferedReader(InputStreamReader(conn.inputStream)).use { br ->
            var line: String?
            while (br.readLine().also { line = it } != null) {
                sb.append(line)
            }
        }
        conn.disconnect()
        return sb.toString()
    }

    private fun postDavResult(callbackId: String, ok: Boolean, msg: String) {
        val payload = "{\"ok\":$ok,\"message\":${jsonEscape(msg)}}"
        webView.post {
            val script = "window.__DAV_CB && window.__DAV_CB(${jsonEscape(callbackId)}, $payload);"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun openConn(url: URL, allowInsecure: Boolean): HttpURLConnection {
        val conn = url.openConnection() as HttpURLConnection
        if (allowInsecure && conn is HttpsURLConnection) {
            try {
                val trustAllCerts: Array<TrustManager> = arrayOf(object : X509TrustManager {
                    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                    override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
                })
                val sslContext = SSLContext.getInstance("TLS")
                sslContext.init(null, trustAllCerts, SecureRandom())
                conn.sslSocketFactory = sslContext.socketFactory
                conn.hostnameVerifier = HostnameVerifier { _, _ -> true }
            } catch (_: Exception) {
                // fallback to default
            }
        }
        return conn
    }
}
