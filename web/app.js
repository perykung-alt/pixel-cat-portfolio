// Pixel Cat Portfolio — เว็บแอป (Android / คอม / iPhone ก็เปิดได้)
// ตรรกะคำนวณพอร์ต เวลาตลาด และแมว มาจาก shared.js (สร้างจากสคริปต์ iPhone ตัวเดียวกัน)
"use strict";
const REPO_URL = "https://github.com/perykung-alt/pixel-cat-portfolio";
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- เก็บข้อมูลในเครื่อง ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("บันทึกไม่ได้ (พื้นที่เบราว์เซอร์เต็มหรือถูกปิด)"); return false; } },
};
function loadData() {
  const d = LS.get("pcp:data", null) || { holdings: [], navs: {}, fresh: true };
  d.holdings ||= []; d.navs ||= {}; d.manual ||= {};
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  return d;
}
let data = loadData();
let hist = LS.get("pcp:hist", []);
let feed = LS.get("pcp:feed", null);
let S = null;
const IN_APP = typeof window.AndroidBridge !== "undefined";
// opts.touch=false: บันทึกโดยไม่นับเป็นการแก้ไข (เช่น ตอนรับข้อมูลจากคลาวด์)
const save = (opts = {}) => {
  if (opts.touch !== false) data.updatedAt = Date.now();
  const d = Object.assign({}, data); delete d.fresh; LS.set("pcp:data", d);
  if (IN_APP) try { AndroidBridge.save(JSON.stringify(d)); } catch (e) {}
  if (opts.touch !== false) schedulePush();
};

// ---------- ซิงก์คลาวด์ (Google) ----------
const DEVICE = IN_APP ? "android-app" : /iPhone|iPad/.test(navigator.userAgent) ? "ios-web" : /Android/.test(navigator.userAgent) ? "android-web" : "computer";
let pushTimer = null, syncing = false;
function schedulePush() {
  if (!window.Cloud || !Cloud.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
}
async function pushNow() {
  if (!Cloud.user) return;
  try { await Cloud.push(data, hist, DEVICE); LS.set("pcp:lastSync", Math.max(Date.now(), data.updatedAt || 0)); renderCloud(); }
  catch (e) { renderCloud("ซิงก์ไม่สำเร็จ: " + (e.code || e.message)); }
}
function adopt(c) {
  data = Object.assign({ holdings: [], navs: {}, manual: {} }, c.data);
  data.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {}); data.manual ||= {}; data.navs ||= {};
  if (Array.isArray(c.hist) && c.hist.length >= hist.length) { hist = c.hist; LS.set("pcp:hist", hist); }
  save({ touch: false }); applyTheme(); refresh();
}
// ดึงจากคลาวด์มาเทียบกับในเครื่อง แล้วเลือกข้อมูลที่ใหม่กว่า (ถามก่อนถ้าทั้งสองฝั่งมีการแก้ที่ยังไม่ได้ซิงก์)
async function syncNow(manual = false) {
  if (!window.Cloud || !Cloud.user || syncing) return;
  syncing = true; renderCloud("กำลังซิงก์…");
  try {
    const c = await Cloud.pull();
    const last = LS.get("pcp:lastSync", 0);
    const localAt = data.updatedAt || 0;
    const localHas = data.holdings.length > 0 && !data.sample;
    const cloudHas = !!(c && c.data && Array.isArray(c.data.holdings) && c.data.holdings.length);
    if (!c || !c.data) { if (localHas) await pushNow(); }
    else if (!localHas && cloudHas) adopt(c);            // เครื่องนี้ยังว่าง → ใช้ของบนคลาวด์
    else if (c.updatedAt > localAt) {
      // ในเครื่องมีการแก้ที่ยังไม่ได้ซิงก์ไหม (ยังไม่เคยซิงก์ = ดูว่ารายการต่างกันไหม)
      const differs = JSON.stringify(c.data.holdings) !== JSON.stringify(data.holdings);
      const localDirty = localHas && differs && (last ? localAt > last : true);
      if (localDirty) {
        const r = await askDialog(`<h2>พบข้อมูล 2 ชุด</h2><div class="sub">ข้อมูลบนคลาวด์และในเครื่องนี้ไม่ตรงกัน จะใช้ชุดไหน?</div>
          <div class="li"><span>☁️ บนคลาวด์ (${esc(c.device || "อุปกรณ์อื่น")})</span><span>${c.data.holdings.length} รายการ · ${new Date(c.updatedAt).toLocaleString("th-TH")}</span></div>
          <div class="li"><span>📱 ในเครื่องนี้</span><span>${data.holdings.length} รายการ · ${localAt ? new Date(localAt).toLocaleString("th-TH") : "-"}</span></div>
          <div class="acts"><button class="btn" value="local">ใช้ในเครื่องนี้</button><button class="btn pri" value="cloud">ใช้บนคลาวด์</button></div>`);
        if (r.value === "cloud") adopt(c); else if (r.value === "local") await pushNow();
      } else adopt(c);
    } else if (localAt > c.updatedAt && localHas) await pushNow();
    // กันนาฬิกาเครื่องอื่นเดินเร็ว: ถือว่าซิงก์ถึงเวลาของข้อมูลที่ใช้อยู่แล้ว
    LS.set("pcp:lastSync", Math.max(Date.now(), data.updatedAt || 0));
    renderCloud(manual ? "ซิงก์แล้ว ✓" : "");
  } catch (e) { renderCloud("ซิงก์ไม่สำเร็จ: " + (e.code || e.message)); }
  finally { syncing = false; }
}
function renderCloud(msg = "") {
  const body = $("cloudBody"), btns = $("cloudBtns"), chip = $("cloudChip");
  if (!body) return;
  if (!window.Cloud || !Cloud.configured) {
    body.innerHTML = "ยังไม่ได้เปิดระบบล็อกอิน — ตอนนี้ข้อมูลเก็บในเครื่องนี้เท่านั้น";
    btns.innerHTML = ""; chip.textContent = ""; return;
  }
  if (!Cloud.ready) { body.textContent = "กำลังตรวจสอบ…"; return; }
  const last = LS.get("pcp:lastSync", 0);
  if (Cloud.user) {
    chip.textContent = "☁️";
    body.innerHTML = `เข้าสู่ระบบแล้ว: <b>${esc(Cloud.user.email || Cloud.user.name || "")}</b><br>ข้อมูลซิงก์อัตโนมัติทุกครั้งที่แก้ไข · ใช้บัญชีเดียวกันได้ทุกเครื่อง${last ? `<br>ซิงก์ล่าสุด ${new Date(last).toLocaleString("th-TH")}` : ""}${msg ? `<br><b>${esc(msg)}</b>` : ""}`;
    btns.innerHTML = `<button class="btn sm" id="syncBtn">⟳ ซิงก์ตอนนี้</button><button class="btn sm danger" id="outBtn">ออกจากระบบ</button>`;
    $("syncBtn").onclick = () => syncNow(true);
    $("outBtn").onclick = async () => { if (confirm("ออกจากระบบ? ข้อมูลในเครื่องนี้ยังอยู่")) { await Cloud.signOut(); LS.set("pcp:lastSync", 0); } };
  } else {
    chip.textContent = "";
    body.innerHTML = `เข้าสู่ระบบด้วย Google เพื่อเก็บพอร์ตไว้บนคลาวด์ ข้อมูลไม่หายแม้ล้างเครื่อง และใช้ร่วมกันได้ทุกเครื่อง (Android / คอม)${Cloud.error ? `<br><span class="down">${esc(Cloud.error)}</span>` : ""}${msg ? `<br><b>${esc(msg)}</b>` : ""}`;
    btns.innerHTML = `<button class="btn pri sm" id="inBtn">เข้าสู่ระบบด้วย Google</button>`;
    $("inBtn").onclick = loginGoogle;
  }
}
async function loginGoogle() {
  try {
    // ในแอป Android: Google ไม่ให้ล็อกอินในเว็บวิว → เปิด Chrome ไปหน้า login แล้วส่ง token กลับเข้าแอป
    if (IN_APP && AndroidBridge.openLogin) { AndroidBridge.openLogin(APP_URL + "login.html?from=app"); toast("เปิด Chrome เพื่อเข้าสู่ระบบ…"); return; }
    await Cloud.signIn();
  } catch (e) { toast("เข้าสู่ระบบไม่สำเร็จ: " + (e.code || e.message), 5000); }
}
window.__nativeLogin = async (idToken) => {
  try { await Cloud.signInWithIdToken(idToken); toast("เข้าสู่ระบบแล้ว ☁️"); }
  catch (e) { toast("เข้าสู่ระบบในแอปไม่สำเร็จ: " + (e.code || e.message), 5000); }
};
// ส่งผลคำนวณให้ widget ของแอป Android
function pushWidget() {
  if (!IN_APP || !S) return;
  const H = holdsMarkets(S, data.settings);
  const cats = {};
  for (const c of CAT_ORDER) cats[c] = { value: S.cats[c].value, cost: S.cats[c].cost, day: S.cats[c].day };
  try { AndroidBridge.summary(JSON.stringify({ total: S.total, cost: S.cost, day: S.day, cats, at: feed && feed.at ? Math.max(feed.at, Date.now() - 60e3) : Date.now(), missing: S.errors, holdsThai: H.th, holdsUs: H.us })); } catch (e) {}
}

