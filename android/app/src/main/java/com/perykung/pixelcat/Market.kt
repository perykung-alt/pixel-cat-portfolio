package com.perykung.pixelcat

import java.time.DayOfWeek
import java.time.ZoneId
import java.time.ZonedDateTime

/** เวลาตลาดจริง (ชุดเดียวกับเว็บแอป/สคริปต์ iPhone) */
object Market {
    private val SET_HOLIDAYS = setOf(
        "2026-01-01", "2026-01-02", "2026-03-03", "2026-04-06", "2026-04-13", "2026-04-14", "2026-04-15",
        "2026-05-01", "2026-05-04", "2026-06-01", "2026-06-03", "2026-07-28", "2026-07-29", "2026-08-12",
        "2026-10-13", "2026-10-16", "2026-10-23", "2026-12-07", "2026-12-10", "2026-12-31",
    )
    private val US_HOLIDAYS = setOf(
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
        "2026-09-07", "2026-11-26", "2026-12-25",
        "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05",
        "2027-09-06", "2027-11-25", "2027-12-24",
    )
    private val US_EARLY = mapOf("2026-11-27" to 780, "2026-12-24" to 780, "2027-11-26" to 780)

    /** state: open / pre / break / after / closed */
    class St(val state: String, val label: String) { val open get() = state == "open" }

    private fun weekday(t: ZonedDateTime) = t.dayOfWeek != DayOfWeek.SATURDAY && t.dayOfWeek != DayOfWeek.SUNDAY

    fun th(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("Asia/Bangkok"))): St {
        val m = now.hour * 60 + now.minute
        if (!weekday(now) || now.toLocalDate().toString() in SET_HOLIDAYS) return St("closed", "SET ปิด")
        return when {
            m < 570 -> St("closed", "SET ยังไม่เปิด")
            m < 600 -> St("pre", "SET Pre-open")
            m < 750 -> St("open", "SET เปิด")
            m < 810 -> St("break", "SET พักเที่ยง")
            m < 840 -> St("pre", "SET Pre-open")
            m < 1000 -> St("open", "SET เปิด")
            else -> St("closed", "SET ปิดแล้ว")
        }
    }

    fun us(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): St {
        val m = now.hour * 60 + now.minute
        val d = now.toLocalDate().toString()
        if (!weekday(now) || d in US_HOLIDAYS) return St("closed", "US ปิด")
        val close = US_EARLY[d] ?: 960
        return when {
            m < 240 -> St("closed", "US ปิด")
            m < 570 -> St("pre", "US Pre-market")
            m < close -> St("open", "US เปิด")
            m < 1200 -> St("after", "US After-hours")
            else -> St("closed", "US ปิด")
        }
    }

    fun bkkHour(): Double = ZonedDateTime.now(ZoneId.of("Asia/Bangkok")).let { it.hour + it.minute / 60.0 }
}
