package com.perykung.pixelcat

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.widget.RemoteViews
import java.text.DecimalFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class PortfolioWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        render(context)
        RefreshWorker.schedule(context)
        RefreshWorker.runNow(context)
    }

    override fun onEnabled(context: Context) {
        RefreshWorker.schedule(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            render(context, refreshing = true)
            RefreshWorker.runNow(context)
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.perykung.pixelcat.REFRESH"
        private val money = DecimalFormat("#,##0")
        private val hhmm = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.of("Asia/Bangkok"))

        private fun signed(v: Double) = (if (v > 0) "+" else if (v < 0) "-" else "") + money.format(kotlin.math.abs(v))
        private fun pct(v: Double) = (if (v > 0) "+" else "") + String.format("%.2f%%", v)

        fun render(ctx: Context, refreshing: Boolean = false) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PortfolioWidget::class.java))
            if (ids.isEmpty()) return
            val views = try { build(ctx, refreshing) } catch (e: Exception) { errorViews(ctx, e) }
            mgr.updateAppWidget(ids, views)
        }

        private fun errorViews(ctx: Context, e: Exception) = RemoteViews(ctx.packageName, R.layout.widget_portfolio).apply {
            setTextViewText(R.id.line, "แมวสะดุด เมี้ยว… แตะเพื่อเปิดแอป")
            setTextViewText(R.id.total, "—")
            setTextViewText(R.id.pl, e.message ?: "")
            setOnClickPendingIntent(R.id.root, openApp(ctx))
        }

        private fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        private fun build(ctx: Context, refreshing: Boolean): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_portfolio)
            val data = Store.data(ctx)
            val st = data?.optJSONObject("settings")
            val catName = st?.optString("catName")?.takeIf { it.isNotBlank() } ?: "ส้มจี๊ด"
            val breed = st?.optString("catColor")?.takeIf { it.isNotBlank() } ?: "orange"
            val theme = st?.optString("theme") ?: "auto"
            val night = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            val dark = theme == "dark" || (theme == "auto" && night)
            val text = if (dark) 0xFFF3EAD7.toInt() else 0xFF3B2418.toInt()
            val sub = if (dark) 0xFFA79CC8.toInt() else 0xFF8A6E57.toInt()
            val up = if (dark) 0xFF5BE38A.toInt() else 0xFF1E8A43.toInt()
            val down = if (dark) 0xFFFF6B7A.toInt() else 0xFFC9303C.toInt()
            v.setInt(R.id.root, "setBackgroundResource", if (dark) R.drawable.widget_bg_dark else R.drawable.widget_bg_light)
            for (id in listOf(R.id.line, R.id.refresh)) v.setTextColor(id, text)
            for (id in listOf(R.id.market, R.id.updated)) v.setTextColor(id, sub)

            v.setOnClickPendingIntent(R.id.root, openApp(ctx))
            v.setOnClickPendingIntent(
                R.id.refresh,
                PendingIntent.getBroadcast(
                    ctx, 1, Intent(ctx, PortfolioWidget::class.java).setAction(ACTION_REFRESH),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )

            val s = Store.summary(ctx)
            val th = Market.th(); val us = Market.us()
            val h = Market.bkkHour()
            if (s == null || data == null || (data.optJSONArray("holdings")?.length() ?: 0) == 0) {
                v.setImageViewBitmap(R.id.cat, CatRenderer.catBitmap(ctx, "normal", breed))
                v.setTextViewText(R.id.line, "♥ $catName")
                v.setTextViewText(R.id.total, "฿0")
                v.setTextViewText(R.id.pl, "แตะเพื่อเปิดแอปแล้วเพิ่มพอร์ต")
                v.setTextColor(R.id.pl, 0xFFFFE38A.toInt())
                v.setTextViewText(R.id.market, "${th.label} · ${us.label}")
                v.setTextViewText(R.id.updated, "")
                v.setImageViewBitmap(R.id.bar, CatRenderer.barBitmap(emptyList()))
                return v
            }

            // อารมณ์ + กิจกรรมตามเวลาตลาด
            val mood = when {
                (h >= 23.5 || h < 6) && !(s.holdsUs && us.open) -> "sleep"
                s.dayPct >= 2 -> "wow"
                s.dayPct >= 0.2 -> "happy"
                s.dayPct <= -1 -> "sad"
                else -> "normal"
            }
            val doing = when {
                s.holdsThai && th.open -> "เฝ้ากราฟหุ้นไทย"
                th.state == "break" -> "พักเที่ยง กินปลา"
                s.holdsUs && us.open -> if (h < 6) "อดนอนเฝ้าตลาดอเมริกา" else "เฝ้าตลาดอเมริกา ☕"
                mood == "sleep" -> "Zzz… ตลาดหลับแล้ว"
                mood == "wow" -> "พอร์ตพุ่ง! วิ่งรอบห้อง"
                mood == "happy" -> "ไล่จับผีเสื้อ~"
                mood == "sad" -> "งอนพอร์ตแป๊บ…"
                else -> "นอนชิลรอตลาด"
            }
            v.setImageViewBitmap(R.id.cat, CatRenderer.catBitmap(ctx, mood, breed))
            v.setTextViewText(R.id.line, "♥ $catName · $doing")
            v.setTextViewText(R.id.total, "฿" + money.format(s.total))
            v.setTextViewText(R.id.pl, "${signed(s.pl)} (${pct(s.plPct)}) · วันนี้ ${pct(s.dayPct)}")
            v.setTextColor(R.id.pl, if (s.pl >= 0) 0xFF6BF08F.toInt() else 0xFFFF7A85.toInt())
            v.setImageViewBitmap(
                R.id.bar,
                CatRenderer.barBitmap(Portfolio.CAT_ORDER.map { (Portfolio.CAT_COLOR[it] ?: 0) to (s.cats[it]?.value ?: 0.0) }),
            )
            val dot = { o: Market.St -> if (o.open) "●" else "○" }
            v.setTextViewText(R.id.market, "${dot(th)} ${th.label}  ${dot(us)} ${us.label}" + if (s.missing.isNotEmpty()) "  ⚠︎ไม่มีราคา ${s.missing.size}" else "")
            v.setTextViewText(R.id.updated, if (refreshing) "กำลังอัปเดต…" else "⟳ " + hhmm.format(Instant.ofEpochMilli(s.at)))
            return v
        }
    }
}
