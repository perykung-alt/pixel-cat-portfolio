package com.perykung.pixelcat

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** เก็บข้อมูลพอร์ต (มาจากเว็บแอปผ่าน AndroidBridge) และผลคำนวณล่าสุดไว้ในเครื่อง */
object Store {
    private fun prefs(c: Context) = c.getSharedPreferences("pcp", Context.MODE_PRIVATE)
    fun data(c: Context): JSONObject? = prefs(c).getString("data", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    fun setData(c: Context, json: String) = prefs(c).edit().putString("data", json).apply()
    fun summary(c: Context): Summary? = prefs(c).getString("summary", null)?.let { runCatching { Summary.fromJson(JSONObject(it)) }.getOrNull() }
    fun setSummary(c: Context, s: Summary) = prefs(c).edit().putString("summary", s.toJson().toString()).apply()
    fun lastFx(c: Context): Double = prefs(c).getFloat("fx", 33.5f).toDouble()
    fun setLastFx(c: Context, v: Double) = prefs(c).edit().putFloat("fx", v.toFloat()).apply()
}

class CatSum(var value: Double = 0.0, var cost: Double = 0.0, var day: Double = 0.0)

class Summary(
    val total: Double,
    val cost: Double,
    val day: Double,
    val cats: Map<String, CatSum>,
    val at: Long,
    val missing: List<String>,
    val holdsThai: Boolean,
    val holdsUs: Boolean,
) {
    val pl get() = total - cost
    val plPct get() = if (cost > 0) pl / cost * 100 else 0.0
    val dayPct get() = if (total - day > 0) day / (total - day) * 100 else 0.0

    fun toJson(): JSONObject = JSONObject().apply {
        put("total", total); put("cost", cost); put("day", day); put("at", at)
        put("holdsThai", holdsThai); put("holdsUs", holdsUs)
        put("missing", JSONArray(missing))
        put("cats", JSONObject().apply {
            for ((k, v) in cats) put(k, JSONObject().put("value", v.value).put("cost", v.cost).put("day", v.day))
        })
    }

    companion object {
        fun fromJson(j: JSONObject): Summary {
            val cats = mutableMapOf<String, CatSum>()
            j.optJSONObject("cats")?.let { o ->
                for (k in o.keys()) {
                    val c = o.optJSONObject(k) ?: continue
                    cats[k] = CatSum(c.optDouble("value", 0.0).orZero(), c.optDouble("cost", 0.0).orZero(), c.optDouble("day", 0.0).orZero())
                }
            }
            val miss = mutableListOf<String>()
            j.optJSONArray("missing")?.let { a -> for (i in 0 until a.length()) miss.add(a.optString(i)) }
            return Summary(
                j.optDouble("total", 0.0).orZero(), j.optDouble("cost", 0.0).orZero(), j.optDouble("day", 0.0).orZero(),
                cats, j.optLong("at", System.currentTimeMillis()), miss,
                j.optBoolean("holdsThai", false), j.optBoolean("holdsUs", false),
            )
        }
    }
}

fun Double.orZero() = if (this.isNaN() || this.isInfinite()) 0.0 else this

object Portfolio {
    val CAT_ORDER = listOf("thai", "us", "fund", "crypto", "gold")
    val CAT_COLOR = mapOf(
        "thai" to 0xFFFF8A3D.toInt(), "us" to 0xFF4AA3FF.toInt(), "fund" to 0xFF2FC79A.toInt(),
        "crypto" to 0xFFB26BFF.toInt(), "gold" to 0xFFFFC83D.toInt(),
    )