// ---------- ราคา ----------
// ดึงราคาหุ้นสดจาก CNBC ตรงจากมือถือ (ได้ทุกตัว ไม่จำกัดแค่รายชื่อในระบบ)
async function fetchStocks(list) {
  const want = [...new Map(list.filter((x) => x.type === "thai" || x.type === "us").map((x) => [key(x.type, x.symbol), x])).values()];
  const got = {};
  for (let i = 0; i < want.length; i += 40) {
    const chunk = want.slice(i, i + 40);
    try {
      const r = await fetch(cnbcURL(chunk.map((x) => cnbcSym(x.type, x.symbol)).concat(i === 0 ? ["THB="] : [])));
      const q = parseCNBC(await r.json());
      for (const x of chunk) { const v = q[cnbcSym(x.type, x.symbol)]; if (v) { got[key(x.type, x.symbol)] = v; feed.stocks[x.type === "thai" ? x.symbol + ".BK" : x.symbol] = v; } }
      if (q["THB="]) feed.fx = q["THB="];
    } catch (e) {}
  }
  return got;
}
async function loadFeed(extra = []) {
  // 1) ไฟล์ราคาจาก GitHub (หุ้นไทย/หุ้นนอก ฯลฯ)
  try {
    const r = await fetch("data/prices.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    feed = await r.json();
  } catch (e) { if (!feed) feed = { stocks: {}, crypto: {} }; }
  feed.stocks ||= {}; feed.crypto ||= {};
  // 2) ราคาสดที่มือถือดึงตรงได้: หุ้น + USD/THB (CNBC), คริปโต (Bitkub), ทอง (ฮั่วเซ่งเฮง)
  const all = data.holdings.concat(extra);
  const need = (t) => all.some((h) => h.type === t);
  const jobs = [fetchStocks(all)];
  if (need("crypto")) jobs.push(fetch("https://api.bitkub.com/api/v3/market/ticker").then((r) => r.json()).then((arr) => {
    for (const t of arr) {
      const [base, q] = String(t.symbol).split("_"); if (q !== "THB") continue;
      const last = num(t.last), pct = num(t.percent_change);
      if (isFinite(last)) feed.crypto[base] = { price: last, prev: isFinite(pct) ? last / (1 + pct / 100) : last };
    }
    feed.cryptoAt = Date.now();
  }).catch(() => {}));
  if (need("gold")) jobs.push(fetch("https://apicheckprice.huasengheng.com/api/values/getprice/").then((r) => r.json()).then((arr) => {
    const h = arr.find((x) => x.GoldType === "HSH") || arr[0]; const buy = num(h.Buy), chg = num(h.BuyChange) || 0;
    if (isFinite(buy)) feed.gold = { price: buy, prev: buy - chg, sell: num(h.Sell), at: Date.now() };
  }).catch(() => {}));
  await Promise.all(jobs); jobs.length = 0;
  if (!feed.fx || Date.now() - (feed.fx.at || 0) > 6 * 3600e3) jobs.push(fetch("https://open.er-api.com/v6/latest/USD").then((r) => r.json()).then((j) => {
    const v = j.rates && j.rates.THB; if (v) feed.fx = { price: v, prev: feed.fx && feed.fx.prev ? feed.fx.prev : v, at: Date.now() };
  }).catch(() => {}));
  await Promise.all(jobs);
  LS.set("pcp:feed", feed);
}
function buildP() {
  const prices = {}, errors = [];
  const f = feed || { stocks: {}, crypto: {} };
  for (const h of data.holdings) {
    const k = key(h.type, h.symbol);
    if (h.type === "fund" || prices[k]) continue;
    let p = null;
    if (h.type === "thai") p = f.stocks && f.stocks[h.symbol + ".BK"];
    else if (h.type === "us") p = f.stocks && f.stocks[h.symbol];
    else if (h.type === "crypto") p = f.crypto && f.crypto[h.symbol];
    else if (h.type === "gold") p = f.gold;
    const m = data.manual[k];
    if (p && isFinite(p.price)) prices[k] = { price: p.price, prev: isFinite(p.prev) ? p.prev : p.price };
    else if (m && isFinite(m.price)) prices[k] = { price: m.price, prev: m.price, manual: true };
    else errors.push(h.symbol);
  }
  const stale = !feed || Date.now() - (feed.at || 0) > 90 * 60e3;
  // ไม่มีเรทเงินเลย → ใช้เรทล่าสุดที่จำไว้ หรือค่าประมาณ (กันมูลค่าหุ้นนอกกลายเป็นค่าว่าง)
  let fx = f.fx && isFinite(f.fx.price) ? f.fx : LS.get("pcp:lastfx", null);
  if (fx && isFinite(fx.price)) LS.set("pcp:lastfx", fx); else fx = { price: 33.5, prev: 33.5, guess: true };
  return { prices, fx, balances: null, errors: [...new Set(errors)], stale };
}
function recompute() {
  S = data.holdings.length ? compute(data, buildP()) : null;
  if (S && !data.sample && S.total > 0) {
    const d = ymd(), snap = { d, v: Math.round(S.total), c: Math.round(S.cost), cats: {} };
    for (const c of CAT_ORDER) snap.cats[c] = Math.round(S.cats[c].value);
    const i = hist.findIndex((x) => x.d === d);
    if (i >= 0) hist[i] = snap; else hist.push(snap);
    hist.sort((a, b) => (a.d < b.d ? -1 : 1)); hist = hist.slice(-730);
    LS.set("pcp:hist", hist);
  }
}

// ---------- ตัวช่วย ----------
function toast(msg, ms = 2600) {
  const t = $("toast"); t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = "none"), ms);
}
const cl = (n) => (n >= 0 ? "up" : "down");
function shadeHex(h, k) {
  const n = parseInt(h.slice(1), 16);
  return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))).toString(16).padStart(2, "0")).join("");
}
function applyTheme() {
  const t = data.settings.theme;
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
async function copyText(s, okMsg = "คัดลอกแล้ว") {
  try { await navigator.clipboard.writeText(s); toast(okMsg); }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = s; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(okMsg); } catch (e2) { toast("คัดลอกไม่ได้ ลองกดค้างที่ข้อความแทน"); }
    ta.remove();
  }
}
const qtyStr = (q, type) => fmt(q, type === "crypto" ? 8 : 4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

// ---------- ห้องแมว (แอนิเมชัน) ----------
const ENGINE = makeCatEngine(SPR);
const room = { seq: [["sit", 10]], idx: 0, t0: performance.now(), tap: null, act: null };
function planRoom() {
  const act = catActivity(S, data.settings);
  room.act = act;
  const pool = PLAY[act.mood] || PLAY.normal, base = act.a;
  let seq;
  if (base === "watchTH" || base === "watchUS") seq = [[base, 14], ["stretch", 4], [base, 12], ["groom", 5], ["walk", 12], [base, 10]];
  else if (base === "sleep") seq = [["sleep", 24], ["stretch", 4], ["sleep", 20], ["loaf", 6]];
  else if (base === "eat") seq = [["eat", 10], ["groom", 6], ["loaf", 6], ["walk", 10]];
  else if (base === "ready") seq = [["ready", 8], ["stretch", 5], ["walk", 10], ["ready", 8]];
  else seq = [[base, 12]].concat([...new Set(pool.concat(["walk", "watchFly", "groom", "loaf", "butterfly", "yarn"]))].filter((x) => x !== base).map((x) => [x, x === "zoomies" ? 6 : 10]));
  if (JSON.stringify(seq) !== JSON.stringify(room.seq)) { room.seq = seq; room.idx = 0; room.t0 = performance.now(); }
}
function startRoom() {
  const cv = $("room"), cw = 96, ch = 52, px = 6, ctx = cv.getContext("2d");
  cv.width = cw * px; cv.height = ch * px; ctx.imageSmoothingEnabled = false;
  const P = (x, y, w, h, c, a) => { if (w <= 0 || h <= 0) return; ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = c; ctx.fillRect(Math.round(x * px), Math.round(y * px), w * px, h * px); ctx.globalAlpha = 1; };
  const PER = { walk: 16, yarn: 12, butterfly: 10, zoomies: 5 };
  const FT = { walk: .9, run: .45, yarn: .9, butterfly: .45, zoomies: .4, pounce: 1.6, eat: 1.2, sleep: 4, loaf: 4, groom: 2, stretch: 3, watchFly: 3 };
  let lastLine = "";
  cv.addEventListener("click", () => { room.tap = { a: Math.random() < 0.5 ? "zoomies" : "butterfly", until: performance.now() + 6000, t0: performance.now() }; });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame() {
    if (document.hidden || !$("tab-home").offsetParent) return;
    const now = performance.now(); let a, el;
    if (room.tap && now < room.tap.until) { a = room.tap.a; el = (now - room.tap.t0) / 1000; }
    else {
      room.tap = null; const cur = room.seq[room.idx]; el = (now - room.t0) / 1000;
      if (el > cur[1]) { room.idx = (room.idx + 1) % room.seq.length; room.t0 = now; el = 0; }
      a = room.seq[room.idx][0];
    }
    const per = PER[a] || 4, t = (el % per) / per, ft = ((now / 1000) % (FT[a] || 2)) / (FT[a] || 2);
    const act = room.act || { mood: "normal", sleepy: false, seed: 1, M: markets() };
    ctx.clearRect(0, 0, cv.width, cv.height);
    ENGINE.renderScene(P, {
      w: cw, h: ch, activity: a, mood: room.tap ? "happy" : act.mood, sleepy: act.sleepy, t, ft, seed: act.seed % 97,
      hour: markets().bkk.min / 60, catColor: data.settings.catColor,
      chartUp: a === "watchUS" ? (S ? S.cats.us.day + S.cats.fund.day >= 0 : true) : (S ? S.cats.thai.day >= 0 : true),
      catX: Math.round((cw - 34) * 0.35),
    });
    const ln = room.tap ? "เมี้ยว! เล่นด้วยกัน~" : actLine(S, Object.assign({}, act, { a }));
    if (ln !== lastLine) { lastLine = ln; $("say").textContent = ln; }
  }
  frame();
  setInterval(frame, reduce ? 1500 : 90);
}

// ---------- หน้าหลัก ----------
function pixelDonut(cv) {
  const N = 26, px = 6, ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const C = CAT_ORDER.filter((c) => S.cats[c].value > 0);
  if (!C.length) return;
  const tot = C.reduce((a, c) => a + S.cats[c].value, 0) || 1;
  let acc = 0; const b = C.map((c) => ({ end: (acc += S.cats[c].value / tot), color: CATS[c].color }));
  const R = N / 2 - .4, r = N / 2 - 8.2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + .5 - N / 2, dy = y + .5 - N / 2, d = Math.hypot(dx, dy);
    if (d > R || d < r) continue;
    let col;
    if (d > R - 1.15 || d < r + 1.15) col = "#2B1A12";
    else {
      const a = ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      col = (b.find((q) => a <= q.end) || b[b.length - 1]).color;
      if (d > R - 2.2) col = shadeHex(col, .25); else if (d < r + 2.2) col = shadeHex(col, -.22);
    }
    ctx.fillStyle = col; ctx.fillRect(x * px, y * px, px, px);
  }
}
function renderHome() {
  const st = data.settings, M = markets();
  $("catname").textContent = `♥ ${st.catName} · เลี้ยงมา ${catAgeDays(hist)} วัน`;
  const dot = (s) => (s.open ? "#3CCB6B" : ["pre", "break", "after"].includes(s.state) ? "#E8A33A" : "#8A8A8A");
  $("mk").innerHTML = [["🇹🇭 SET", M.th], ["🇺🇸 US", M.us]].map(([n, s]) => `<div><span class="dot" style="background:${dot(s)}"></span><b>${n}</b> ${esc(s.label)}</div>`).join("");
  if (!S) {
    $("lcd").innerHTML = `<div class="lab"><span>TOTAL · THB</span><span></span></div><div class="big">฿0</div><div class="pl">เพิ่มรายการซื้อที่แท็บ 🎒 พอร์ต หรือนำเข้าจากรูปด้วย AI ที่ ⚙️</div>`;
    $("mixcard").hidden = $("movecard").hidden = true; $("goal").innerHTML = ""; $("pricenote").textContent = "";
    return;
  }
  $("mixcard").hidden = $("movecard").hidden = false;
  const fa = feed && feed.at ? new Date(feed.at) : null;
  $("lcd").innerHTML = `<div class="lab"><span>TOTAL · THB</span><span>${fa ? "⟳ " + thDate(fa) + " " + hm(fa) : ""}</span></div>
    <div class="big">฿${fmt(S.total)}</div>
    <div class="pl"><span class="${S.pl >= 0 ? "u" : "d"}">${signed(S.pl)} (${pctStr(S.plPct)})</span> · <span class="${S.day >= 0 ? "u" : "d"}">วันนี้ ${signed(S.day)} (${pctStr(S.dayPct)})</span></div>`;
  if (st.goal > 0) {
    const pr = Math.max(0, Math.min(1, S.total / st.goal)), on = Math.round(pr * 20);
    $("goal").innerHTML = `<div class="sub" style="margin-top:10px">EXP เป้าหมาย ฿${fmt(st.goal)} · ${(pr * 100).toFixed(1)}%</div><div class="exp">${Array.from({ length: 20 }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>`;
  } else $("goal").innerHTML = "";
  const notes = [];
  if (isFinite(S.usdthb)) notes.push("USD/THB " + S.usdthb.toFixed(2));
  notes.push("ทองคิดที่ราคารับซื้อฮั่วเซ่งเฮง · ราคาอัปเดตทุก ~15 นาที");
  if (S.errors.length) notes.push("⚠︎ ยังไม่มีราคา: " + S.errors.join(", ") + " (แตะรายการที่แท็บพอร์ตเพื่อกรอกราคาเอง)");
  $("pricenote").textContent = notes.join(" · ");
  pixelDonut($("donut"));
  $("legend").innerHTML = CAT_ORDER.filter((c) => S.cats[c].value > 0).map((c) => {
    const x = S.cats[c];
    return `<div class="li"><span><span class="sq" style="background:${CATS[c].color}"></span>${CATS[c].name}<br><span class="sub">${x.share.toFixed(1)}%</span></span><span style="text-align:right">฿${fmt(x.value)}<br><span class="${cl(x.pl)}" style="font-size:12.5px">${pctStr(x.plPct)}</span></span></div>`;
  }).join("");
  const mv = [];
  if (S.best) mv.push(`<div class="li"><span>▲ ${esc(S.best.type === "gold" ? "ทอง" : S.best.symbol)}</span><b class="up">${pctStr(S.best.dayPct)}</b></div>`);
  if (S.worst) mv.push(`<div class="li"><span>▼ ${esc(S.worst.type === "gold" ? "ทอง" : S.worst.symbol)}</span><b class="down">${pctStr(S.worst.dayPct)}</b></div>`);
  $("moves").innerHTML = mv.join("") || `<div class="sub">ยังไม่มีการเปลี่ยนแปลงวันนี้</div>`;
}

