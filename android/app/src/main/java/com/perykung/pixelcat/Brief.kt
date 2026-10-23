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
 * แจ้งเตือนสรุปพอร์ตวันละ 2 รอบ — คำนวณในเครื่องล้วนๆ (ไม่ใช้ AI ไม่มีค่าใช้จ่าย)
 * เย็น: หลัง SET ปิด 16:45 (วันที่ตลาดไทยเปิด) · เช้า: 07:00–12:00 หลังตลาด US ปิดเมื่อคืน
 * ตรรกะเดียวกับ briefSlot()/briefText() ในสคริปต์ iPhone
 */
object Brief {
    private const val CH = "brief"
    private val CATS = linkedMapOf("thai" to "หุ้นไทย", "us" to "หุ้นนอก", "fund" to "กองทุน", "crypto" to "คริปโต", "gold" to "ทอง")

    private fun prefs(c: Context) = c.getSharedPreferences("pcp-brief", Context.MODE_PRIVATE)

    fun slot(c: Context, now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("Asia/Bangkok"))): String? {
        val today = now.toLocalDate().toString()
        val m = now.hour * 60 + now.minute
        if (Market.isSetDay(now.toLocalDate()) && m >= 16 * 60 + 45 && prefs(c).getString("evening", "") != today) return "evening"
        val us = now.minusHours(12).withZoneSameInstant(ZoneId.of("America/New_York")).toLocalDate()
        if (Market.isUsDay(us) && m in (7 * 60) until (12 * 60) && prefs(c).getString("morning", "") != today) return "morning"
        return null
    }

    fun maybe(c: Context, s: Summary, data: JSONObject) {
        val st = data.optJSONObject("settings")
        if (st?.optBoolean("notify", true) == false || data.optBoolean("sample", false) || s.total <= 0) return
        val sl = slot(c) ?: return
        if (post(c, s, st?.optString("catName", "แมว") ?: "แมว", sl)) {
            prefs(c).edit().putString(sl, ZonedDateTime.now(ZoneId.of("Asia/Bangkok")).toLocalDate().toString()).apply()
        }
    }

    private fun money(v: Double, sign: Boolean = false): String {
        val s = String.format(Locale.US, "%,.0f", abs(v))
        return (if (v < 0) "-" else if (sign && v > 0) "+" else "") + s
    }
    private fun pct(v: Double) = (if (v > 0) "+" else "") + String.format(Locale.US, "%.2f", v) + "%"
    private fun compact(v: Double) = when {
        abs(v) >= 1e6 -> String.format(Locale.US, "%.2fM", v / 1e6)
        abs(v) >= 1e5 -> String.format(Locale.US, "%.0fK", v / 1e3)
        else -> money(v)
    }

    fun text(s: Summary, name: String, slot: String): Pair<String, String> {
        val face = when { s.dayPct >= 1 -> "😸"; s.dayPct > 0 -> "😺"; s.dayPct <= -1 -> "🙀"; else -> "🐱" }
        val whenTxt = when (slot) { "morning" -> "เช้านี้"; "evening" -> "เย็นนี้"; else -> "ล่าสุด" }
        val title = "$face $name สรุปพอร์ต$whenTxt · ฿${compact(s.total)}"
        val lines = mutableListOf("${if (slot == "morning") "รอบล่าสุด" else "วันนี้"} ${money(s.day, true)} ฿ (${pct(s.dayPct)}) · กำไรรวม ${money(s.pl, true)} ฿ (${pct(s.plPct)})")
        val cs = CATS.mapNotNull { (k, label) ->
            val x = s.cats[k] ?: return@mapNotNull null
            if (x.value <= 0) return@mapNotNull null
            val prev = x.value - x.day
            "$label ${pct(if (prev > 0) x.day / prev * 100 else 0.0)}"
        }
        if (cs.isNotEmpty()) lines.add(cs.joinToString(" · "))
        if (s.missing.isNotEmpty()) lines.add("⚠️ ไม่มีราคา: ${s.missing.take(3).joinToString(", ")}")
        return title to lines.joinToString("\n")
    }

    /** ส่งแจ้งเตือน (คืน false ถ้ายังไม่ได้รับอนุญาต) */
    fun post(c: Context, s: Summary, name: String, slot: String): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val nm = c.getSystemService(NotificationManager::class.java) ?: return false
        nm.createNotificationChannel(NotificationChannel(CH, "สรุปพอร์ตรายวัน", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "สรุปพอร์ตหลังตลาดไทยและตลาดอเมริกาปิด"
        })
        val (title, body) = text(s, name, slot)
        val open = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(c, CH)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body.lineSequence().first())
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(if (slot == "morning") 101 else 102, n)
        return true
    }
}
