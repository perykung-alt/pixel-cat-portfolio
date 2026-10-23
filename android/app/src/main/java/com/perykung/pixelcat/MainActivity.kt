package com.perykung.pixelcat

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * แอปเปิดเว็บแอปตัวเดียวกับ Android/คอม (หน้าตาและฟีเจอร์อัปเดตตามเว็บอัตโนมัติ)
 * และรับข้อมูลพอร์ตผ่าน AndroidBridge ไปใช้กับ widget บนหน้าจอ
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var pendingIdToken: String? = null
    private var pageReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#F4E9D2"))
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = true
        }
        web.addJavascriptInterface(Bridge(this), "AndroidBridge")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == HOST && (u.path ?: "").startsWith(PATH)) return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                deliverLogin()
            }
        }
        handleIntent(intent)
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(APP_URL)
        checkUpdate()
        // Android 13+: ขออนุญาตแจ้งเตือน (ใช้ส่งสรุปพอร์ตรายวัน)
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 7)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    /** กลับจากหน้า login ใน Chrome: pixelcat://auth?idt=<Google ID token> */
    private fun handleIntent(i: Intent?) {
        val d = i?.data ?: return
        if (d.scheme == "pixelcat" && d.host == "auth") {
            pendingIdToken = d.getQueryParameter("idt")
            deliverLogin()
        }
    }

    private fun deliverLogin() {
        val t = pendingIdToken ?: return
        if (!pageReady) return
        pendingIdToken = null
        web.evaluateJavascript("window.__nativeLogin && window.__nativeLogin(${JSONObject.quote(t)})", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onPause() {
        super.onPause()
        RefreshWorker.runNow(this)
    }

    /** เช็กเวอร์ชันแอปจาก version.json บน GitHub (ส่วนเว็บอัปเดตเองอยู่แล้ว) */
    private fun checkUpdate() {
        Thread {
            try {
                val j = JSONObject(Portfolio.http("$RAW/version.json?t=${System.currentTimeMillis()}"))
                val a = j.optJSONObject("android") ?: return@Thread
                if (a.optInt("versionCode", 0) <= BuildConfig.VERSION_CODE) return@Thread
                runOnUiThread {
                    if (isFinishing) return@runOnUiThread
                    AlertDialog.Builder(this)
                        .setTitle("มีแอปเวอร์ชันใหม่ ${a.optString("versionName")} 🐱")
                        .setMessage(a.optString("notes") + "\n\nกดดาวน์โหลด แล้วเปิดไฟล์เพื่อติดตั้งทับ ข้อมูลพอร์ตไม่หาย")
                        .setPositiveButton("ดาวน์โหลด") { _, _ ->
                            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(a.optString("url", APK_URL)))) }
                        }
                        .setNegativeButton("ไว้ทีหลัง", null)
                        .show()
                }
            } catch (_: Exception) {
            }
        }.start()
    }

    class Bridge(private val act: MainActivity) {
        @JavascriptInterface fun save(json: String) { Store.setData(act, json) }

        @JavascriptInterface fun summary(json: String) {
            runCatching { Store.setSummary(act, Summary.fromJson(JSONObject(json))) }
            PortfolioWidget.render(act)
        }

        @JavascriptInterface fun refreshWidget() { RefreshWorker.runNow(act) }

        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME

        /** ปุ่ม "ส่งตัวอย่าง" ในหน้าตั้งค่าของเว็บแอป */
        @JavascriptInterface fun testBrief(): Boolean {
            val s = Store.summary(act) ?: return false
            val name = Store.data(act)?.optJSONObject("settings")?.optString("catName", "แมว") ?: "แมว"
            return Brief.post(act, s, name, "now")
        }

        /** Google ไม่อนุญาตให้ล็อกอินในเว็บวิว → เปิดหน้า login ใน Chrome แล้วรับ token กลับทาง pixelcat://auth */
        @JavascriptInterface fun openLogin(url: String) {
            act.runOnUiThread { runCatching { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
        }
    }

    companion object {
        const val HOST = "perykung-alt.github.io"
        const val PATH = "/pixel-cat-portfolio"
        const val APP_URL = "https://$HOST$PATH/?app=android"
        const val RAW = "https://raw.githubusercontent.com/perykung-alt/pixel-cat-portfolio/main"
        const val APK_URL = "https://github.com/perykung-alt/pixel-cat-portfolio/releases/latest/download/pixel-cat.apk"
    }
}