// ---------- แท็บพอร์ต ----------
function renderPort() {
  if (!S || !S.rows.length) {
    $("holds").innerHTML = `<div class="empty">ยังไม่มีรายการ<br>กด ➕ เพิ่ม หรือนำเข้าจากรูปด้วย AI ที่แท็บ ⚙️</div>`;
    return;
  }
  const fi = data.settings.fundInfo || {};
  $("holds").innerHTML = S.rows.map((r, i) => {
    const region = r.type === "fund" ? (fi[r.symbol] ? REGION[fi[r.symbol].region] || "" : guessRegion(r.symbol) ? REGION.foreign + "?" : "") : "";
    const k = key(r.type, r.symbol), manual = data.manual[k] && !(feed && ((r.type === "thai" && feed.stocks[r.symbol + ".BK"]) || (r.type === "us" && feed.stocks[r.symbol]) || (r.type === "crypto" && feed.crypto[r.symbol])));
    const nav = r.type === "fund" ? data.navs[r.symbol] : null;
    return `<div class="hold" data-i="${i}">
      <div class="r1"><span><span class="sq" style="background:${CATS[r.cat].color}"></span>${esc(r.type === "gold" ? "ทองคำแท่ง 96.5%" : r.symbol)}${region ? `<span class="tag">${esc(region)}</span>` : ""}${r.missingPrice ? `<span class="tag warn">ไม่มีราคา</span>` : manual ? `<span class="tag">ราคากรอกเอง</span>` : ""}</span><span>฿${fmt(r.value)}</span></div>
      <div class="r2"><span>${qtyStr(r.qty, r.type)} ${TYPES[r.type].unit} · เฉลี่ย ฿${fmtPrice(r.avg)} · ล่าสุด ฿${fmtPrice(r.price)}${r.type === "us" && isFinite(r.native) ? ` ($${fmtPrice(r.native)})` : ""}</span><span class="${cl(r.pl)}" style="white-space:nowrap">${r.noCost ? "ไม่มีต้นทุน" : `${signed(r.pl)} (${pctStr(r.plPct)})`}</span></div>
      <div class="r2"><span>${CATS[r.cat].name}${nav ? ` · NAV ${nav.nav} (${esc(nav.date)})` : ""}${r.firstDate ? " · ซื้อครั้งแรก " + esc(r.firstDate) : ""}</span><span class="${cl(r.day)}">วันนี้ ${pctStr(r.dayPct)}</span></div>
    </div>`;
  }).join("");
  $("holds").querySelectorAll(".hold").forEach((el) => el.addEventListener("click", () => assetSheet(S.rows[+el.dataset.i])));
}