    fun http(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 12000
        c.readTimeout = 15000
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) PixelCatPortfolio")
        c.setRequestProperty("Accept", "application/json")
        try {
            if (c.responseCode !in 200..299) throw RuntimeException("HTTP ${c.responseCode}")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    fun num(v: Any?): Double = v?.toString()?.replace(",", "")?.trim()?.toDoubleOrNull() ?: Double.NaN

    class Px(val price: Double, val prev: Double)

    private fun cnbcSym(type: String, sym: String) = when (type) {
        "thai" -> "$sym-TH"
        else -> sym.replace("-", ".")
    }

    private fun cnbc(symbols: List<String>): Map<String, Px> {
        val out = mutableMapOf<String, Px>()
        for (chunk in symbols.distinct().chunked(40)) {
            try {
                val url = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" +
                    URLEncoder.encode(chunk.joinToString("|"), "UTF-8") +
                    "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json"
                val root = JSONObject(http(url)).optJSONObject("FormattedQuoteResult") ?: continue
                val any = root.opt("FormattedQuote")
                val arr = when (any) {
                    is JSONArray -> any
                    is JSONObject -> JSONArray().put(any)
                    else -> JSONArray()
                }
                for (i in 0 until arr.length()) {
                    val q = arr.optJSONObject(i) ?: continue
                    if (q.optString("code") != "0") continue
                    val last = num(q.opt("last"))
                    if (!(last > 0)) continue
                    val ch = num(q.opt("change"))
                    val pdc = num(q.opt("previous_day_closing"))
                    val prev = if (!ch.isNaN()) last - ch else if (pdc > 0) pdc else last
                    out[q.optString("symbol")] = Px(last, prev)
                }
            } catch (_: Exception) {
            }
        }
        return out
    }

    private fun bitkub(): Map<String, Px> {
        val out = mutableMapOf<String, Px>()
        val arr = JSONArray(http("https://api.bitkub.com/api/v3/market/ticker"))
        for (i in 0 until arr.length()) {
            val t = arr.optJSONObject(i) ?: continue
            val parts = t.optString("symbol").split("_")
            if (parts.size != 2 || parts[1] != "THB") continue
            val last = num(t.opt("last"))
            val pct = num(t.opt("percent_change"))
            if (last > 0) out[parts[0]] = Px(last, if (!pct.isNaN()) last / (1 + pct / 100) else last)
        }
        return out
    }

    private fun gold(): Px? {
        val arr = JSONArray(http("https://apicheckprice.huasengheng.com/api/values/getprice/"))
        var found: JSONObject? = null
        for (i in 0 until arr.length()) if (arr.optJSONObject(i)?.optString("GoldType") == "HSH") found = arr.optJSONObject(i)
        val h: JSONObject = found ?: arr.optJSONObject(0) ?: return null
        val buy = num(h.opt("Buy"))
        val chg = num(h.opt("BuyChange")).let { if (it.isNaN()) 0.0 else it }
        return if (buy > 0) Px(buy, buy - chg) else null
    }

    /** ดึงราคาใหม่แล้วคำนวณพอร์ต (ตรรกะเดียวกับ compute() ในเว็บแอป/สคริปต์ iPhone) */
    fun refresh(ctx: Context, data: JSONObject): Summary {
        val hs = data.optJSONArray("holdings") ?: JSONArray()
        val list = (0 until hs.length()).mapNotNull { hs.optJSONObject(it) }
        val types = list.map { it.optString("type") }.toSet()

        // ราคา
        val stockSyms = list.filter { it.optString("type") in setOf("thai", "us") }
            .map { cnbcSym(it.optString("type"), it.optString("symbol")) }
        val cn = cnbc(stockSyms + listOf("THB="))
        val fx: Px = cn["THB="]?.also { Store.setLastFx(ctx, it.price) } ?: Px(Store.lastFx(ctx), Store.lastFx(ctx))
        val bk = if ("crypto" in types) runCatching { bitkub() }.getOrDefault(emptyMap()) else emptyMap()
        val gd = if ("gold" in types) runCatching { gold() }.getOrNull() else null
        val manual = data.optJSONObject("manual")
        val navs = data.optJSONObject("navs")

        fun priceOf(type: String, sym: String): Px? {
            val p = when (type) {
                "thai", "us" -> cn[cnbcSym(type, sym)]
                "crypto" -> bk[sym]
                "gold" -> gd
                "fund" -> navs?.optJSONObject(sym)?.let { n ->
                    val nav = n.optDouble("nav", Double.NaN)
                    if (nav > 0) Px(nav, n.optDouble("prev", nav).let { if (it.isNaN()) nav else it }) else null
                }
                else -> null
            }
            if (p != null) return p
            val m = manual?.optJSONObject("$type:$sym")?.optDouble("price", Double.NaN) ?: Double.NaN
            return if (m > 0) Px(m, m) else null
        }

        // รวมล็อตเป็นรายตัว
        class G(val type: String, val sym: String) { var qty = 0.0; var cost = 0.0 }
        val groups = linkedMapOf<String, G>()
        for (h in list) {
            val type = h.optString("type"); val sym = h.optString("symbol")
            val g = groups.getOrPut("$type:$sym") { G(type, sym) }
            val qty = h.optDouble("qty", 0.0).orZero()
            val avg = h.optDouble("avg", 0.0).orZero()
            val lotFx = if (type == "us") h.optDouble("fx", Double.NaN).let { if (it > 0) it else fx.price } else 1.0
            g.qty += qty
            g.cost += qty * avg * lotFx
        }
        val cats = Portfolio.CAT_ORDER.associateWith { CatSum() }
        val missing = mutableListOf<String>()
        for (g in groups.values) {
            val p = priceOf(g.type, g.sym)
            var price = Double.NaN; var prev = Double.NaN
            if (p != null) {
                if (g.type == "us") { price = p.price * fx.price; prev = p.prev * fx.prev } else { price = p.price; prev = p.prev }
            } else missing.add(g.sym)
            var value = g.qty * price
            if (value.isNaN()) value = g.cost
            val prevValue = if (!prev.isNaN()) g.qty * prev else value
            val c = cats[g.type] ?: continue
            c.value += value; c.cost += g.cost; c.day += value - prevValue
        }
        val total = cats.values.sumOf { it.value }
        val cost = cats.values.sumOf { it.cost }
        val day = cats.values.sumOf { it.day }
        val fi = data.optJSONObject("settings")?.optJSONObject("fundInfo")
        val holdsThai = "thai" in types || list.any { it.optString("type") == "fund" && fi?.optJSONObject(it.optString("symbol"))?.optString("region") == "thai" }
        val holdsUs = "us" in types || list.any { it.optString("type") == "fund" && fi?.optJSONObject(it.optString("symbol"))?.optString("region") != "thai" }
        return Summary(total, cost, day, cats, System.currentTimeMillis(), missing, holdsThai, holdsUs)
    }
}
