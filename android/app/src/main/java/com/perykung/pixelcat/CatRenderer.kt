package com.perykung.pixelcat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import org.json.JSONArray
import org.json.JSONObject

/** วาดแมวพิกเซล (สไปรต์ชุดเดียวกับ iPhone/เว็บ จาก assets/sprites.json) และแถบสัดส่วนพอร์ต */
object CatRenderer {
    @Volatile private var spr: JSONObject? = null

    private fun sprites(ctx: Context): JSONObject =
        spr ?: JSONObject(ctx.assets.open("sprites.json").bufferedReader().use { it.readText() }).also { spr = it }

    private fun setRow(g: Array<CharArray>, y: Int, row: String) {
        if (y !in g.indices) return
        for (x in row.indices) if (x < g[y].size) g[y][x] = row[x]
    }

    fun grid(ctx: Context, mood: String, breed: String): Array<CharArray> {
        val s = sprites(ctx)
        val base = s.getJSONArray("base")
        val g = Array(base.length()) { base.getString(it).toCharArray() }
        val b = s.optJSONObject("breeds")?.optJSONObject(breed)
        b?.optJSONObject("rows")?.let { rows -> for (k in rows.keys()) setRow(g, k.toInt(), rows.getString(k)) }
        val eyes: JSONArray = b?.optJSONObject("eyes")?.optJSONArray(mood) ?: s.getJSONObject("eyes").getJSONArray(mood)
        for (i in 0 until eyes.length()) { val e = eyes.getJSONArray(i); setRow(g, e.getInt(1), e.getString(0)) }
        val mouth = s.getJSONObject("mouth").getJSONArray(mood)
        setRow(g, mouth.getInt(1), mouth.getString(0))
        s.optJSONObject("extra")?.optJSONArray(mood)?.let { ex ->
            for (i in 0 until ex.length()) {
                val e = ex.getJSONArray(i); val x = e.getInt(0); val y = e.getInt(1)
                if (y in g.indices && x in g[y].indices) g[y][x] = e.getString(2)[0]
            }
        }
        // ลายเฉพาะพันธุ์ที่ทับหลังสุด (เช่น หน้ากากวิเชียรมาศ) "_" = คงเดิม
        b?.optJSONObject("post")?.let { rows ->
            for (k in rows.keys()) {
                val y = k.toInt(); val row = rows.getString(k)
                if (y in g.indices) for (x in row.indices) if (x < g[y].size && row[x] != '_') g[y][x] = row[x]
            }
        }
        return g
    }

    fun catBitmap(ctx: Context, mood: String, breed: String, px: Int = 6): Bitmap {
        val s = sprites(ctx)
        val pal = mutableMapOf<Char, Int>()
        val fixed = s.getJSONObject("fixed")
        for (k in fixed.keys()) pal[k[0]] = Color.parseColor(fixed.getString(k))
        val pj = s.getJSONObject("palettes").optJSONObject(breed) ?: s.getJSONObject("palettes").getJSONObject("orange")
        for (k in pj.keys()) pal[k[0]] = Color.parseColor(pj.getString(k))
        val g = grid(ctx, mood, breed)
        val w = g.maxOf { it.size }
        val bmp = Bitmap.createBitmap(w * px, g.size * px, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint().apply { isAntiAlias = false }
        for (y in g.indices) for (x in g[y].indices) {
            val ch = g[y][x]
            if (ch == '.' || ch == ' ') continue
            p.color = pal[ch] ?: Color.MAGENTA
            c.drawRect((x * px).toFloat(), (y * px).toFloat(), ((x + 1) * px).toFloat(), ((y + 1) * px).toFloat(), p)
        }
        return bmp
    }

    /** แถบบล็อกแบบเกม 20 ช่อง ตามสัดส่วนมูลค่าแต่ละหมวด */
    fun barBitmap(values: List<Pair<Int, Double>>, n: Int = 20, w: Int = 600, h: Int = 24, emptyColor: Int = 0x44888888): Bitmap {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint().apply { isAntiAlias = false }
        val total = values.sumOf { it.second }
        val counts = IntArray(values.size)
        if (total > 0) {
            val raw = values.map { it.second / total * n }
            for (i in raw.indices) counts[i] = raw[i].toInt()
            var left = n - counts.sum()
            raw.indices.sortedByDescending { raw[it] - raw[it].toInt() }.forEach { if (left > 0 && values[it].second > 0) { counts[it]++; left-- } }
            for (i in values.indices) if (values[i].second > 0 && counts[i] == 0) {
                val j = counts.indices.maxByOrNull { counts[it] } ?: 0
                if (counts[j] > 1) { counts[j]--; counts[i]++ }
            }
        }
        val gap = 4f
        val bw = (w - gap * (n - 1)) / n
        var k = 0
        fun block(color: Int, solid: Boolean) {
            val x = k * (bw + gap)
            p.color = color
            c.drawRect(x, 0f, x + bw, h.toFloat(), p)
            if (solid) {
                p.color = shade(color, -0.3f); c.drawRect(x, h * 0.7f, x + bw, h.toFloat(), p)
                p.color = shade(color, 0.35f); c.drawRect(x, 0f, x + bw, h * 0.2f, p)
            }
            k++
        }
        for (i in values.indices) repeat(counts[i]) { block(values[i].first, true) }
        while (k < n) block(emptyColor, false)
        return bmp
    }

    private fun shade(color: Int, f: Float): Int {
        fun ch(v: Int) = (if (f < 0) v * (1 + f) else v + (255 - v) * f).toInt().coerceIn(0, 255)
        return Color.argb(255, ch(Color.red(color)), ch(Color.green(color)), ch(Color.blue(color)))
    }
}
