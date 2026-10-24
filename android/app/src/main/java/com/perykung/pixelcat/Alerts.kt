package com.perykung.pixelcat

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONObject
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale
import kotlin.math.abs

/**
 * แจ้งเตือนราคา (ตรรกะเดียวกับ checkAlerts() ในสคริปต์ iPhone/เว็บ)
 * • data.alerts: แจ้งครั้งเดียวเมื่อราคาแตะเป้า (หุ้นนอก = USD, อย่างอื่น = บาท)
 * • settings.moveAlert: พอร์ตขยับเกิน ±X% ในวันเดียว (วันละครั้งต่อทิศ)
 */
object Alerts {
    private const val CH = "alerts"
    private fun prefs(c: Context) = c.getSharedPreferences("pcp-alerts", Context.MODE_PRIVATE)

    fun fired(c: Context): JSONObject = runCatching { JSONObject(prefs(c).getString("fired", "{}")!!) }.getOrDefault(JSONObject())

    private fun price(v: Double): String {
        val a = abs(v)
        val d = if (a >= 1000) 0 else if (a >= 1) 2 else if (a >= 0.01) 4 else 8
        return String.format(Locale.US, "%,.${d}f", v)
    }
    private fun pct(v: Double) = (if (v > 0) "+" else "") + String.format(Locale.US, "%.2f", v) + "%"

    fun check(c: Context, s: Summary, data: JSONObject) {
        if (data.optBoolean("sample", false)) return
        val fired = fired(c)
        var changed = false
        val list = data.optJSONArray("alerts")
        if (list != null) for (i in 0 until list.length()) {
            val a = list.optJSONObject(i) ?: continue
            val id = a.optString("id")
            if (!a.optBoolean("on", false) || id.isEmpty() || fired.has(id)) continue
            val type = a.optString("type"); val sym = a.optString("symbol")
            val target = a.optDouble("price", 0.0)
            val p = s.prices["$type:$sym"] ?: continue
            if (target <= 0) continue
            val down = a.optString("op") == "<="
            if (if (down) p <= target else p >= target) {
                val unit = if (type == "us") "$" else "฿"
                val ok = post(c, id.hashCode(),
                    "${if (down) "🔔" else "🎯"} $sym ${if (down) "ลงมาถึง" else "ขึ้นถึง"}เป้าแล้ว!",
                    "ราคาตอนนี้ $unit${price(p)} (ตั้งไว้ ${if (down) "≤" else "≥"} $unit${price(target)})")
                if (ok) { fired.put(id, System.currentTimeMillis()); changed = true }
            }
        }
        if (changed) prefs(c).edit().putString("fired", fired.toString()).apply()

        // พอร์ตขยับแรง
        val th = data.optJSONObject("settings")?.optDouble("moveAlert", 0.0) ?: 0.0
        if (th > 0 && !th.isNaN() && abs(s.dayPct) >= th && s.total > 0) {
            val dir = if (s.dayPct > 0) "up" else "down"
            val today = ZonedDateTime.now(ZoneId.of("Asia/Bangkok")).toLocalDate().toString()
            if (prefs(c).getString("move-$dir", "") != today) {
                val amt = (if (s.day > 0) "+" else "") + String.format(Locale.US, "%,.0f", s.day)
                val ok = post(c, if (dir == "up") 201 else 202,
                    if (dir == "up") "🚀 พอร์ตพุ่ง ${pct(s.dayPct)} วันนี้!" else "📉 พอร์ตร่วง ${pct(s.dayPct)} วันนี้",
                    "$amt ฿ · มูลค่า ฿${String.format(Locale.US, "%,.0f", s.total)}")
                if (ok) prefs(c).edit().putString("move-$dir", today).apply()
            }
        }
    }

    private fun post(c: Context, nid: Int, title: String, body: String): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val nm = c.getSystemService(NotificationManager::class.java) ?: return false
        nm.createNotificationChannel(NotificationChannel(CH, "แจ้งเตือนราคา", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "เมื่อราคาแตะเป้าที่ตั้งไว้ หรือพอร์ตขยับแรง"
        })
        val open = PendingIntent.getActivity(c, 1, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        nm.notify(nid, Notification.Builder(c, CH)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build())
        return true
    }
}