// ---------- กล่องโต้ตอบ ----------
// กล่องโต้ตอบแบบรอคำตอบ (ใช้แทน prompt() ที่บางเครื่อง/แอปที่ติดตั้งแล้วไม่แสดง)
function askDialog(html) {
  return new Promise((resolve) => {
    const dlg = $("dlg"), form = $("dlgForm");
    form.innerHTML = html;
    let result = null;
    form.onsubmit = (e) => { const btn = e.submitter; result = { value: btn ? btn.value : "ok", fd: new FormData(form) }; };
    // ตอบกลับหลังกล่องปิดสนิทแล้วเท่านั้น กันกล่องถัดไปถูกปิดตามโดยไม่ตั้งใจ
    dlg.addEventListener("close", () => setTimeout(() => resolve(result || { value: "cancel", fd: new FormData(form) }), 0), { once: true });
    if (dlg.open) dlg.close();
    dlg.showModal();
    const first = form.querySelector("input"); if (first) setTimeout(() => { first.focus(); first.select && first.select(); }, 50);
  });
}
function openDialog(html, onSubmit) {
  const dlg = $("dlg"), form = $("dlgForm");
  form.innerHTML = html;
  form.onsubmit = (e) => {
    const btn = e.submitter;
    if (!btn || btn.value === "cancel") return;
    const r = onSubmit(btn.value, new FormData(form));
    if (r === false) e.preventDefault();
  };
  dlg.showModal();
  const first = form.querySelector("input,select,textarea"); if (first) setTimeout(() => first.focus(), 50);
}
function holdingForm(h, title) {
  const t = h ? h.type : "thai";
  const opts = TYPE_ORDER.map((x) => `<option value="${x}" ${x === t ? "selected" : ""}>${TYPES[x].label}</option>`).join("");
  openDialog(`<h2>${title}</h2><div class="sub">ซื้อหลายครั้งให้เพิ่มทีละรายการ ระบบรวมเป็นราคาเฉลี่ยให้เอง</div>
    <label for="f_type">ประเภท</label><select id="f_type" name="type" ${h && h.id ? "disabled" : ""}>${opts}</select>
    <div id="f_symw"><label for="f_sym">สัญลักษณ์</label><input id="f_sym" name="symbol" autocapitalize="characters" autocomplete="off" value="${esc(h ? h.symbol : "")}"></div>
    <label for="f_qty" id="f_qtyl">จำนวน</label><input id="f_qty" name="qty" inputmode="decimal" value="${h && isFinite(h.qty) ? h.qty : ""}">
    <label for="f_avg" id="f_avgl">ราคาเฉลี่ย</label><input id="f_avg" name="avg" inputmode="decimal" value="${h && isFinite(h.avg) ? h.avg : ""}">
    <label for="f_date">วันที่ซื้อ</label><input id="f_date" name="date" type="date" value="${esc(h ? h.date : ymd())}">
    <div id="f_fxw"><label for="f_fx">เรท USD/THB ตอนซื้อ (เว้นว่าง = ใช้เรทปัจจุบัน)</label><input id="f_fx" name="fx" inputmode="decimal" value="${h && h.fx ? h.fx : ""}"></div>
    <div class="acts"><button class="btn" value="cancel" formnovalidate>ยกเลิก</button><button class="btn pri" value="ok">บันทึก</button></div>`,
  (v, fd) => {
    const type = h && h.id ? h.type : fd.get("type");
    let sym = type === "gold" ? "HSH" : String(fd.get("symbol") || "").toUpperCase().trim().replace(/\.BK$/, "");
    if (type === "crypto") sym = sym.replace(/[_/-]?THB$/, "");
    const out = { id: h && h.id ? h.id : uid(), type, symbol: sym, qty: num(fd.get("qty")), avg: num(fd.get("avg")), date: fd.get("date") || ymd() };
    if (type === "us" && isFinite(num(fd.get("fx")))) out.fx = num(fd.get("fx"));
    if (!sym || !(out.qty > 0) || !(out.avg >= 0)) { toast("กรอกสัญลักษณ์ จำนวน และราคาเฉลี่ยให้ครบ"); return false; }
    if (type === "us" && looksLikeThaiFund(sym) && confirm(`"${sym}" ดูเหมือนกองทุนรวมไทย (ราคาเป็นบาท/NAV)\nเปลี่ยนเป็น "กองทุนรวม" ไหม?`)) out.type = "fund", delete out.fx;
    if (h && h.id) data.holdings[data.holdings.findIndex((x) => x.id === h.id)] = out; else data.holdings.push(out);
    if (data.sample) { data.holdings = data.holdings.filter((x) => !x._sample); delete data.sample; }
    save(); refresh();
    setTimeout(() => {
      if (out.type === "fund" && !data.navs[out.symbol]) navForm(out.symbol);
      else if (["thai", "us", "crypto"].includes(out.type) && S && S.errors.includes(out.symbol)) toast(`ยังไม่มีราคา ${out.symbol} ในระบบ — แตะรายการเพื่อกรอกราคาเอง`, 4500);
    }, 100);
  });
  const sync = () => {
    const ty = $("f_type").value, T = TYPES[ty];
    $("f_symw").hidden = ty === "gold"; $("f_fxw").hidden = ty !== "us";
    $("f_sym").placeholder = T.ph; $("f_qtyl").textContent = `จำนวน (${T.unit})`;
    $("f_avgl").textContent = ty === "us" ? "ราคาเฉลี่ย (USD ต่อหุ้น)" : ty === "gold" ? "ราคาเฉลี่ยต่อ 1 บาททอง" : `ราคาเฉลี่ย (บาทต่อ${T.unit})`;
  };
  $("f_type").addEventListener("change", sync); sync();
}
function navForm(sym) {
  const cur = data.navs[sym], fi = (data.settings.fundInfo || {})[sym];
  openDialog(`<h2>NAV: ${esc(sym)}</h2><div class="sub">ดูได้จากแอป Dime หรือเว็บ บลจ.</div>
    <label for="n_nav">NAV ต่อหน่วย (บาท)</label><input id="n_nav" name="nav" inputmode="decimal" value="${cur ? cur.nav : ""}">
    <label for="n_date">วันที่ NAV</label><input id="n_date" name="date" type="date" value="${esc(cur ? cur.date : ymd())}">
    <label for="n_reg">กองนี้ลงทุนที่ไหน (ป้ายเท่านั้น หมวดยังเป็นกองทุนรวม)</label>
    <select id="n_reg" name="region"><option value="">ไม่ระบุ</option>${Object.entries(REGION).map(([k, v]) => `<option value="${k}" ${fi && fi.region === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <div class="acts"><button class="btn" value="cancel" formnovalidate>ยกเลิก</button><button class="btn pri" value="ok">บันทึก</button></div>`,
  (v, fd) => {
    const nav = num(fd.get("nav"));
    if (!(nav > 0)) { toast("NAV ไม่ถูกต้อง"); return false; }
    data.navs[sym] = { nav, date: fd.get("date") || ymd(), prev: cur ? cur.nav : nav };
    data.settings.fundInfo ||= {};
    if (fd.get("region")) data.settings.fundInfo[sym] = { region: fd.get("region") }; else delete data.settings.fundInfo[sym];
    save(); refresh();
  });
}
function manualForm(r) {
  const k = key(r.type, r.symbol), cur = data.manual[k];
  openDialog(`<h2>ราคาล่าสุด: ${esc(r.symbol)}</h2><div class="sub">ใช้เมื่อระบบยังไม่มีราคาตัวนี้ ${r.type === "us" ? "(ใส่เป็น USD)" : "(บาท)"} · ขอให้ระบบดึงให้อัตโนมัติได้ที่ GitHub Issue หัวข้อ "add ${esc(r.symbol)}"</div>
    <label for="m_p">ราคาต่อ${TYPES[r.type].unit}</label><input id="m_p" name="p" inputmode="decimal" value="${cur ? cur.price : ""}">
    <div class="acts"><button class="btn" value="cancel" formnovalidate>ยกเลิก</button>${cur ? `<button class="btn danger" value="del">ลบราคากรอกเอง</button>` : ""}<button class="btn pri" value="ok">บันทึก</button></div>`,
  (v, fd) => {
    if (v === "del") delete data.manual[k];
    else { const p = num(fd.get("p")); if (!(p > 0)) { toast("ราคาไม่ถูกต้อง"); return false; } data.manual[k] = { price: p, at: Date.now() }; }
    save(); refresh();
  });
}
function assetSheet(r) {
  const lots = data.holdings.filter((h) => h.type === r.type && h.symbol === r.symbol).sort((a, b) => (a.date < b.date ? 1 : -1));
  const extra = [];
  if (r.type === "fund") extra.push(`<button class="btn sm" value="nav">📝 อัปเดต NAV / ป้าย</button>`);
  if (["thai", "us", "crypto"].includes(r.type)) extra.push(`<button class="btn sm" value="manual">✍️ กรอกราคาเอง</button>`);
  extra.push(`<button class="btn sm" value="add">➕ ซื้อเพิ่ม</button>`, `<button class="btn sm" value="move">🔀 ย้ายหมวด</button>`);
  openDialog(`<h2>${esc(r.type === "gold" ? "ทองคำแท่ง 96.5%" : r.symbol)}</h2><div class="sub">${CATS[r.cat].name} · ${lots.length} ล็อต · แตะล็อตเพื่อแก้ไข</div>
    <div style="margin-top:8px">${lots.map((h) => `<button class="btn sm" style="width:100%;text-align:left;margin-top:6px" value="lot:${h.id}">${esc(h.date)} · ${qtyStr(h.qty, h.type)} ${TYPES[h.type].unit} @ ${fmtPrice(h.avg)}${h.type === "us" ? " USD" : ""}</button>`).join("") || `<div class="sub">มาจากบัญชีอื่น</div>`}</div>
    <div class="row" style="margin-top:12px">${extra.join("")}</div>
    <div class="acts"><button class="btn danger" value="delall">🗑 ลบทั้งหมด</button><button class="btn" value="cancel">ปิด</button></div>`,
  (v) => {
    setTimeout(() => {
      if (v === "nav") navForm(r.symbol);
      else if (v === "manual") manualForm(r);
      else if (v === "add") holdingForm({ type: r.type, symbol: r.symbol, date: ymd() }, "ซื้อเพิ่ม");
      else if (v.startsWith("lot:")) lotSheet(data.holdings.find((h) => h.id === v.slice(4)));
      else if (v === "move") moveForm(r);
      else if (v === "delall" && confirm(`ลบ ${r.symbol} ทุกล็อต?`)) { data.holdings = data.holdings.filter((h) => !(h.type === r.type && h.symbol === r.symbol)); save(); refresh(); }
    }, 50);
  });
}
function lotSheet(h) {
  if (!h) return;
  openDialog(`<h2>ล็อต ${esc(h.symbol)}</h2><div class="sub">${esc(h.date)} · ${qtyStr(h.qty, h.type)} ${TYPES[h.type].unit} @ ${fmtPrice(h.avg)}</div>
    <div class="acts"><button class="btn danger" value="del">ลบล็อตนี้</button><button class="btn" value="cancel">ปิด</button><button class="btn pri" value="edit">แก้ไข</button></div>`,
  (v) => setTimeout(() => {
    if (v === "edit") holdingForm(h, "แก้ไขรายการ");
    else if (v === "del" && confirm("ลบล็อตนี้?")) { data.holdings = data.holdings.filter((x) => x.id !== h.id); save(); refresh(); }
  }, 50));
}
function moveForm(r) {
  openDialog(`<h2>ย้ายหมวด: ${esc(r.symbol)}</h2>
    <label for="mv">ย้ายไปเป็น</label><select id="mv" name="t">${TYPE_ORDER.map((t) => `<option value="${t}" ${t === r.type ? "selected" : ""}>${TYPES[t].label}</option>`).join("")}</select>
    <div class="hint">ถ้าย้ายจากหุ้นต่างประเทศ ราคาเฉลี่ยที่เก็บเป็น USD ต้องแก้เป็นบาทเองด้วย</div>
    <div class="acts"><button class="btn" value="cancel" formnovalidate>ยกเลิก</button><button class="btn pri" value="ok">ย้าย</button></div>`,
  (v, fd) => {
    const nt = fd.get("t"); if (nt === r.type) return;
    for (const x of data.holdings) if (x.type === r.type && x.symbol === r.symbol) { x.type = nt; if (nt !== "us") delete x.fx; if (nt === "gold") x.symbol = "HSH"; }
    save(); refresh();
    if (nt === "fund" && !data.navs[r.symbol]) setTimeout(() => navForm(r.symbol), 80);
  });
}

// ---------- แท็บกราฟ ----------
function renderChart() {
  const cv = $("hist"), dpr = Math.min(3, devicePixelRatio || 1);
  const W = cv.clientWidth || 320, H = 150;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement), up = css.getPropertyValue("--up").trim(), down = css.getPropertyValue("--down").trim(), sub = css.getPropertyValue("--sub").trim();
  const pts = hist.slice(-60);
  if (pts.length < 2) {
    $("histnote").textContent = "แมวจะจดมูลค่าพอร์ตวันละ 1 จุดทุกครั้งที่เปิดแอป กราฟจะแสดงเมื่อมีข้อมูลตั้งแต่ 2 วัน";
  } else {
    const vals = pts.map((p) => p.v).concat(pts.map((p) => p.c));
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const n = pts.length, gap = 2, bw = Math.max(2, (W - gap * (n - 1)) / n), rows = 14, rh = (H - 16) / rows;
    pts.forEach((p, i) => {
      const lv = 1 + Math.round(((p.v - min) / rng) * (rows - 1));
      for (let k = 0; k < lv; k++) {
        ctx.fillStyle = i === n - 1 ? "#E8B92A" : p.v >= p.c ? up : down;
        ctx.globalAlpha = k === lv - 1 ? 1 : 0.7;
        ctx.fillRect(i * (bw + gap), H - (k + 1) * rh, bw, rh - 1);
      }
    });
    ctx.globalAlpha = 1; ctx.fillStyle = sub; ctx.font = "11px 'IBM Plex Sans Thai',sans-serif";
    ctx.fillText("฿" + compact(max), 2, 11);
    $("histnote").textContent = `${pts[0].d} ถึง ${pts[n - 1].d} · แท่งเขียว = เหนือทุน · แท่งแดง = ต่ำกว่าทุน · แท่งเหลือง = วันนี้`;
  }
  if (!S) { $("cvv").innerHTML = `<div class="empty">ยังไม่มีข้อมูล</div>`; return; }
  const C = CAT_ORDER.filter((c) => S.cats[c].value > 0), mx = Math.max(...C.map((c) => Math.max(S.cats[c].value, S.cats[c].cost))) || 1;
  $("cvv").innerHTML = C.map((c) => {
    const x = S.cats[c];
    return `<div style="margin:10px 0"><div class="r1" style="font-weight:600"><span><span class="sq" style="background:${CATS[c].color}"></span>${CATS[c].name}</span><span class="${cl(x.pl)}">${pctStr(x.plPct)}</span></div>
      <div style="height:12px;border:2px solid var(--ink);margin-top:4px;background:var(--bg)"><div style="height:100%;width:${(x.cost / mx) * 100}%;background:rgba(138,110,87,.45)"></div></div>
      <div style="height:12px;border:2px solid var(--ink);margin-top:3px;background:var(--bg)"><div style="height:100%;width:${(x.value / mx) * 100}%;background:${CATS[c].color}"></div></div>
      <div class="r2"><span>ต้นทุน ฿${fmt(x.cost)}</span><span>มูลค่า ฿${fmt(x.value)}</span></div></div>`;
  }).join("");
}

// ---------- แท็บตั้งค่า ----------
function renderSet() {
  const st = data.settings;
  $("sName").value = st.catName;
  $("sColor").innerHTML = Object.entries(CAT_COLORS).map(([k, v]) => `<option value="${k}" ${k === st.catColor ? "selected" : ""}>${v}</option>`).join("");
  $("sTheme").value = st.theme;
  $("sGoal").value = st.goal || "";
  $("about").innerHTML = `เวอร์ชัน ${VERSION} · อัปเดตเองอัตโนมัติเมื่อเปิดแอป<br>ข้อมูลพอร์ตเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น (ไม่ส่งขึ้นเซิร์ฟเวอร์) — ถ้าล้างข้อมูลเบราว์เซอร์ข้อมูลจะหาย ควรสำรองไว้เป็นระยะ<br>iPhone ใช้แบบ widget ได้ผ่านแอป Scriptable · <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>`;
}
function bindSet() {
  $("saveSet").onclick = () => {
    const st = data.settings;
    st.catName = ($("sName").value.trim() || "ส้มจี๊ด").slice(0, 12);
    st.catColor = $("sColor").value; st.theme = $("sTheme").value;
    const g = num($("sGoal").value); st.goal = g > 0 ? g : 0;
    save(); applyTheme(); refresh(); toast("บันทึกแล้ว 🐱");
  };
  $("copyPrompt").onclick = () => copyText(AI_PROMPT, "คัดลอก Prompt แล้ว ไปวางในแอป AI พร้อมแนบรูปได้เลย");
  $("aiImport").onclick = () => aiImport().catch((e) => toast("เกิดข้อผิดพลาด: " + e.message, 5000));
  const backup = () => JSON.stringify({ v: 2, data: Object.assign({}, data, { fresh: undefined }), hist });
  $("exportBtn").onclick = () => copyText(backup(), "คัดลอกข้อมูลสำรองแล้ว");
  $("dlBtn").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([backup()], { type: "application/json" }));
    a.download = `pixel-cat-backup-${ymd()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("impBtn").onclick = () => {
    try {
      const j = JSON.parse($("impText").value.trim());
      const d = j.data || j;
      if (!Array.isArray(d.holdings)) throw new Error();
      if (!confirm(`กู้คืน ${d.holdings.length} รายการ? ข้อมูลปัจจุบันจะถูกแทนที่`)) return;
      data = Object.assign({ navs: {}, manual: {} }, d); data.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {}); data.manual ||= {};
      if (Array.isArray(j.hist)) { hist = j.hist; LS.set("pcp:hist", hist); }
      save(); applyTheme(); refresh(); $("impText").value = ""; toast("กู้คืนสำเร็จ 🐱");
    } catch (e) { toast("ข้อความนี้ไม่ใช่ข้อมูลสำรองของพอร์ต"); }
  };
  $("shareBtn").onclick = async () => {
    const text = `🐱 Pixel Cat Portfolio — พอร์ตลงทุนกับแมวพิกเซล\n📱 Android / คอม: ${APP_URL} (เปิดใน Chrome → ⋮ → เพิ่มลงหน้าจอหลัก)\n🍎 iPhone (widget): ${REPO_URL}`;
    if (navigator.share) { try { await navigator.share({ title: "Pixel Cat Portfolio", text, url: APP_URL }); } catch (e) {} }
    else copyText(text, "คัดลอกข้อความแชร์แล้ว");
  };
  $("sampleBtn").onclick = () => {
    if (data.holdings.length && !data.sample) { toast("มีข้อมูลจริงอยู่แล้ว — ล้างก่อนถึงจะใส่ตัวอย่างได้"); return; }
    if (data.sample) { data.holdings = []; data.navs = {}; delete data.sample; toast("ล้างข้อมูลตัวอย่างแล้ว"); }
    else {
      data.holdings = [
        { id: uid(), type: "thai", symbol: "PTT", qty: 500, avg: 32.75, date: "2026-03-15" },
        { id: uid(), type: "us", symbol: "VOO", qty: 2, avg: 480, fx: 34.5, date: "2026-01-10" },
        { id: uid(), type: "fund", symbol: "K-USA-A(A)", qty: 3000, avg: 14.8, date: "2026-02-03" },
        { id: uid(), type: "crypto", symbol: "BTC", qty: 0.015, avg: 2400000, date: "2026-05-02" },
        { id: uid(), type: "gold", symbol: "HSH", qty: 1, avg: 61500, date: "2026-07-01" },
      ];
      data.navs["K-USA-A(A)"] = { nav: 15.9, date: ymd(), prev: 15.9 }; data.sample = true; toast("ใส่ข้อมูลตัวอย่างแล้ว");
    }
    save(); refresh();
  };
}
async function aiImport() {
  let items;
  try { items = parseAI($("aiText").value); } catch (e) { toast(e.message + " — คัดลอกคำตอบของ AI ทั้งก้อนมาวาง", 4000); return; }
  toast("กำลังดึงราคาล่าสุด…", 1500);
  await loadFeed(items.filter((x) => x.type && x.symbol));
  const f = feed, fx = f.fx ? f.fx.price : NaN;
  const priceFor = (x) => {
    if (x.type === "fund") return isFinite(x.nav) ? x.nav : data.navs[x.symbol] ? data.navs[x.symbol].nav : NaN;
    const p = x.type === "us" ? f.stocks[x.symbol] : x.type === "thai" ? f.stocks[x.symbol + ".BK"] : x.type === "crypto" ? f.crypto[x.symbol] : x.type === "gold" ? f.gold : null;
    const m = data.manual[key(x.type, x.symbol)];
    return p && isFinite(p.price) ? p.price : m ? m.price : NaN;
  };
  for (const x of items) {
    aiToUSD(x, fx);
    if (x.ok) continue;
    completeAI(x, priceFor(x));
    // ระบบยังไม่มีราคาตัวนี้ → ถามราคาปัจจุบัน (หรือแก้ชื่อถ้า AI อ่านผิด)
    for (let tries = 0; !x.ok && x.needPrice && tries < 3; tries++) {
      const cur = x.type === "us" ? "USD" : "บาท";
      const r = await askDialog(`<h2>ต้องการราคา ${esc(x.symbol)}</h2>
        <div class="sub">หาราคา ${esc(x.symbol)} ไม่เจอ — ถ้า AI อ่านชื่อผิด แก้ชื่อแล้วกด "คำนวณ" ได้เลย (ไม่ต้องใส่ราคา) · ภาพมีแค่มูลค่า ${fmtPrice(x.value)} ${esc(x.currency || cur)} ระบบต้องใช้ราคาปัจจุบันต่อ${TYPES[x.type] ? TYPES[x.type].unit : "หน่วย"}เพื่อคำนวณจำนวนและต้นทุนเฉลี่ย ดูราคาได้ในแอป Dime</div>
        <label for="q_s">ชื่อหุ้น (แก้ได้ถ้า AI อ่านผิด)</label><input id="q_s" name="s" value="${esc(x.symbol)}" autocapitalize="characters">
        <label for="q_p">หรือใส่ราคาปัจจุบันเอง (${cur})</label><input id="q_p" name="p" inputmode="decimal" placeholder="เว้นว่าง = ให้ระบบหาราคาให้">
        <div class="acts"><button class="btn" value="skip" formnovalidate>ข้ามตัวนี้</button><button class="btn pri" value="ok">คำนวณ</button></div>`);
      if (r.value !== "ok") break;
      const ns = String(r.fd.get("s") || "").toUpperCase().trim().replace(/\.BK$/, "");
      if (ns) x.symbol = ns;
      const p = num(r.fd.get("p"));
      if (p > 0) { data.manual[key(x.type, x.symbol)] = { price: p, at: Date.now() }; completeAI(x, p); }
      else { await fetchStocks([x]); completeAI(x, priceFor(x)); }
    }
  }
  const line = (x) => `<div class="li"><span>${x.ok ? "•" : "⚠︎"} <b>${esc(x.symbol || "?")}</b> <span class="sub">${x.type ? CATS[TYPES[x.type].cat].name : "?"}${x.moved ? " (แก้หมวดให้)" : ""}${x.region ? " · " + REGION[x.region] : ""}</span></span><span style="text-align:right">${isFinite(x.qty) ? qtyStr(x.qty, x.type) : "?"} @ ${isFinite(x.avg) ? fmtPrice(x.avg) + (x.type === "us" ? " USD" : "") : "?"}${x.derived ? `<br><span class="sub">คำนวณจากมูลค่า</span>` : ""}</span></div>`;
  const good = items.filter((x) => x.ok), bad = items.length - good.length;
  if (!good.length) { toast("ยังนำเข้าไม่ได้ — ไม่มีรายการที่ข้อมูลครบ", 4000); return; }
  const r = await askDialog(`<h2>พบ ${items.length} รายการ</h2>${items.map(line).join("")}
    ${bad ? `<div class="hint">⚠︎ ${bad} รายการข้อมูลไม่ครบ จะข้ามไป (เพิ่มเองทีหลังได้)</div>` : ""}
    <label for="ai_mode">วิธีนำเข้า</label><select id="ai_mode" name="mode"><option value="replace">อัปเดตทับตัวเดิม (แนะนำ: รูปคือยอดถือปัจจุบัน)</option><option value="add">เพิ่มเป็นรายการซื้อใหม่ (เก็บของเดิม)</option></select>
    <div class="acts"><button class="btn" value="cancel" formnovalidate>ยกเลิก</button><button class="btn pri" value="ok">นำเข้า ${good.length} รายการ</button></div>`);
  if (r.value !== "ok") { save(); return; }
  const replace = r.fd.get("mode") === "replace";
  if (data.sample) { data.holdings = []; data.navs = {}; delete data.sample; }
  for (const x of good) {
    const existing = data.holdings.filter((e) => e.type === x.type && e.symbol === x.symbol);
    const h = { id: uid(), type: x.type, symbol: x.symbol, qty: x.qty, avg: x.avg, date: x.date || existing.map((e) => e.date).sort()[0] || ymd() };
    if (x.fx) h.fx = x.fx;
    if (replace) data.holdings = data.holdings.filter((e) => !(e.type === h.type && e.symbol === h.symbol));
    data.holdings.push(h);
    if (h.type === "fund" && x.region) { data.settings.fundInfo ||= {}; data.settings.fundInfo[h.symbol] = { region: x.region }; }
    if (h.type === "fund" && isFinite(x.nav) && x.nav > 0) { const c = data.navs[h.symbol]; data.navs[h.symbol] = { nav: x.nav, date: ymd(), prev: c ? c.nav : x.nav }; }
  }
  save(); refresh(); $("aiText").value = "";
  showTab("port");
  const needNav = [...new Set(data.holdings.filter((h) => h.type === "fund" && !data.navs[h.symbol]).map((h) => h.symbol))];
  toast(`นำเข้า ${good.length} รายการแล้ว 🐱` + (needNav.length ? ` · กองทุนที่ยังไม่มี NAV: ${needNav.join(", ")}` : ""), 4500);
}

// ---------- แท็บ / รอบอัปเดต ----------
let currentTab = "home";
function showTab(t) {
  currentTab = t;
  document.querySelectorAll("nav.tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  for (const x of ["home", "port", "chart", "set"]) $("tab-" + x).hidden = x !== t;
  if (t === "chart") renderChart();
  if (t === "set") renderSet();
  scrollTo(0, 0);
}
function refresh() {
  recompute(); planRoom(); pushWidget();
  // แต่ละส่วนวาดแยกกัน ส่วนไหนพังจะไม่ลากส่วนอื่นพังตาม
  for (const fn of [renderHome, renderPort]) { try { fn(); } catch (e) { toast("⚠︎ " + fn.name + ": " + e.message, 5000); } }
  if (currentTab === "chart") renderChart();
}
async function tick() { await loadFeed(); refresh(); }

// ---------- เริ่มต้น ----------
// แสดง error ให้เห็นบนจอ (แทนที่จะเงียบหายไป)
addEventListener("error", (e) => toast("⚠︎ " + (e.message || "เกิดข้อผิดพลาด"), 5000));
addEventListener("unhandledrejection", (e) => toast("⚠︎ " + ((e.reason && e.reason.message) || e.reason || "เกิดข้อผิดพลาด"), 5000));
(async function init() {
  $("ver").textContent = "v" + VERSION + (IN_APP ? " · แอป " + (AndroidBridge.version ? AndroidBridge.version() : "") : "");
  if (IN_APP) {
    $("appCard").hidden = false;
    $("widgetNow").onclick = () => { pushWidget(); try { AndroidBridge.refreshWidget(); } catch (e) {} toast("กำลังอัปเดต widget… 🐱"); };
    save({ touch: false });
  }
  applyTheme();
  document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  $("addBtn").onclick = () => holdingForm(null, "เพิ่มรายการซื้อ");
  bindSet();
  refresh(); startRoom();
  if (window.Cloud) {
    let prevUid = null;
    Cloud.onChange(() => { const uid = Cloud.user && Cloud.user.uid; renderCloud(); if (uid && uid !== prevUid) syncNow(); prevUid = uid; });
    Cloud.init();
  }
  renderCloud();
  await tick();
  if (data.fresh) {
    openDialog(`<h2>ยินดีต้อนรับ 🐱</h2><div class="sub">ตั้งชื่อแมวประจำพอร์ตของคุณ (เปลี่ยนทีหลังได้)</div>
      <label for="w_n">ชื่อแมว</label><input id="w_n" name="n" maxlength="12" value="ส้มจี๊ด">
      <div class="hint">${window.Cloud && Cloud.configured ? "เคยใช้แล้ว? กด \"เข้าสู่ระบบด้วย Google\" เพื่อดึงพอร์ตเดิมจากคลาวด์" : "ข้อมูลเก็บในเครื่องนี้ · ย้ายข้อมูลจาก iPhone ได้ที่แท็บ ⚙️ → สำรอง / ย้ายข้อมูล"}</div>
      <div class="acts">${window.Cloud && Cloud.configured ? `<button class="btn" value="login">เข้าสู่ระบบด้วย Google</button>` : ""}<button class="btn pri" value="ok">เริ่มเลย</button></div>`,
    (v, fd) => { data.settings.catName = (String(fd.get("n") || "").trim() || "ส้มจี๊ด").slice(0, 12); delete data.fresh; save(); refresh(); if (v === "login") setTimeout(loginGoogle, 50); });
  }
  setInterval(tick, 5 * 60e3);
  setInterval(() => { planRoom(); if (currentTab === "home") renderHome(); }, 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  addEventListener("resize", () => { if (currentTab === "chart") renderChart(); });
  let deferred = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); if (IN_APP) return; deferred = e; $("installBtn").hidden = false; });
  $("installBtn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $("installBtn").hidden = true; };
  if ("serviceWorker" in navigator) {
    try {
      const hadSW = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("sw.js?v=__BUILD__");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw && nw.addEventListener("statechange", () => { if (nw.state === "activated" && hadSW) toast("✨ มีเวอร์ชันใหม่ — ปิดแล้วเปิดแอปใหม่เพื่อใช้งาน", 5000); });
      });
    } catch (e) {}
  }
})();
