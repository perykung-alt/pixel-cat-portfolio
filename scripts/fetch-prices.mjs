// ดึงราคาทั้งหมดไว้ในไฟล์เดียว (data/prices.json) ให้เว็บแอปอ่านได้โดยไม่ติด CORS
// รันใน GitHub Actions ทุก ~15 นาที · ใช้: node scripts/fetch-prices.mjs <out.json>
import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = process.argv[2] || path.join(root, "_site/data/prices.json");
const PREV_URL = process.env.PREV_URL || "https://perykung-alt.github.io/pixel-cat-portfolio/data/prices.json";
const REPO = process.env.GITHUB_REPOSITORY || "perykung-alt/pixel-cat-portfolio";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const num = (s) => { const n = parseFloat(String(s ?? "").replace(/,/g, "")); return isFinite(n) ? n : NaN; };
async function getJSON(url, opt = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opt.timeout || 15000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...(opt.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null); } }));
  return out;
}

// ---------- ช่วงเวลาที่ควรดึงหุ้น (UTC) ----------
const now = new Date(), dow = now.getUTCDay(), utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
const weekday = dow >= 1 && dow <= 5;
const setWindow = weekday && utcMin >= 2 * 60 + 25 && utcMin <= 10 * 60 + 10;   // 09:25–17:10 BKK
const usWindow = weekday && utcMin >= 13 * 60 + 20 && utcMin <= 21 * 60 + 10;   // ตลาด US 09:30–16:00 ET (ครอบคลุมทั้งช่วง DST และไม่ DST)
const STALE_MS = 4 * 3600e3;

// ---------- อ่านรายชื่อหุ้น ----------
const SYM = JSON.parse(fs.readFileSync(path.join(root, "scripts/symbols.json"), "utf8"));
const thai = new Set(SYM.thai.map((s) => s.toUpperCase()));
const us = new Set(SYM.us.map((s) => s.toUpperCase()));
// คำขอเพิ่มหุ้นจาก GitHub Issues: หัวข้อ "add PTT" / "add VOO us" / "เพิ่ม CPALL"
try {
  const headers = process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {};
  const issues = await getJSON(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`, { headers });
  for (const it of issues) {
    const m = String(it.title || "").trim().match(/^(?:add|เพิ่ม)\s*:?\s*([A-Za-z0-9.&\-]{1,15})(?:\s+(thai|th|us|usa))?/i);
    if (!m) continue;
    const s = m[1].toUpperCase().replace(/\.BK$/, "");
    if (/^(us|usa)$/i.test(m[2] || "")) us.add(s); else if (/^(thai|th)$/i.test(m[2] || "")) thai.add(s); else { thai.add(s); us.add(s); }
  }
} catch (e) { console.log("issues:", e.message); }

// ---------- ราคาเดิม (กันข้อมูลหายเมื่อดึงไม่สำเร็จ) ----------
let prev = { stocks: {}, crypto: {}, fx: null, gold: null };
try { prev = await getJSON(PREV_URL + "?t=" + Date.now()); } catch (e) { console.log("prev:", e.message); }
prev.stocks ||= {};

// ---------- Yahoo ----------
async function yahoo(sym) {
  for (const host of ["query1", "query2"]) {
    try {
      const j = await getJSON(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, { timeout: 12000 });
      const m = j.chart.result[0].meta;
      if (!isFinite(m.regularMarketPrice)) throw new Error("no price");
      return { price: m.regularMarketPrice, prev: m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice, t: (m.regularMarketTime || 0) * 1000 || Date.now(), cur: m.currency };
    } catch (e) { if (host === "query2") throw e; }
  }
}

const out = { at: Date.now(), v: 1, stocks: { ...prev.stocks }, crypto: prev.crypto || {}, fx: prev.fx || null, gold: prev.gold || null, errors: [] };

// คริปโต (Bitkub)
try {
  const arr = await getJSON("https://api.bitkub.com/api/v3/market/ticker");
  const c = {};
  for (const t of arr) {
    const [base, quote] = String(t.symbol).split("_");
    if (quote !== "THB") continue;
    const last = num(t.last), pct = num(t.percent_change);
    if (isFinite(last)) c[base] = { price: last, prev: isFinite(pct) ? last / (1 + pct / 100) : last };
  }
  out.crypto = c; out.cryptoAt = Date.now();
} catch (e) { out.errors.push("bitkub " + e.message); }

// ทอง (ฮั่วเซ่งเฮง 96.5%)
try {
  const arr = await getJSON("https://apicheckprice.huasengheng.com/api/values/getprice/");
  const h = arr.find((x) => x.GoldType === "HSH") || arr[0];
  const buy = num(h.Buy), chg = num(h.BuyChange) || 0;
  if (isFinite(buy)) out.gold = { price: buy, prev: buy - chg, sell: num(h.Sell), time: h.TimeUpdate, at: Date.now() };
} catch (e) { out.errors.push("gold " + e.message); }

// USD/THB
try { out.fx = { ...(await yahoo("THB=X")), at: Date.now() }; } catch (e) { out.errors.push("fx " + e.message); }

// หุ้น — ดึงเฉพาะช่วงตลาดเปิด หรือเมื่อราคาเก่าเกิน 4 ชม. / ยังไม่มีราคา
const jobs = [];
for (const s of thai) { const k = s + ".BK"; const p = out.stocks[k]; if (setWindow || !p || Date.now() - (p.at || 0) > STALE_MS) jobs.push(k); }
for (const s of us) { const p = out.stocks[s]; if (usWindow || !p || Date.now() - (p.at || 0) > STALE_MS) jobs.push(s); }
let ok = 0, fail = 0;
await pool(jobs, 6, async (k) => {
  try { const r = await yahoo(k); out.stocks[k] = { price: r.price, prev: r.prev, at: Date.now() }; ok++; }
  catch (e) { fail++; }
});
out.stats = { requested: jobs.length, ok, fail, setWindow, usWindow, thai: thai.size, us: us.size };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify(out.stats), "errors:", out.errors.join("; ") || "none", "crypto:", Object.keys(out.crypto).length, "stocks:", Object.keys(out.stocks).length);
