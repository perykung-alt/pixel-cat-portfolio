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

// ---------- Yahoo แบบมี cookie + crumb และขอเป็นชุด (ขอทีละตัวจาก GitHub จะโดน 429) ----------
let ysess = null;
async function yahooSession() {
  const r1 = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA }, redirect: "manual" });
  const sc = typeof r1.headers.getSetCookie === "function" ? r1.headers.getSetCookie() : [r1.headers.get("set-cookie")];
  const cookie = sc.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("no cookie (" + r1.status + ")");
  for (const host of ["query2", "query1"]) {
    const r2 = await fetch(`https://${host}.finance.yahoo.com/v1/test/getcrumb`, { headers: { "User-Agent": UA, Cookie: cookie } });
    const crumb = (await r2.text()).trim();
    if (r2.ok && crumb && !/[<{\s]/.test(crumb)) return { cookie, crumb };
  }
  throw new Error("no crumb");
}
async function yahooBatch(symbols) {
  const res = {};
  ysess ||= await yahooSession();
  for (let i = 0; i < symbols.length; i += 100) {
    const chunk = symbols.slice(i, i + 100);
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(","))}&crumb=${encodeURIComponent(ysess.crumb)}`;
    const j = await getJSON(url, { headers: { Cookie: ysess.cookie }, timeout: 20000 });
    for (const q of (j.quoteResponse && j.quoteResponse.result) || []) {
      const price = q.regularMarketPrice, prev = q.regularMarketPreviousClose ?? price;
      if (isFinite(price)) res[q.symbol] = { price, prev, at: Date.now(), src: "yq" };
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return res;
}
// สำรอง 1: spark หลายตัวต่อครั้ง (ไม่ต้องใช้ crumb)
async function yahooSpark(symbols) {
  const res = {};
  for (let i = 0; i < symbols.length; i += 20) {
    const chunk = symbols.slice(i, i + 20);
    try {
      const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=1d`, { headers: ysess ? { Cookie: ysess.cookie } : {} });
      const list = j.spark && j.spark.result ? j.spark.result.map((r) => [r.symbol, r.response && r.response[0] && r.response[0].meta]) : Object.entries(j).map(([k, v]) => [k, v]);
      for (const [sym, m] of list) {
        if (!m) continue;
        const price = m.regularMarketPrice ?? (Array.isArray(m.close) ? m.close.filter((x) => x != null).pop() : NaN);
        const prev = m.chartPreviousClose ?? m.previousClose ?? price;
        if (isFinite(price)) res[sym] = { price, prev, at: Date.now(), src: "ys" };
      }
    } catch (e) { if (/429/.test(e.message)) break; }
    await new Promise((r) => setTimeout(r, 600));
  }
  return res;
}
// สำรอง 2 (เฉพาะหุ้นสหรัฐฯ): Stooq CSV ทีละหลายตัว
async function stooq(symbols) {
  const res = {};
  for (let i = 0; i < symbols.length; i += 40) {
    const chunk = symbols.slice(i, i + 40);
    try {
      const r = await fetch(`https://stooq.com/q/l/?s=${chunk.map((s) => s.toLowerCase().replace(/\./g, "-") + ".us").join("+")}&f=sohlc&h&e=csv`, { headers: { "User-Agent": UA } });
      const lines = (await r.text()).trim().split(/\r?\n/).slice(1);
      for (const ln of lines) {
        const [sym, open, , , close] = ln.split(",");
        const c = num(close), o = num(open);
        if (isFinite(c) && c > 0) res[sym.replace(/\.US$/i, "").toUpperCase().replace(/-/g, ".")] = { price: c, prev: isFinite(o) ? o : c, at: Date.now(), src: "stooq" };
      }
    } catch (e) {}
  }
  return res;
}

const want = [...[...thai].map((s) => s + ".BK"), ...us, "THB=X"];
const got = {};
const srcErr = [];
// หลัก: CNBC (ขอได้ทีละหลายตัว ไม่บล็อกเซิร์ฟเวอร์ GitHub) — หุ้นไทยใช้ "-TH", เรทเงินใช้ "THB="
async function cnbc(list) {
  const res = {};
  const toC = (k) => (k === "THB=X" ? "THB=" : k.endsWith(".BK") ? k.slice(0, -3) + "-TH" : k.replace(/-/g, "."));
  for (let i = 0; i < list.length; i += 40) {
    const chunk = list.slice(i, i + 40);
    try {
      const url = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" + encodeURIComponent(chunk.map(toC).join("|")) + "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json";
      const j = await getJSON(url, { timeout: 20000 });
      const arr = [].concat((j.FormattedQuoteResult && j.FormattedQuoteResult.FormattedQuote) || []);
      const by = Object.fromEntries(arr.map((q) => [q.symbol, q]));
      for (const k of chunk) {
        const q = by[toC(k)]; if (!q || String(q.code) !== "0") continue;
        const last = num(q.last), ch = num(q.change), pdc = num(q.previous_day_closing);
        if (last > 0) res[k] = { price: last, prev: isFinite(ch) ? last - ch : pdc > 0 ? pdc : last, at: Date.now(), src: "cnbc" };
      }
    } catch (e) { srcErr.push("cnbc " + e.message); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return res;
}
Object.assign(got, await cnbc(want));
if (want.some((k) => !got[k])) { try { Object.assign(got, await yahooBatch(want.filter((k) => !got[k]))); } catch (e) { srcErr.push("yahoo-quote " + e.message); } }
let missing = want.filter((k) => !got[k]);
if (missing.length) { try { Object.assign(got, await yahooSpark(missing)); } catch (e) { srcErr.push("yahoo-spark " + e.message); } }
missing = [...us].filter((k) => !got[k]);
if (missing.length) { try { Object.assign(got, await stooq(missing)); } catch (e) { srcErr.push("stooq " + e.message); } }
for (const [k, v] of Object.entries(got)) if (k !== "THB=X") out.stocks[k] = v;

// USD/THB (สำรอง: open.er-api.com)
if (got["THB=X"]) out.fx = { price: got["THB=X"].price, prev: got["THB=X"].prev, at: Date.now() };
else {
  try { const j = await getJSON("https://open.er-api.com/v6/latest/USD"); const r = j.rates && j.rates.THB; if (r) out.fx = { price: r, prev: (prev.fx && prev.fx.price) || r, at: Date.now() }; }
  catch (e) { out.errors.push("fx " + e.message); }
}
out.errors.push(...srcErr);
const fresh = Object.values(out.stocks).filter((v) => Date.now() - (v.at || 0) < 3600e3).length;
out.stats = { wanted: want.length, got: Object.keys(got).length, fresh, total: Object.keys(out.stocks).length, bySrc: Object.values(got).reduce((a, v) => ((a[v.src] = (a[v.src] || 0) + 1), a), {}), setWindow, usWindow };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify(out.stats), "errors:", out.errors.join("; ") || "none", "crypto:", Object.keys(out.crypto).length);
