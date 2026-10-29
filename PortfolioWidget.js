// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: cat;
/*
 * ==========================================================
 *  PIXEL CAT PORTFOLIO  v6.2  — หุ้นไทย / หุ้นต่างประเทศ / กองทุนรวม / คริปโต / ทองคำ
 *  สำหรับแอป Scriptable (iOS) · widget เล็ก / กลาง / ใหญ่ / ล็อกสกรีน
 * ----------------------------------------------------------
 *  อัปเดตอัตโนมัติ: สคริปต์เช็กเวอร์ชันใหม่จาก GitHub เอง (ทุก 6 ชม.) แล้วเขียนทับตัวเอง
 *  ข้อมูลพอร์ต/ตั้งค่า/API key อยู่ในเครื่องของแต่ละคน ไม่ถูกแตะตอนอัปเดต
 *  https://github.com/perykung-alt/pixel-cat-portfolio
 *  (ข้อมูลเก็บแยกไว้ในโฟลเดอร์ iCloud Drive/Scriptable/PortfolioWidget)
 *
 *  แหล่งราคา
 *   • หุ้น/ETF ต่างประเทศ + หุ้นไทย : Yahoo Finance (หุ้นไทยเติม .BK ให้อัตโนมัติ)
 *   • อัตราแลกเปลี่ยน USD/THB      : Yahoo Finance (THB=X)
 *   • คริปโต                         : Bitkub public API (ราคา THB)
 *   • ทองคำแท่ง 96.5%                : ฮั่วเซ่งเฮง (ราคารับซื้อ ต่อ 1 บาททอง)
 *   • กองทุนรวม                      : กรอก NAV เอง จากเมนู "อัปเดต NAV"
 * ==========================================================
 */

// ---------- ค่าคงที่ ----------
const REFRESH_MIN = 15;
// หมวดตาม "สิ่งที่ถือจริง" (ประเภทสินทรัพย์ทางกฎหมาย) ไม่ใช่ตามที่กองทุนไปลงทุน
//  • กองทุนรวมที่จดทะเบียนในไทย (เช่น KKP US500-UH-E, K-USA-A(A)) = "กองทุนรวม" เสมอ
//    แม้จะลงทุนหุ้นต่างประเทศ → แสดงป้าย "ลงทุนต่างประเทศ" แยกให้แทน
//  • "หุ้นต่างประเทศ" = หุ้น/ETF ที่ซื้อตรงในตลาดต่างประเทศ ราคาเป็น USD เท่านั้น
// @shared-begin
const CATS = {
  thai:   { name: "หุ้นไทย",        short: "หุ้นไทย", color: "#FF8A3D" },
  us:     { name: "หุ้นต่างประเทศ", short: "หุ้นนอก", color: "#4AA3FF" },
  fund:   { name: "กองทุนรวม",      short: "กองทุน",  color: "#2FC79A" },
  crypto: { name: "คริปโต",         short: "คริปโต",  color: "#B26BFF" },
  gold:   { name: "ทองคำ",          short: "ทอง",     color: "#FFC83D" },
};
const CAT_ORDER = ["thai", "us", "fund", "crypto", "gold"];
const TYPES = {
  thai:   { cat: "thai",   label: "หุ้นไทย (SET/mai)",                       unit: "หุ้น",    ph: "เช่น PTT, CPALL" },
  us:     { cat: "us",     label: "หุ้น/ETF ต่างประเทศ ซื้อตรง (ราคา USD)",   unit: "หุ้น",    ph: "เช่น VOO, QQQ, NVDA" },
  fund:   { cat: "fund",   label: "กองทุนรวมไทย (รวม Feeder ลงทุนต่างประเทศ)", unit: "หน่วย",   ph: "เช่น KKP US500-UH-E" },
  crypto: { cat: "crypto", label: "คริปโต (ราคา Bitkub)",                    unit: "เหรียญ",  ph: "เช่น BTC, ETH" },
  gold:   { cat: "gold",   label: "ทองคำแท่ง 96.5% (ฮั่วเซ่งเฮง)",           unit: "บาททอง",  ph: "HSH" },
};
const REGION = { foreign: "ลงทุนต่างประเทศ", thai: "ลงทุนในไทย", mixed: "ผสมไทย+ต่างประเทศ" };
// ชื่อ บลจ. ไทยที่พบบ่อย ใช้ช่วยจับว่าเป็นกองทุนรวม ไม่ใช่หุ้นต่างประเทศ
const TH_AMC = /^(KKP|K-|KF|KT|KTAM|SCB|TMB|TTB|ES-|ONE-|PRINCIPAL|LHFUND|LH|UOB|UOBS|KSAM|ASP|MEGA|TISCO|TCM|B-|BBL|BCAP|KASSET|KAPS|MFC|M-|DAOL|CIMB|AIA|ABERDEEN|ABAPAC|ABSM|PHATRA|KUB|KWI|XSPRING|INNOVEST|TALIS|EASTSPRING|BCARE|BTP|TP|SMART|THANACHART|T-|TGHPE|WE)/;
// เดาเขตลงทุนจากชื่อกองทุน (ใช้แสดงป้ายพร้อม ? จนกว่าผู้ใช้จะยืนยัน)
function guessRegion(sym) {
  return /(US|USA|S&P|SP500|NASDAQ|NDQ|GLOBAL|GL|WORLD|CHINA|CN|JAPAN|JP|EU|EURO|INDIA|IN|VIET|VN|ASIA|TECH|AI|HEALTH|GOLD|OIL|REIT|EM)(\d|-|\b|\(|$)/.test(String(sym).toUpperCase());
}
function looksLikeThaiFund(sym) {
  const s = String(sym || "").toUpperCase().trim();
  if (/\s/.test(s)) return true;                                     // ชื่อมีเว้นวรรค เช่น "KKP US500-UH-E"
  if (/\((A|D|R|E|SSF|RMF|SSFX|TESG|THAIESG)\)$/.test(s)) return true; // คลาสหน่วยลงทุน (A) (SSF) ฯลฯ
  if (/-(UH|H|E|A|D|R|SSF|RMF|TESG|THAIESG|FX|AI|SSFX|RE|ACC|DIV)(-|$)/.test(s) && s.split("-").length >= 2 && s.length > 6) return true;
  if (TH_AMC.test(s) && /-/.test(s)) return true;
  return false;
}
const TYPE_ORDER = ["thai", "us", "fund", "crypto", "gold"];
const CAT_COLORS = { siamese: "วิเชียรมาศ (สยาม)", scottish: "สกอตทิชโฟลด์ ทับบี้", british: "บริติช น้ำตาลเข้ม", orange: "ส้มลายเสือ", gray: "เทาสลิด", black: "ดำตาเหลือง", white: "ขาวตาฟ้า", calico: "สามสี" };
const DEFAULT_SETTINGS = { catName: "ส้มจี๊ด", catColor: "orange", theme: "auto", goal: 0, fundInfo: {}, autoUpdate: true, notify: true };

// ---------- สไปรต์แมวพิกเซล ----------
const SPR = {"base":["......................","..K..........K........",".KPK........KPK.......",".KPPK......KPPK.......","KOPPOKKKKKKOPPOK......","KOOOOODOODOOOOOK......","KOOOOOODDOOOOOOK......","KOOEEOOOOOOEEOOK......","KOOEWOOOOOOEWOOK......","KPOOOOLNNLOOOOPK......","KOOOOLKLLKLOOOOK......",".KOOOOLLLLOOOOK.......","..KKOOOOOOOOKK...KK...","..KOOOLLLLOOOK..KOOK..",".KOODLLLLLLDOOK..KOK..",".KOODLLLLLLDOOK.KOK...",".KOOOLLLLLLOOOKKOK....",".KLLKOOLLOOKLLKOOK....","ccKKKKKKKKKKKKKKKcc...","cCCCCCCCCCCCCCCCCCCc..",".cccccccccccccccccc..."],"eyes":{"normal":[["KOOEEOOOOOOEEOOK",7],["KOOEWOOOOOOWEOOK",8]],"happy":[["KOOKKOOOOOOKKOOK",7],["KOKOOKOOOOKOOKOK",8]],"sad":[["KOKOOOOOOOOOOKOK",6],["KOOKEOOOOOOEKOOK",7],["KOOEWOOOOOOWEOOK",8]],"sleep":[["KOOOOOOOOOOOOOOK",7],["KOKKKOOOOOOKKKOK",8]],"wow":[["KOOEEOODDOOEEOOK",6],["KOEEWOOOOOOEEWOK",7],["KOEEEOOOOOOEEEOK",8]]},"mouth":{"normal":["KOOOOLKLLKLOOOOK",10],"happy":["KOOOOLKLLKLOOOOK",10],"sad":["KOOOOLLKKLLOOOOK",10],"sleep":["KOOOOLLKKLLOOOOK",10],"wow":["KOOOOLLKKLLOOOOK",10]},"extra":{"sad":[[3,9,"B"],[3,10,"B"]],"wow":[[19,1,"Y"],[18,2,"Y"],[19,2,"W"],[20,2,"Y"],[17,3,"Y"],[18,3,"W"],[19,3,"W"],[20,3,"W"],[21,3,"Y"],[18,4,"Y"],[19,4,"W"],[20,4,"Y"],[19,5,"Y"]],"happy":[[17,3,"P"],[18,3,"P"],[20,3,"P"],[21,3,"P"],[17,4,"P"],[18,4,"P"],[19,4,"P"],[20,4,"P"],[21,4,"P"],[18,5,"P"],[19,5,"P"],[20,5,"P"],[19,6,"P"],[18,3,"W"]],"sleep":[[18,0,"Z"],[19,0,"Z"],[20,0,"Z"],[21,0,"Z"],[20,1,"Z"],[19,2,"Z"],[18,3,"Z"],[19,3,"Z"],[20,3,"Z"],[21,3,"Z"]]},"palettes":{"orange":{"K":"#3B2418","O":"#F59B42","D":"#C8681E","L":"#FFE3B8","P":"#FF8FA3","N":"#E85A7A","E":"#2A1A12","W":"#FFFFFF"},"gray":{"K":"#22252E","O":"#9AA3B2","D":"#6B7385","L":"#E9EDF3","P":"#FF9EB1","N":"#E2627F","E":"#14161C","W":"#FFFFFF"},"black":{"K":"#0E0E14","O":"#3A3A4A","D":"#2A2A36","L":"#5A5A70","P":"#FF8FA3","N":"#E85A7A","E":"#FFD84A","W":"#FFFFFF"},"white":{"K":"#4A3F3A","O":"#FFF8EE","D":"#F0DCC4","L":"#FFFFFF","P":"#FFA8B8","N":"#F07A93","E":"#3A6FD8","W":"#FFFFFF"},"calico":{"K":"#3A2418","O":"#FFF5E6","D":"#F28C38","L":"#FFFFFF","P":"#FF9EB1","N":"#E85A7A","E":"#2A1A12","W":"#FFFFFF"},"scottish":{"K":"#2E2620","O":"#9C8B74","D":"#55473A","L":"#FFFFFF","P":"#E9A0A8","N":"#C97B7B","E":"#1F2620","W":"#FFFFFF","G":"#93AE80"},"british":{"K":"#2A1A10","O":"#8A5A2E","D":"#5A3519","L":"#D9B88A","P":"#D9928A","N":"#B5655E","E":"#C7861A","W":"#FFF3D0"},"siamese":{"K":"#2B1D15","O":"#F1E2C6","D":"#4A3326","L":"#4A3326","M":"#FBF3E3","P":"#FF9EB1","N":"#1E140E","E":"#3D7FE0","W":"#FFFFFF","G":"#93AE80"}},"fixed":{"C":"#E2464F","c":"#9E2A3A","B":"#5BC0FF","Y":"#FFD84A","Z":"#8FB8FF","G":"#93AE80"},"breeds":{"scottish":{"rows":{"1":"................","2":"................","3":".KKK........KKK.","4":"KODOKKKKKKKKODOK","5":"KOOOODODDODOOOOK","6":"KOOOOOODDOOOOOOK","14":".KODDLLLLLLDDOK.","15":".KOOOLLLLLLOOOK."},"eyes":{"normal":[["KOOGGOODDOOGGOOK",6],["KOGEWOOOOOOWEGOK",7],["KOGEEOOOOOOEEGOK",8]],"wow":[["KOGGGOODDOOGGGOK",6],["KOGEWOOOOOOWEGOK",7],["KOGEEOOOOOOEEGOK",8]]}},"british":{"rows":{"1":"................","2":"................","3":".KK..........KK.","4":"KPPKKKKKKKKKKPPK","5":"KOOOOOODDOOOOOOK","6":"KOOOOOOOOOOOOOOK"},"eyes":{"normal":[["KOOKKOOOOOOKKOOK",7],["KOOEEOOOOOOEEOOK",8]]}},"siamese":{"rows":{"5":"KOOOOOOOOOOOOOOK","6":"KOOOOOOOOOOOOOOK"},"post":{"2":"_DD_________DD_","3":"_DDD_______DDD_","4":"__DD________DD__","9":"_O__DDD__DDD__O_","13":"______MMMM_______DD___","14":"_____MMMMMM_______D___","15":"_____MMMMMM______D____","16":"_____MMMMMM_____D_____","17":"_______________DD_____","7":"______DDDD______","8":"_____DDDDDD_____"}}}};
// สไปรต์หน้าตรง: base → แถวเฉพาะพันธุ์ → ตา/ปาก/ของประกอบตามอารมณ์ → post (ลายเฉพาะพันธุ์ที่ต้องทับทีหลัง เช่น หน้ากากวิเชียรมาศ, "_" = คงเดิม)
function catGrid(mood, breed) {
  const g = SPR.base.map((r) => r.split(""));
  const B = (SPR.breeds || {})[breed] || {};
  for (const [i, row] of Object.entries(B.rows || {})) for (let x = 0; x < row.length; x++) g[+i][x] = row[x];
  for (const [row, i] of ((B.eyes || {})[mood] || SPR.eyes[mood])) for (let x = 0; x < row.length; x++) g[i][x] = row[x];
  const [m, mi] = SPR.mouth[mood];
  for (let x = 0; x < m.length; x++) g[mi][x] = m[x];
  for (const [x, y, c] of SPR.extra[mood] || []) g[y][x] = c;
  for (const [i, row] of Object.entries(B.post || {})) for (let x = 0; x < row.length && x < g[+i].length; x++) if (row[x] !== "_") g[+i][x] = row[x];
  return g;
}
// @shared-end

// ---------- เวอร์ชัน & อัปเดตอัตโนมัติ ----------
const VERSION = "6.7.0";
const REPO = "perykung-alt/pixel-cat-portfolio";
const UPDATE_BASE = `https://raw.githubusercontent.com/${REPO}/main/`;
const REPO_URL = `https://github.com/${REPO}`;
const WEB_URL = "https://perykung-alt.github.io/pixel-cat-portfolio/";
const UPDATE_EVERY_H = 6;
function verCmp(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
function selfFM() {
  const f = module.filename || "";
  try { if (f.includes("Mobile Documents") || f.includes("iCloud")) return FileManager.iCloud(); } catch (e) {}
  return FileManager.local();
}
async function fetchText(url, timeout = 12) {
  const r = new Request(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
  r.timeoutInterval = timeout;
  r.headers = { "Cache-Control": "no-cache" };
  const txt = await r.loadString();
  if (r.response && r.response.statusCode && r.response.statusCode !== 200) throw new Error("HTTP " + r.response.statusCode);
  return txt;
}
// ตรวจโค้ดใหม่ก่อนเขียนทับ: ต้องเป็นสคริปต์ของเรา เวอร์ชันตรงกับ manifest และ syntax ถูกต้อง
function validCode(code, ver) {
  if (!code || code.length < 50000) return false;
  if (!code.includes("PIXEL CAT PORTFOLIO") || !code.includes(`const VERSION = "${ver}"`)) return false;
  try { const AF = Object.getPrototypeOf(async function () {}).constructor; new AF(code); } catch (e) { return false; }
  return true;
}
async function checkUpdate({ force = false, apply = true } = {}) {
  const F_UPD = fm.joinPath(DIR, "update.json");
  const st = await readJSON(F_UPD, {});
  if (!force && st.last && Date.now() - st.last < UPDATE_EVERY_H * 3600e3) return { skipped: true, st };
  st.last = Date.now();
  writeJSON(F_UPD, st);
  const man = JSON.parse(await fetchText(UPDATE_BASE + "version.json", 8));
  if (!man.version || verCmp(man.version, VERSION) <= 0) return { latest: true, man };
  if (!apply) return { available: true, man };
  const code = await fetchText(UPDATE_BASE + (man.file || "PortfolioWidget.js"), 20);
  if (!validCode(code, man.version)) throw new Error("ไฟล์อัปเดตไม่ผ่านการตรวจ ข้ามรอบนี้");
  const sfm = selfFM();
  const path = module.filename;
  try { sfm.writeString(fm.joinPath(DIR, "backup-v" + VERSION + ".js"), sfm.readString(path)); } catch (e) {}
  sfm.writeString(path, code);
  Object.assign(st, { updatedFrom: VERSION, updatedTo: man.version, notes: man.notes || "", updatedAt: Date.now(), seen: false });
  writeJSON(F_UPD, st);
  return { updated: true, man };
}
async function updateNotice() {
  const F_UPD = fm.joinPath(DIR, "update.json");
  const st = await readJSON(F_UPD, {});
  if (st.updatedTo && st.updatedTo === VERSION && !st.seen) {
    st.seen = true; writeJSON(F_UPD, st);
    return `✨ อัปเดตเป็น v${VERSION} แล้ว\n${st.notes || ""}`.trim();
  }
  return "";
}
const INSTALLER = `// Pixel Cat Portfolio — ตัวติดตั้ง (รันครั้งเดียว แล้วลบทิ้งได้)
const SRC = "${UPDATE_BASE}PortfolioWidget.js";
const NAME = "Pixel Cat Portfolio";
const r = new Request(SRC + "?t=" + Date.now());
const code = await r.loadString();
if (!code.includes("PIXEL CAT PORTFOLIO")) throw new Error("ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
let fm; try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
fm.writeString(fm.joinPath(fm.documentsDirectory(), NAME + ".js"), code);
const a = new Alert(); a.title = "ติดตั้งสำเร็จ 🐱";
a.message = 'เพิ่มสคริปต์ "' + NAME + '" แล้ว (อัปเดตอัตโนมัติ)\\nลบสคริปต์ติดตั้งนี้ทิ้งได้เลย';
a.addAction("เปิดเลย"); a.addCancelAction("ปิด");
if ((await a.presentAlert()) === 0) Safari.open("scriptable:///run?scriptName=" + encodeURIComponent(NAME));`;
async function updateFlow(data) {
  const st = data.settings;
  const i = await ask(`🔄 เวอร์ชัน v${VERSION}`, `อัปเดตอัตโนมัติ: ${st.autoUpdate !== false ? "เปิด" : "ปิด"} (เช็กทุก ${UPDATE_EVERY_H} ชม.)\n${REPO_URL}`,
    ["เช็กอัปเดตตอนนี้", st.autoUpdate !== false ? "ปิดอัปเดตอัตโนมัติ" : "เปิดอัปเดตอัตโนมัติ", "เปิดหน้า GitHub"]);
  if (i === 0) {
    try {
      const r = await checkUpdate({ force: true });
      if (r.updated) {
        const a = new Alert(); a.title = `อัปเดตเป็น v${r.man.version} แล้ว ✨`; a.message = (r.man.notes || "") + "\n\nปิดแล้วเปิดสคริปต์ใหม่เพื่อใช้เวอร์ชันล่าสุด (widget จะเปลี่ยนเองรอบถัดไป)";
        a.addAction("ตกลง"); await a.presentAlert(); return "exit";
      }
      await info("เป็นเวอร์ชันล่าสุดแล้ว 🐱", `v${VERSION}`);
    } catch (e) { await info("เช็กอัปเดตไม่สำเร็จ", String(e.message || e)); }
  } else if (i === 1) { st.autoUpdate = st.autoUpdate === false; writeJSON(F_DATA, data); }
  else if (i === 2) Safari.open(REPO_URL);
}
async function shareFlow() {
  const i = await ask("📤 แชร์ให้เพื่อน", "เพื่อนต้องมีแอป Scriptable (ฟรี) แล้วสร้างสคริปต์ใหม่ → วางโค้ดติดตั้ง → กด ▶︎ ครั้งเดียว\nข้อมูลพอร์ตของคุณไม่ถูกแชร์ไปด้วย",
    ["แชร์ข้อความ + โค้ดติดตั้ง (iPhone + Android)", "คัดลอกเฉพาะโค้ดติดตั้ง (iPhone)", "แชร์ลิงก์เว็บแอป (Android / คอม)"]);
  if (i === 0) await ShareSheet.present([`🐱 Pixel Cat Portfolio — widget พอร์ตลงทุนกับแมวพิกเซล\n1) โหลดแอป Scriptable (ฟรี)\n2) เปิดแอป กด + สร้างสคริปต์ใหม่ แล้ววางโค้ดด้านล่าง\n3) กด ▶︎ ครั้งเดียว จะได้สคริปต์ "Pixel Cat Portfolio" ที่อัปเดตเองอัตโนมัติ\n📱 ใช้ Android / คอม: เปิด ${WEB_URL} แล้วกด ⋮ → เพิ่มลงหน้าจอหลัก\nรายละเอียด: ${REPO_URL}\n\n${INSTALLER}`]);
  else if (i === 1) { Pasteboard.copy(INSTALLER); await info("คัดลอกโค้ดติดตั้งแล้ว"); }
  else if (i === 2) await ShareSheet.present([`🐱 Pixel Cat Portfolio (เว็บแอป Android / คอม)\n${WEB_URL}\nเปิดใน Chrome แล้วกด ⋮ → เพิ่มลงหน้าจอหลัก\nย้ายข้อมูลจาก iPhone: เมนู 💾 สำรอง → คัดลอก แล้ววางในเว็บแอป ⚙️ → นำเข้าข้อมูลสำรอง`]);
}

// ---------- ไฟล์ (ใช้ตำแหน่งเดิมจากเวอร์ชันแรก ข้อมูลจึงไม่หาย) ----------
let fm;
try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
const DIR = fm.joinPath(fm.documentsDirectory(), "PortfolioWidget");
if (!fm.fileExists(DIR)) fm.createDirectory(DIR, true);
const F_DATA = fm.joinPath(DIR, "portfolio.json");
const F_HIST = fm.joinPath(DIR, "history.json");
const F_CACHE = fm.joinPath(DIR, "price-cache.json");

async function readJSON(path, fallback) {
  try {
    if (!fm.fileExists(path)) return fallback;
    if (fm.isFileStoredIniCloud && fm.isFileStoredIniCloud(path) && !fm.isFileDownloaded(path)) {
      await fm.downloadFileFromiCloud(path);
    }
    return JSON.parse(fm.readString(path));
  } catch (e) { return fallback; }
}
function writeJSON(path, obj) { fm.writeString(path, JSON.stringify(obj, null, 1)); }
const F_NOTIFY = fm.joinPath(DIR, "notify.json");
// ส่งแจ้งเตือนสรุปพอร์ต (เรียกทุกครั้งที่ widget/แอปรีเฟรช จะส่งแค่รอบละครั้ง)
// ยิงแจ้งเตือนราคา (บันทึกสถานะลงไฟล์ เพื่อไม่ให้แจ้งซ้ำ)
async function maybeAlerts(data, S) {
  try {
    const list = checkAlerts(data, S);
    if (!list.length) return 0;
    writeJSON(F_DATA, data);
    for (const x of list) {
      const n = new Notification(); n.title = x.title; n.body = x.body; n.identifier = x.id;
      n.threadIdentifier = "pcp-alert"; n.openURL = URLScheme.forRunningScript(); n.sound = "default";
      await n.schedule();
    }
    return list.length;
  } catch (e) { return 0; }
}
async function maybeBrief(S, settings, force = false) {
  try {
    if (!S || !S.rows || !S.rows.length || (settings.notify === false && !force)) return false;
    const sent = await readJSON(F_NOTIFY, {});
    const slot = force ? null : briefSlot(Date.now(), sent);
    if (!slot && !force) return false;
    const b = briefText(S, settings, slot || "now");
    const n = new Notification();
    n.title = b.title; n.body = b.body;
    n.threadIdentifier = "pcp-brief"; n.identifier = "pcp-brief-" + (slot || "test");
    n.openURL = URLScheme.forRunningScript();
    await n.schedule();
    if (slot) { sent[slot] = bkkParts(Date.now()).ymd; writeJSON(F_NOTIFY, sent); }
    return true;
  } catch (e) { return false; }
}

// ---------- ตัวช่วยตัวเลข / วันที่ ----------
// @shared-begin
const num = (s) => { const n = parseFloat(String(s ?? "").replace(/,/g, "").trim()); return isFinite(n) ? n : NaN; };
function fmt(n, d = 0) {
  if (!isFinite(n)) return "-";
  const s = Math.abs(n).toFixed(d);
  const [i, f] = s.split(".");
  return (n < 0 && Number(s) !== 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
}
const signed = (n, d = 0) => (n > 0 ? "+" : "") + fmt(n, d);
const pctStr = (n) => (!isFinite(n) ? "-" : (n > 0 ? "+" : "") + n.toFixed(2) + "%");
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e5) return (n / 1e3).toFixed(0) + "K";
  return fmt(n);
}
function fmtPrice(p) {
  if (!isFinite(p)) return "-";
  const a = Math.abs(p);
  return fmt(p, a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 8);
}
const pad = (x) => String(x).padStart(2, "0");
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (d = new Date()) => `${d.getDate()} ${TH_MONTH[d.getMonth()]}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const key = (type, sym) => `${type}:${sym}`;

// @shared-end
// ---------- SHA-256 / HMAC (สำหรับ Bitkub API แบบมี key) ----------
function utf8(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function sha256(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const m = bytes.slice();
  const bitLen = bytes.length * 8;
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  const W = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < m.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = (m[i + 4 * t] << 24) | (m[i + 4 * t + 1] << 16) | (m[i + 4 * t + 2] << 8) | m[i + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = [];
  for (const x of H) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  return out;
}
function hmacSha256Hex(secret, msg) {
  let k = utf8(secret);
  if (k.length > 64) k = sha256(k);
  while (k.length < 64) k.push(0);
  const ipad = k.map((b) => b ^ 0x36), opad = k.map((b) => b ^ 0x5c);
  const inner = sha256(ipad.concat(utf8(msg)));
  return sha256(opad.concat(inner)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- ดึงราคา ----------
async function getJSON(url, headers) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  r.headers = Object.assign({ "User-Agent": "Mozilla/5.0 (iPhone)", Accept: "application/json" }, headers || {});
  return await r.loadJSON();
}
async function yahoo(sym) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`);
  const m = j.chart.result[0].meta;
  const price = m.regularMarketPrice;
  const prev = m.chartPreviousClose ?? m.previousClose ?? price;
  if (!isFinite(price)) throw new Error("no price " + sym);
  return { price, prev };
}
async function bitkubTicker() {
  const arr = await getJSON("https://api.bitkub.com/api/v3/market/ticker");
  const map = {};
  for (const t of arr) {
    const [base, quote] = String(t.symbol).split("_");
    if (quote !== "THB") continue;
    const last = num(t.last), pct = num(t.percent_change);
    map[base] = { price: last, prev: isFinite(pct) ? last / (1 + pct / 100) : last };
  }
  return map;
}
async function hshGold() {
  const arr = await getJSON("https://apicheckprice.huasengheng.com/api/values/getprice/");
  const h = arr.find((x) => x.GoldType === "HSH") || arr[0];
  const buy = num(h.Buy), sell = num(h.Sell), chg = num(h.BuyChange) || 0;
  return { price: buy, prev: buy - chg, sell, time: h.TimeUpdate };
}
async function bitkubBalances() {
  if (!Keychain.contains("pw_bk_key") || !Keychain.contains("pw_bk_secret")) return null;
  const apiKey = Keychain.get("pw_bk_key"), secret = Keychain.get("pw_bk_secret");
  let ts = String(Date.now());
  try {
    const r = new Request("https://api.bitkub.com/api/v3/servertime");
    const s = (await r.loadString()).trim();
    if (/^\d+$/.test(s)) ts = s;
  } catch (e) {}
  const path = "/api/v3/market/balances", body = "{}";
  const r = new Request("https://api.bitkub.com" + path);
  r.method = "POST";
  r.body = body;
  r.timeoutInterval = 15;
  r.headers = {
    Accept: "application/json", "Content-Type": "application/json",
    "X-BTK-APIKEY": apiKey, "X-BTK-TIMESTAMP": ts,
    "X-BTK-SIGN": hmacSha256Hex(secret, ts + "POST" + path + body),
  };
  const j = await r.loadJSON();
  if (j.error !== 0) throw new Error("Bitkub error " + j.error);
  const out = {};
  for (const [sym, v] of Object.entries(j.result || {})) {
    const q = (num(v.available) || 0) + (num(v.reserved) || 0);
    if (sym !== "THB" && q > 0) out[sym] = q;
  }
  return out;
}

async function fetchPrices(data) {
  const cache = await readJSON(F_CACHE, { prices: {}, fx: null, ts: 0 });
  const prices = {};
  const errors = [];
  const hs = data.holdings;
  const need = (t) => hs.some((h) => h.type === t);

  const jobs = [];
  let fx = null;
  if (need("us")) jobs.push(yahoo("THB=X").then((r) => (fx = r)).catch(() => errors.push("USD/THB")));
  const yahooSyms = [...new Set(hs.filter((h) => h.type === "us" || h.type === "thai").map((h) => key(h.type, h.symbol)))];
  for (const k of yahooSyms) {
    const [type, sym] = k.split(":");
    const ysym = type === "thai" ? (sym.endsWith(".BK") ? sym : sym + ".BK") : sym;
    jobs.push(yahoo(ysym).then((r) => (prices[k] = r)).catch(() => errors.push(sym)));
  }
  let bk = null, bal = null;
  if (need("crypto") || Keychain.contains("pw_bk_key")) {
    jobs.push(bitkubTicker().then((m) => (bk = m)).catch(() => errors.push("Bitkub")));
    jobs.push(bitkubBalances().then((b) => (bal = b)).catch(() => errors.push("Bitkub key")));
  }
  if (need("gold")) jobs.push(hshGold().then((g) => (prices["gold:HSH"] = g)).catch(() => errors.push("ทอง")));
  await Promise.all(jobs);

  if (bk) for (const [sym, p] of Object.entries(bk)) prices["crypto:" + sym] = p;
  // สำรอง: หุ้นที่ Yahoo ดึงไม่ได้ → CNBC (ขอทีละหลายตัว)
  const miss = yahooSyms.filter((k) => !prices[k]).map((k) => k.split(":"));
  if (miss.length || (need("us") && !fx)) {
    try {
      const list = miss.map(([t, s]) => cnbcSym(t, s)); if (!fx) list.push("THB=");
      const r = new Request(cnbcURL(list)); r.timeoutInterval = 15;
      const got = parseCNBC(await r.loadJSON());
      for (const [t, s] of miss) { const q = got[cnbcSym(t, s)]; if (q) { prices[key(t, s)] = q; const i = errors.indexOf(s); if (i >= 0) errors.splice(i, 1); } }
      if (!fx && got["THB="]) { fx = got["THB="]; const i = errors.indexOf("USD/THB"); if (i >= 0) errors.splice(i, 1); }
    } catch (e) {}
  }
  let stale = false;
  for (const h of hs) {
    const k = key(h.type, h.symbol);
    if (h.type === "fund") continue;
    if (!prices[k] && cache.prices[k]) { prices[k] = cache.prices[k]; stale = true; }
  }
  if (!fx && cache.fx) { fx = cache.fx; stale = true; }
  // เก็บเฉพาะราคาที่พอร์ตใช้ ไม่ให้ไฟล์ cache ใหญ่เกินไป
  const keep = {};
  for (const h of hs) { const k = key(h.type, h.symbol); if (prices[k]) keep[k] = prices[k]; }
  if (bal) for (const s of Object.keys(bal)) if (prices["crypto:" + s]) keep["crypto:" + s] = prices["crypto:" + s];
  writeJSON(F_CACHE, { prices: Object.assign({}, cache.prices, keep), fx, ts: Date.now() });
  return { prices, fx, balances: bal, errors, stale };
}

// ---------- คำนวณพอร์ต ----------
// @shared-begin
function compute(data, P) {
  const usdthb = P.fx ? P.fx.price : NaN;
  const usdPrev = P.fx ? P.fx.prev : NaN;
  const groups = {};
  for (const h of data.holdings) {
    const k = key(h.type, h.symbol);
    const g = (groups[k] ||= { key: k, type: h.type, symbol: h.symbol, cat: TYPES[h.type].cat, qty: 0, cost: 0, lots: [] });
    const lotFx = h.type === "us" ? (num(h.fx) || usdthb) : 1;
    g.qty += h.qty;
    g.cost += h.qty * h.avg * lotFx;
    g.lots.push(h);
  }
  if (P.balances) {
    for (const [sym, q] of Object.entries(P.balances)) {
      const k = "crypto:" + sym;
      if (groups[k]) { groups[k].qtyManual = groups[k].qty; groups[k].qty = q; groups[k].fromBitkub = true; }
      else if (P.prices[k] && q * P.prices[k].price >= 50) {
        groups[k] = { key: k, type: "crypto", symbol: sym, cat: "crypto", qty: q, cost: NaN, lots: [], fromBitkub: true };
      }
    }
  }
  const rows = [];
  for (const g of Object.values(groups)) {
    let price = NaN, prev = NaN, native = NaN;
    if (g.type === "fund") {
      const n = data.navs[g.symbol];
      price = prev = n ? n.nav : NaN;
      if (n && isFinite(n.prev)) prev = n.prev;
    } else {
      const p = P.prices[g.key];
      if (p) {
        native = p.price;
        if (g.type === "us") { price = p.price * usdthb; prev = p.prev * usdPrev; }
        else { price = p.price; prev = p.prev; }
      }
    }
    const avgQty = g.qtyManual ?? g.qty;
    if (g.fromBitkub && isFinite(g.cost) && avgQty > 0) g.cost = (g.cost / avgQty) * g.qty;
    let value = g.qty * price;
    if (!isFinite(value)) value = isFinite(g.cost) ? g.cost : 0;
    const noCost = !isFinite(g.cost);
    const cost = noCost ? value : g.cost;
    const prevValue = isFinite(prev) ? g.qty * prev : value;
    const day = value - prevValue;
    rows.push({
      ...g, price, native, value, cost, noCost, prevValue,
      avg: g.qty > 0 ? cost / g.qty : NaN,
      pl: value - cost, plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      day, dayPct: prevValue > 0 ? (day / prevValue) * 100 : 0,
      missingPrice: !isFinite(price),
      firstDate: g.lots.map((l) => l.date).sort()[0] || "",
    });
  }
  rows.sort((a, b) => b.value - a.value);
  const cats = {};
  for (const c of CAT_ORDER) cats[c] = { value: 0, cost: 0, day: 0 };
  for (const r of rows) { cats[r.cat].value += r.value; cats[r.cat].cost += r.cost; cats[r.cat].day += r.day; }
  const total = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const day = rows.reduce((s, r) => s + r.day, 0);
  for (const c of CAT_ORDER) {
    const x = cats[c];
    x.pl = x.value - x.cost; x.plPct = x.cost > 0 ? (x.pl / x.cost) * 100 : 0;
    x.share = total > 0 ? (x.value / total) * 100 : 0;
  }
  const movers = rows.filter((r) => !r.missingPrice && Math.abs(r.dayPct) > 0.005).sort((a, b) => b.dayPct - a.dayPct);
  return {
    rows, cats, total, cost, day, pl: total - cost,
    plPct: cost > 0 ? ((total - cost) / cost) * 100 : 0,
    dayPct: total - day > 0 ? (day / (total - day)) * 100 : 0,
    best: movers[0] && movers[0].dayPct > 0 ? movers[0] : null,
    worst: movers.length && movers[movers.length - 1].dayPct < 0 ? movers[movers.length - 1] : null,
    usdthb, stale: P.stale, errors: P.errors, at: new Date(),
  };
}

// @shared-end
// @shared-begin
// ราคาหุ้นจาก CNBC: หุ้นไทยใช้ "PTT-TH", หุ้นสหรัฐฯ ใช้ชื่อปกติ (BRK-B → BRK.B), เรท USD/THB ใช้ "THB=" · ขอได้ทีละหลายตัว
function cnbcSym(type, sym) { return type === "thai" ? sym + "-TH" : type === "fx" ? "THB=" : String(sym).replace(/-/g, "."); }
function cnbcURL(list) {
  return "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" + encodeURIComponent(list.join("|")) +
    "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json";
}
function parseCNBC(j) {
  const out = {};
  const arr = (j && j.FormattedQuoteResult && j.FormattedQuoteResult.FormattedQuote) || [];
  for (const q of [].concat(arr)) {
    if (!q || String(q.code) !== "0") continue;
    const last = num(q.last); if (!(last > 0)) continue;
    const ch = num(q.change), pdc = num(q.previous_day_closing);
    out[q.symbol] = { price: last, prev: isFinite(ch) ? last - ch : pdc > 0 ? pdc : last, at: Date.now(), src: "cnbc" };
  }
  return out;
}
// @shared-end
async function saveHistory(S) {
  if (!(S.total > 0)) return [];
  const hist = await readJSON(F_HIST, []);
  const d = ymd();
  const snap = { d, v: Math.round(S.total), c: Math.round(S.cost), cats: {} };
  for (const c of CAT_ORDER) snap.cats[c] = Math.round(S.cats[c].value);
  const i = hist.findIndex((x) => x.d === d);
  if (i >= 0) hist[i] = snap; else hist.push(snap);
  hist.sort((a, b) => (a.d < b.d ? -1 : 1));
  const trimmed = hist.slice(-730);
  writeJSON(F_HIST, trimmed);
  return trimmed;
}

// ---------- เวลาตลาด (อิงเวลาจริง ไม่ขึ้นกับ timezone ของเครื่อง) ----------
// SET (เวลาไทย): Pre-open 09:30 · เช้า 10:00–12:30 · พัก 12:30–13:30 · Pre-open 13:30 · บ่าย 14:00–16:30 · Pre-close 16:30–16:40
// NYSE/Nasdaq (เวลานิวยอร์ก): Pre-market 04:00 · ตลาด 09:30–16:00 · After-hours 16:00–20:00 (แปลงเป็นเวลาไทยอัตโนมัติ รวม Daylight Saving)
// @shared-begin
const SET_HOLIDAYS = new Set(["2026-01-01","2026-01-02","2026-03-03","2026-04-06","2026-04-13","2026-04-14","2026-04-15","2026-05-01","2026-05-04","2026-06-01","2026-06-03","2026-07-28","2026-07-29","2026-08-12","2026-10-13","2026-10-16","2026-10-23","2026-12-07","2026-12-10","2026-12-31",
  // 2570/2027 ตามประกาศ ก.ล.ต. วันหยุดทำการธุรกิจหลักทรัพย์
  "2027-01-01","2027-02-22","2027-04-06","2027-04-13","2027-04-14","2027-04-15","2027-05-03","2027-05-04","2027-05-20","2027-06-03","2027-07-19","2027-07-28","2027-08-12","2027-10-13","2027-10-25","2027-12-06","2027-12-10","2027-12-31"]);
const US_HOLIDAYS = new Set(["2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-11-25","2027-12-24"]);
const US_EARLY_CLOSE = { "2026-11-27": 780, "2026-12-24": 780, "2027-11-26": 780 }; // ปิด 13:00 น. เวลานิวยอร์ก
const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
function partsAt(ms, offH) {
  const u = new Date(ms + offH * 3600e3);
  const y = u.getUTCFullYear(), mo = u.getUTCMonth() + 1, d = u.getUTCDate();
  return { y, mo, d, dow: u.getUTCDay(), min: u.getUTCHours() * 60 + u.getUTCMinutes(), ymd: `${y}-${pad(mo)}-${pad(d)}`, off: offH };
}
function nthSunday(y, m0, n) { const first = new Date(Date.UTC(y, m0, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); }
function etOffset(ms) {
  const y = new Date(ms).getUTCFullYear();
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7), end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6);
  return ms >= start && ms < end ? -4 : -5;
}
const bkkParts = (ms) => partsAt(ms, 7);
const etParts = (ms) => partsAt(ms, etOffset(ms));
function relBKK(absMs, nowMs) {
  const b = bkkParts(absMs), n = bkkParts(nowMs);
  const diff = Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(n.y, n.mo - 1, n.d)) / 864e5);
  const t = `${pad(Math.floor(b.min / 60))}:${pad(b.min % 60)}`;
  return (diff === 0 ? "" : diff === 1 ? "พรุ่งนี้ " : `${TH_DOW[b.dow]} ${b.d} `) + t;
}
function nextDay(p, k) { const u = new Date(Date.UTC(p.y, p.mo - 1, p.d + k)); return { y: u.getUTCFullYear(), mo: u.getUTCMonth() + 1, d: u.getUTCDate(), dow: u.getUTCDay(), ymd: `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}` }; }
function marketTH(nowMs = Date.now()) {
  const p = bkkParts(nowMs), m = p.min;
  const trading = (q) => q.dow >= 1 && q.dow <= 5 && !SET_HOLIDAYS.has(q.ymd);
  const at = (q, min) => Date.UTC(q.y, q.mo - 1, q.d, 0, min) - 7 * 3600e3;
  const nextOpen = () => { for (let k = 1; k < 15; k++) { const q = nextDay(p, k); if (trading(q)) return relBKK(at(q, 600), nowMs); } return "-"; };
  const holiday = p.dow >= 1 && p.dow <= 5 && SET_HOLIDAYS.has(p.ymd);
  if (!trading(p)) return { state: "closed", open: false, holiday, weekend: !holiday, label: `${holiday ? "วันหยุดตลาด" : "ปิดเสาร์-อาทิตย์"} · เปิด ${nextOpen()}` };
  if (m < 570) return { state: "closed", open: false, label: "ยังไม่เปิด · เปิด 10:00" };
  if (m < 600) return { state: "pre", open: false, label: "Pre-open · เปิด 10:00" };
  if (m < 750) return { state: "open", open: true, label: "เปิด · พักเที่ยง 12:30" };
  if (m < 810) return { state: "break", open: false, label: "พักเที่ยง · เปิด 14:00" };
  if (m < 840) return { state: "pre", open: false, label: "Pre-open · เปิด 14:00" };
  if (m < 990) return { state: "open", open: true, label: "เปิด · ปิด 16:30" };
  if (m < 1000) return { state: "preclose", open: true, label: "Pre-close · ปิด 16:40" };
  return { state: "closed", open: false, after: true, label: `ปิดแล้ว · เปิด ${nextOpen()}` };
}
function marketUS(nowMs = Date.now()) {
  const p = etParts(nowMs), m = p.min;
  const trading = (q) => q.dow >= 1 && q.dow <= 5 && !US_HOLIDAYS.has(q.ymd);
  const at = (q, min) => { const guess = Date.UTC(q.y, q.mo - 1, q.d, 0, min); return guess - etOffset(guess + 5 * 3600e3) * 3600e3; };
  const nextOpen = () => { for (let k = 1; k < 15; k++) { const q = nextDay(p, k); if (trading(q)) return relBKK(at(q, 570), nowMs); } return "-"; };
  const close = US_EARLY_CLOSE[p.ymd] || 960;
  const holiday = p.dow >= 1 && p.dow <= 5 && US_HOLIDAYS.has(p.ymd);
  if (!trading(p)) return { state: "closed", open: false, holiday, label: `${holiday ? "วันหยุดตลาด" : "ปิด"} · เปิด ${nextOpen()}` };
  if (m < 240) return { state: "closed", open: false, label: `ปิด · เปิด ${relBKK(at(p, 570), nowMs)}` };
  if (m < 570) return { state: "pre", open: false, minsToOpen: 570 - m, label: `Pre-market · เปิด ${relBKK(at(p, 570), nowMs)}` };
  if (m < close) return { state: "open", open: true, label: `เปิด · ปิด ${relBKK(at(p, close), nowMs)}${close < 960 ? " (ปิดเร็ว)" : ""}` };
  if (m < 1200) return { state: "after", open: false, label: `After-hours · เปิด ${nextOpen()}` };
  return { state: "closed", open: false, label: `ปิด · เปิด ${nextOpen()}` };
}
function markets(nowMs = Date.now()) { return { th: marketTH(nowMs), us: marketUS(nowMs), bkk: bkkParts(nowMs) }; }

// ---------- กิจกรรมของแมว (เวลาตลาด + อารมณ์พอร์ต) ----------
function holdsMarkets(S, settings) {
  const fi = (settings && settings.fundInfo) || {};
  const region = (r) => (fi[r.symbol] && fi[r.symbol].region) || (guessRegion(r.symbol) ? "foreign" : "thai");
  const rows = S ? S.rows : [];
  return {
    th: rows.some((r) => r.type === "thai" || (r.type === "fund" && region(r) !== "foreign")),
    us: rows.some((r) => r.type === "us" || (r.type === "fund" && region(r) !== "thai")),
  };
}
const PLAY = {
  wow: ["zoomies", "butterfly", "zoomies", "yarn", "butterfly"],
  happy: ["butterfly", "yarn", "watchFly", "walk", "groom", "butterfly"],
  normal: ["walk", "loaf", "groom", "watchFly", "yarn", "stretch", "walk"],
  sad: ["sulk", "loaf", "sulk", "walk", "groom"],
};
function catActivity(S, settings, nowMs = Date.now()) {
  const M = markets(nowMs), mood = catMood(S), H = holdsMarkets(S, settings);
  const seed = Math.floor(nowMs / (10 * 60e3));
  const h = M.bkk.min / 60;
  const pick = (arr) => arr[seed % arr.length];
  let a, sleepy = false;
  if (H.th && M.th.open) a = "watchTH";
  else if (H.th && M.th.state === "pre") a = "ready";
  else if (M.th.state === "break") a = "eat";
  else if (H.us && M.us.open) { a = "watchUS"; sleepy = h < 6; }
  else if (H.us && M.us.state === "pre" && M.us.minsToOpen <= 30) a = "ready";
  else if (h >= 23.5 || h < 6) a = "sleep";
  else if (h < 9.5) a = pick(["stretch", "eat", "groom", "stretch"]);
  else { let r = seed; a = utilityPick(needsAt(nowMs), mood, { hour: h, rand: () => ((r = (r * 9301 + 49297) % 233280) / 233280) }); } // Utility AI
  return { a, sleepy, mood, M, H, seed };
}
const ACT_LINES = {
  watchTH: ["เฝ้ากราฟหุ้นไทยอยู่", "ดูกราฟ SET ตาไม่กะพริบ", "จดโน้ตหุ้นไทยให้นะ"],
  watchUS: ["เฝ้าตลาดอเมริกา ☕", "ดูหุ้นนอกกับกาแฟ", "อดนอนเฝ้าวอลล์สตรีท"],
  ready: ["ยืดเส้นรอตลาดเปิด", "เตรียมพร้อม! ตลาดใกล้เปิด"],
  eat: ["พักเที่ยง กินปลาก่อน 🐟", "อิ่มแล้วค่อยดูกราฟต่อ"],
  sleep: ["Zzz... ตลาดหลับแล้ว", "ฝันถึงหุ้นเขียว Zzz"],
  butterfly: ["ไล่จับผีเสื้อ~", "ผีเสื้อ! อย่าหนีนะ"],
  yarn: ["เล่นไหมพรมฆ่าเวลา", "กลิ้งไหมพรมรอตลาด"],
  zoomies: ["พอร์ตพุ่ง! วิ่งรอบห้องเลย", "ดีใจจนหยุดวิ่งไม่ได้!!"],
  walk: ["เดินเล่นรอบห้อง", "ตรวจตราห้องหน่อย"],
  stretch: ["ยืดเส้นยืดสาย~", "อรุณสวัสดิ์ทาส"],
  groom: ["เลียขนให้หล่อ", "แต่งตัวก่อนดูพอร์ต"],
  watchFly: ["มองผีเสื้อเพลินๆ", "มีอะไรบินอยู่นะ"],
  sulk: ["งอนพอร์ตแป๊บ...", "แดงแบบนี้ขอนอนซึม"],
  loaf: ["หมอบชิลๆ เป็นขนมปัง", "นอนรอให้พอร์ตเขียว"],
};
function actLine(S, act) {
  if (!S) return "เพิ่มพอร์ตให้แมวดูแลหน่อย~";
  if (S.errors.length && S.stale) return "เน็ตหลุดเหรอ ใช้ราคาเก่าไปก่อนนะ";
  const arr = ACT_LINES[act.a] || ["เมี้ยว~"];
  return `${arr[act.seed % arr.length]} · วันนี้ ${pctStr(S.dayPct)}`;
}
const faceMood = (act) => (act.a === "sleep" ? "sleep" : act.mood);

// ---------- อารมณ์แมว ----------
function catMood(S, now = new Date()) {
  if (!S) return "normal";
  if (S.errors.length && S.stale) return "sad";
  if (S.dayPct >= 2) return "wow";
  if (S.dayPct >= 0.2) return "happy";
  if (S.dayPct <= -1) return "sad";
  return "normal";
}
const LINES = {
  wow:    ["ว้าว! พุ่ง {d} ซื้อปลาทูให้หน่อย", "พอร์ตบินแล้วเมี้ยว!! {d}", "ปังมาก {d} ทาสเก่งที่สุด"],
  happy:  ["เมี้ยว~ วันนี้เขียว {d}", "ทาสเก่งมาก พอร์ตบวก {d}", "ขอขนมแมวเพิ่มได้ไหม~ {d}"],
  normal: ["นิ่งๆ ชิลๆ วันนี้ {d}", "ตรวจพอร์ตให้แล้วนะทาส", "ถือยาวๆ ใจเย็นเมี้ยว"],
  sad:    ["ฮือ แดง {d} กอดหน่อย", "ไม่เป็นไรนะ ถือยาวๆ", "แดงวันนี้ แต่ยังมีแมวนะ"],
  sleep:  ["Zzz... ตลาดหลับแล้ว", "ฝันถึงหุ้นเขียว Zzz", "แมวนอนก่อนนะ Zzz"],
};
function catLine(S, mood, now = new Date()) {
  if (!S) return "เพิ่มพอร์ตให้แมวดูแลหน่อย~";
  if (mood === "sad" && S.errors.length && S.stale) return "เน็ตหลุดเหรอ ใช้ราคาเก่าไปก่อนนะ";
  const arr = LINES[mood];
  const i = (now.getHours() * 4 + Math.floor(now.getMinutes() / 15)) % arr.length;
  return arr[i].replace("{d}", pctStr(S.dayPct));
}
function catAgeDays(hist) {
  if (!hist || !hist.length) return 1;
  const first = new Date(hist[0].d + "T00:00:00");
  return Math.max(1, Math.floor((Date.now() - first.getTime()) / 864e5) + 1);
}

// ---------- แจ้งเตือนสรุปพอร์ต (คำนวณในเครื่องล้วนๆ ไม่ใช้ AI / ไม่เปลือง token) ----------
// รอบเย็น: หลัง SET ปิด 16:45 (เฉพาะวันที่ตลาดไทยเปิด) · รอบเช้า: 07:00–12:00 หลังตลาด US ปิดเมื่อคืน
function briefSlot(nowMs = Date.now(), sent = {}) {
  const p = bkkParts(nowMs);
  const setDay = p.dow >= 1 && p.dow <= 5 && !SET_HOLIDAYS.has(p.ymd);
  if (setDay && p.min >= 16 * 60 + 45 && sent.evening !== p.ymd) return "evening";
  const us = etParts(nowMs - 12 * 3600e3); // วันทำการ US ของ "เมื่อคืน"
  const usDay = us.dow >= 1 && us.dow <= 5 && !US_HOLIDAYS.has(us.ymd);
  if (usDay && p.min >= 7 * 60 && p.min < 12 * 60 && sent.morning !== p.ymd) return "morning";
  return null;
}
// เวลาถัดไปที่ควรรีเฟรช widget เพื่อส่งสรุปให้ตรงเวลา (07:01 / 16:46 น. ไทย)
function nextBriefMs(nowMs = Date.now()) {
  const p = bkkParts(nowMs), day0 = nowMs - p.min * 60e3 - (nowMs % 60e3);
  const c = [day0 + 421 * 60e3, day0 + 1006 * 60e3, day0 + (1440 + 421) * 60e3];
  return c.find((t) => t > nowMs + 60e3) || c[2];
}
function briefText(S, settings, slot) {
  const nm = (settings && settings.catName) || "แมว";
  const when = slot === "morning" ? "เช้านี้" : slot === "evening" ? "เย็นนี้" : "ล่าสุด";
  const face = S.dayPct >= 1 ? "😸" : S.dayPct > 0 ? "😺" : S.dayPct <= -1 ? "🙀" : "🐱";
  const title = `${face} ${nm} สรุปพอร์ต${when} · ฿${compact(S.total)}`;
  const lines = [`${slot === "morning" ? "รอบล่าสุด" : "วันนี้"} ${signed(S.day)} ฿ (${pctStr(S.dayPct)}) · กำไรรวม ${signed(S.pl)} ฿ (${pctStr(S.plPct)})`];
  if (settings && settings._dcaTodo) lines.push(`📜 เควส DCA เดือนนี้ยังไม่ทำ (เหลือ ${settings._dcaTodo} วัน)`);
  const cs = CAT_ORDER.filter((c) => S.cats[c].value > 0).map((c) => {
    const x = S.cats[c], prev = x.value - x.day;
    return `${CATS[c].short} ${pctStr(prev > 0 ? (x.day / prev) * 100 : 0)}`;
  });
  if (cs.length) lines.push(cs.join(" · "));
  const mv = [];
  if (S.best) mv.push(`🚀 ${S.best.symbol} ${pctStr(S.best.dayPct)}`);
  if (S.worst) mv.push(`🔻 ${S.worst.symbol} ${pctStr(S.worst.dayPct)}`);
  if (mv.length) lines.push(mv.join(" · "));
  if (S.stale) lines.push("⚠️ บางราคายังเป็นราคาเก่า");
  return { title, body: lines.join("\n") };
}

// ---------- แจ้งเตือนราคา (ตั้งเป้าราคารายตัว + พอร์ตขยับแรง) — คำนวณในเครื่อง ไม่ใช้ AI ----------
// data.alerts = [{ id, type, symbol, op: ">=" | "<=", price, on, firedAt }]  (ยิงครั้งเดียวแล้วปิดเอง)
// data.settings.moveAlert = % (0 = ปิด) แจ้งเมื่อพอร์ตทั้งก้อนขยับเกินนี้ในวันเดียว (วันละครั้งต่อทิศ)
const alertUnit = (type) => (type === "us" ? "$" : "฿");
// ราคาที่ใช้เทียบ: หุ้นนอก = USD, อย่างอื่น = บาท (กองทุน = NAV)
function alertPrice(row) { return row.type === "us" ? row.native : row.price; }
function alertLabel(a) { return `${a.symbol} ${a.op === "<=" ? "≤" : "≥"} ${alertUnit(a.type)}${fmtPrice(a.price)}`; }
function checkAlerts(data, S, nowMs = Date.now()) {
  const out = [];
  if (!S || !S.rows || data.sample) return out;
  const today = bkkParts(nowMs).ymd;
  for (const a of data.alerts || []) {
    if (!a.on) continue;
    const r = S.rows.find((x) => x.type === a.type && x.symbol === a.symbol);
    const p = r ? alertPrice(r) : NaN;
    if (!isFinite(p) || !(a.price > 0)) continue;
    if (a.op === "<=" ? p <= a.price : p >= a.price) {
      a.on = false; a.firedAt = nowMs;
      const up = a.op !== "<=";
      out.push({ id: "pcp-alert-" + a.id, title: `${up ? "🎯" : "🔔"} ${a.symbol} ${up ? "ขึ้นถึง" : "ลงมาถึง"}เป้าแล้ว!`,
        body: `ราคาตอนนี้ ${alertUnit(a.type)}${fmtPrice(p)} (ตั้งไว้ ${alertLabel(a)}) · วันนี้ ${pctStr(r.dayPct)}\nถือ ${fmt(r.qty, r.type === "crypto" ? 6 : 2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")} · กำไร ${signed(r.pl)} ฿ (${pctStr(r.plPct)})` });
    }
  }
  const th = num(data.settings && data.settings.moveAlert);
  if (th > 0 && Math.abs(S.dayPct) >= th) {
    const dir = S.dayPct > 0 ? "up" : "down";
    data.alertState ||= {};
    if (data.alertState[dir] !== today) {
      data.alertState[dir] = today;
      out.push({ id: "pcp-move-" + dir, title: dir === "up" ? `🚀 พอร์ตพุ่ง ${pctStr(S.dayPct)} วันนี้!` : `📉 พอร์ตร่วง ${pctStr(S.dayPct)} วันนี้`,
        body: `${signed(S.day)} ฿ · มูลค่า ฿${fmt(S.total)}` + (dir === "up" ? (S.best ? ` · นำโดย ${S.best.symbol} ${pctStr(S.best.dayPct)}` : "") : (S.worst ? ` · ตัวฉุด ${S.worst.symbol} ${pctStr(S.worst.dayPct)}` : "")) });
    }
  }
  return out;
}

const gclamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ================= เกม: เลเวล / XP / เควส (v6.7) — คำนวณในเครื่อง ไม่ใช้ AI =================
// data.game = { xp, streak, best, last, green, dcaStreak, dcaDone:{ "2026-10": true }, done:{ questId: ymd }, decor:[...] }
const xpTotalFor = (lv) => 40 * lv * (lv - 1); // XP สะสมที่ต้องมีเพื่อถึงเลเวล lv (Lv2=80, Lv5=800, Lv10=3600)
function lvInfo(xp) {
  let lv = 1;
  while (xp >= xpTotalFor(lv + 1)) lv++;
  const a = xpTotalFor(lv), b = xpTotalFor(lv + 1);
  return { lv, xp, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}
const DECOR = {
  plant2: { name: "ต้นมอนสเตอร่า", how: "เช็กพอร์ต 7 วันติด" },
  trophy: { name: "ถ้วยรางวัล DCA", how: "DCA ครบ 3 เดือนติด" },
  goldcat: { name: "รูปปั้นแมวทอง", how: "ถึง Lv.10" },
  banner: { name: "ธงเป้าหมาย", how: "พอร์ตถึงเป้าหมาย" },
  crown: { name: "มงกุฎนักลงทุน", how: "DCA ครบ 12 เดือนติด" },
};
function gameOf(data) {
  const g = (data.game ||= {});
  g.xp ||= 0; g.streak ||= 0; g.best ||= 0; g.dcaStreak ||= 0;
  g.dcaDone ||= {}; g.done ||= {}; g.decor ||= [];
  return g;
}
const ymOf = (ymdStr) => String(ymdStr || "").slice(0, 7);
function prevYm(ym) { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; }
// ยอดที่ลงทุนเพิ่มในเดือนนี้ (จากรายการซื้อที่ลงวันที่เดือนนั้น)
function dcaProgress(data, ym, fx) {
  let amt = 0, lots = 0;
  for (const h of data.holdings || []) {
    if (ymOf(h.date) !== ym) continue;
    const f = h.type === "us" ? (num(h.fx) || fx || 33.5) : 1;
    const v = (num(h.qty) || 0) * (num(h.avg) || 0) * f;
    if (v > 0) { amt += v; lots++; }
  }
  const target = num(data.settings && data.settings.dcaAmount) || 0;
  return { amt, lots, target, done: target > 0 ? amt >= target : lots > 0 };
}
// รายการเควสปัจจุบัน (ใช้แสดงผล)
function questList(data, S, nowMs = Date.now()) {
  const g = gameOf(data), today = bkkParts(nowMs), ym = today.ymd.slice(0, 7);
  const dca = dcaProgress(data, ym, S && S.usdthb);
  const goal = num(data.settings && data.settings.goal) || 0;
  const daysLeft = new Date(Date.UTC(today.y, today.mo, 0)).getUTCDate() - today.d;
  const q = [
    { id: "dca-" + ym, icon: "💰", title: `DCA เดือนนี้${dca.target > 0 ? ` ฿${fmt(dca.target)}` : ""}`, big: true,
      desc: dca.target > 0 ? `ลงทุนเพิ่มแล้ว ฿${fmt(dca.amt)} · เหลือ ${daysLeft} วัน · ติดต่อกัน ${g.dcaStreak} เดือน` : `เพิ่มรายการซื้ออย่างน้อย 1 รายการเดือนนี้ (ตั้งยอด DCA ได้) · ติดต่อกัน ${g.dcaStreak} เดือน`,
      pct: dca.target > 0 ? Math.min(1, dca.amt / dca.target) : dca.lots ? 1 : 0, done: !!g.dcaDone[ym], xp: 150 },
    { id: "streak7", icon: "🔥", title: "เช็กพอร์ต 7 วันติด", desc: `ติดต่อกัน ${g.streak} วัน (สูงสุด ${g.best})`, pct: Math.min(1, (g.streak % 7 || (g.streak ? 7 : 0)) / 7), done: g.streak > 0 && g.streak % 7 === 0 && g.done.streak7 === today.ymd, xp: 60 },
    { id: "green", icon: "🟢", title: "วันนี้พอร์ตเขียว", desc: "แค่ถือไว้ ตลาดใจดีก็ได้ XP", pct: g.green === today.ymd ? 1 : 0, done: g.green === today.ymd, xp: 5 },
  ];
  if (goal > 0) q.push({ id: "goal", icon: "🎯", title: `พอร์ตถึงเป้า ฿${compact(goal)}`, desc: S ? `ตอนนี้ ฿${compact(S.total)} (${Math.min(100, (S.total / goal) * 100).toFixed(1)}%)` : "", pct: S ? Math.min(1, S.total / goal) : 0, done: !!g.done["goal-" + goal], xp: 300 });
  return q;
}
// เดินเกม 1 ครั้ง (เปิดแอป/รีเฟรช): ให้ XP + ปลดล็อกของ คืนรายการเหตุการณ์ไว้ทำเอฟเฟกต์/แจ้งเตือน
// countVisit=false สำหรับ widget (ไม่นับเป็นการเช็กพอร์ต)
function gameTick(data, S, nowMs = Date.now(), countVisit = true) {
  const ev = [];
  if (!data || data.sample || !(data.holdings || []).length) return ev;
  const g = gameOf(data), t = bkkParts(nowMs), today = t.ymd, ym = today.slice(0, 7);
  const lv0 = lvInfo(g.xp).lv;
  const give = (xp, kind, text) => { g.xp += xp; ev.push({ kind, xp, text }); };
  const unlock = (k) => { if (!g.decor.includes(k)) { g.decor.push(k); ev.push({ kind: "decor", key: k, text: `ปลดล็อก ${DECOR[k].name}!` }); } };
  if (countVisit && g.last !== today) {
    const y = bkkParts(nowMs - 864e5).ymd;
    g.streak = g.last === y ? g.streak + 1 : 1; g.best = Math.max(g.best, g.streak); g.last = today;
    give(10 + Math.min(g.streak, 7) * 2, "checkin", `เช็กพอร์ตวันที่ ${g.streak} ติด`);
    if (g.streak % 7 === 0) { g.done.streak7 = today; give(60, "quest", "เควสสำเร็จ: เช็กพอร์ต 7 วันติด"); unlock("plant2"); }
  }
  if (S && S.dayPct > 0 && g.green !== today && S.rows.some((r) => !r.missingPrice)) { g.green = today; give(5, "green", "พอร์ตเขียววันนี้"); }
  // DCA รายเดือน
  const dca = dcaProgress(data, ym, S && S.usdthb);
  if (dca.done && !g.dcaDone[ym]) {
    g.dcaDone[ym] = true;
    g.dcaStreak = g.dcaDone[prevYm(ym)] ? g.dcaStreak + 1 : 1;
    give(150 + Math.min(g.dcaStreak, 12) * 10, "quest", `เควสสำเร็จ: DCA เดือนนี้ (ติดต่อกัน ${g.dcaStreak} เดือน)`);
    if (g.dcaStreak >= 3) unlock("trophy");
    if (g.dcaStreak >= 12) unlock("crown");
  }
  const goal = num(data.settings && data.settings.goal) || 0;
  if (goal > 0 && S && S.total >= goal && !g.done["goal-" + goal]) { g.done["goal-" + goal] = today; give(300, "quest", "เควสสำเร็จ: พอร์ตถึงเป้าหมาย!"); unlock("banner"); }
  const lv1 = lvInfo(g.xp).lv;
  if (lv1 >= 10) unlock("goldcat");
  if (lv1 > lv0) ev.push({ kind: "levelup", lv: lv1, text: `LEVEL UP! Lv.${lv1}` });
  return ev;
}

// ================= Utility AI: แมวเลือกกิจกรรมเองจาก "ความต้องการ" =================
// needs 0..1: hunger (หิว), energy (มีแรง), fun (สนุก) — คะแนนผ่านเส้นโค้ง แล้วเลือกค่าสูงสุด (+กันสลับไปมา)
const UCURVE = { quad: (x) => x * x, lin: (x) => x, inv: (x) => 1 - x, sig: (x) => 1 / (1 + Math.exp(-10 * (x - 0.5))) };
function utilityScores(n, mood, ctx = {}) {
  const c = (v) => gclamp(v, 0, 1), sad = mood === "sad", hap = mood === "happy" || mood === "wow";
  const night = ctx.hour != null && (ctx.hour >= 23 || ctx.hour < 6);
  const play = c(1 - n.fun) * c(n.energy) * (hap ? 1.25 : sad ? 0.55 : 1);
  return {
    eat: UCURVE.sig(n.hunger) * 0.95,
    sleep: UCURVE.quad(c(1 - n.energy)) * (night ? 1.4 : 0.9),
    loaf: 0.18 + c(1 - n.energy) * 0.35,
    butterfly: play * 0.9, yarn: play * 0.8, watchFly: play * 0.55 + 0.05,
    zoomies: mood === "wow" ? play * 1.1 : play * 0.25,
    walk: 0.22 + c(n.energy) * 0.12, groom: 0.2 + (sad ? 0.05 : 0.08), stretch: n.energy < 0.4 ? 0.3 : 0.12,
    sulk: sad ? 0.5 : 0,
  };
}
function utilityPick(n, mood, ctx = {}) {
  const s = utilityScores(n, mood, ctx);
  if (ctx.current && s[ctx.current] != null) s[ctx.current] -= 0.15; // hysteresis: ไม่ทำซ้ำเดิมทันที
  let best = "walk", bv = -1, r = ctx.rand || Math.random;
  for (const [k, v] of Object.entries(s)) { const val = v + r() * 0.06; if (val > bv) { bv = val; best = k; } }
  return best;
}
// ผลของกิจกรรมต่อความต้องการ (ต่อวินาทีโดยประมาณ)
const NEED_FX = {
  eat: { hunger: -0.08, energy: 0.005 }, sleep: { energy: 0.04, hunger: 0.004 }, loaf: { energy: 0.012 },
  butterfly: { fun: 0.05, energy: -0.02, hunger: 0.006 }, yarn: { fun: 0.045, energy: -0.012 }, zoomies: { fun: 0.07, energy: -0.035, hunger: 0.01 },
  watchFly: { fun: 0.02 }, walk: { fun: 0.01, energy: -0.004 }, groom: { fun: 0.006 }, stretch: { energy: 0.01 }, sulk: { fun: -0.002 },
};
function stepNeeds(n, act, dt) {
  const f = NEED_FX[act] || {};
  n.hunger = gclamp(n.hunger + 0.003 * dt + (f.hunger || 0) * dt, 0, 1);
  n.energy = gclamp(n.energy - 0.0025 * dt + (f.energy || 0) * dt, 0, 1);
  n.fun = gclamp(n.fun - 0.006 * dt + (f.fun || 0) * dt, 0, 1);
  return n;
}
// ความต้องการตามเวลาจริง (สำหรับ widget ที่ขยับเองไม่ได้): หิวก่อนมื้อ, ง่วงตอนดึก/บ่าย, เบื่อสุ่มตามช่วง
function needsAt(nowMs = Date.now()) {
  const h = bkkParts(nowMs).min / 60;
  const meals = [7, 12.5, 18.5], since = Math.min(...meals.map((m) => ((h - m) + 24) % 24));
  const energy = gclamp(0.9 - Math.max(0, h - 13) * 0.04 - (h < 6 ? 0.6 : 0) + (h >= 6 && h < 9 ? 0.05 : 0), 0, 1);
  const fun = (Math.sin(nowMs / 2.7e6) + 1) / 2;
  return { hunger: gclamp(since / 6, 0, 1), energy, fun };
}

// @shared-end
// ---------- วาดภาพพิกเซล ----------
const colorCache = {};
const col = (hex, a) => { const k = hex + (a ?? ""); return colorCache[k] || (colorCache[k] = a == null ? new Color(hex) : new Color(hex, a)); };
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("");
}
function newCtx(w, h) {
  const dc = new DrawContext();
  dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = false;
  // วาดจุดโปร่งใสไว้ก่อน กันภาพว่างแล้ว getImage() คืนค่า null (บั๊ก widget ใหญ่ v2)
  dc.setFillColor(new Color("#000000", 0.01)); dc.fillRect(new Rect(0, 0, 1, 1));
  return dc;
}
function catImage(mood, palName, px = 10, faceOnly = false) {
  let g = catGrid(mood, palName);
  if (faceOnly) g = g.slice(1, 13).map((r) => r.slice(0, 16));
  const pal = Object.assign({}, SPR.fixed, SPR.palettes[palName] || SPR.palettes.orange);
  const dc = newCtx(g[0].length * px, g.length * px);
  g.forEach((row, y) => row.forEach((c, x) => {
    if (c === ".") return;
    dc.setFillColor(col(pal[c] || "#FF00FF"));
    dc.fillRect(new Rect(x * px, y * px, px, px));
  }));
  return dc.getImage();
}

// ฟอนต์ตัวเลขพิกเซล 5x7
const GLYPH = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ",": ["..", "..", "..", "..", ".#", ".#", "#."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  "฿": ["..#..", "####.", "#.#.#", "####.", "#.#.#", "####.", "..#.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  " ": ["..", "..", "..", "..", "..", "..", ".."],
};
function pixelText(str, hex, px = 6, shadowHex) {
  const chars = String(str).split("").filter((c) => GLYPH[c]);
  const cols = chars.reduce((s, c) => s + GLYPH[c][0].length + 1, -1) + (shadowHex ? 1 : 0);
  const rows = 7 + (shadowHex ? 1 : 0);
  const dc = newCtx(Math.max(1, cols) * px, rows * px);
  const draw = (ox, oy, color) => {
    dc.setFillColor(col(color));
    let x0 = 0;
    for (const c of chars) {
      const g = GLYPH[c];
      g.forEach((row, y) => row.split("").forEach((p, x) => { if (p === "#") dc.fillRect(new Rect((x0 + x + ox) * px, (y + oy) * px, px, px)); }));
      x0 += g[0].length + 1;
    }
  };
  if (shadowHex) draw(1, 1, shadowHex);
  draw(0, 0, hex);
  return { image: dc.getImage(), cols: Math.max(1, cols), rows };
}
function addPixelText(stack, str, hex, maxW, ptPerPx, shadowHex) {
  const t = pixelText(str, hex, 6, shadowHex);
  let pt = ptPerPx;
  if (t.cols * pt > maxW) pt = maxW / t.cols;
  const img = stack.addImage(t.image);
  img.imageSize = new Size(t.cols * pt, t.rows * pt);
  return img;
}

function pixelDonut(S, cells = 26, px = 6, ink = "#2B1A12") {
  const dc = newCtx(cells * px, cells * px);
  const parts = CAT_ORDER.map((c) => ({ v: S.cats[c].value, color: CATS[c].color })).filter((p) => p.v > 0);
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const R = cells / 2 - 0.4, r = cells / 2 - 8.2;
  let acc = 0;
  const bounds = parts.map((p) => { acc += p.v / total; return { end: acc, color: p.color }; });
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const dx = x + 0.5 - cells / 2, dy = y + 0.5 - cells / 2, d = Math.hypot(dx, dy);
    if (d > R || d < r) continue;
    let color;
    if (d > R - 1.15 || d < r + 1.15) color = ink;
    else {
      const ang = ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      const b = bounds.find((b) => ang <= b.end) || bounds[bounds.length - 1];
      color = b ? b.color : "#888888";
      if (d > R - 2.2) color = shade(color, 0.25);           // ไฮไลต์ขอบนอก
      else if (d < r + 2.2) color = shade(color, -0.22);     // เงาขอบใน
    }
    dc.setFillColor(col(color));
    dc.fillRect(new Rect(x * px, y * px, px, px));
  }
  return dc.getImage();
}
// @shared-begin
function allocBlocks(values, n) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * n);
  const out = raw.map((x) => Math.floor(x));
  let left = n - out.reduce((s, v) => s + v, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && values[i] > 0) { out[i]++; left--; } });
  values.forEach((v, i) => { if (v > 0 && out[i] === 0) { const j = out.indexOf(Math.max(...out)); out[j]--; out[i]++; } });
  return out;
}
// @shared-end
function blockBar(blocks, n, w, h, emptyHex = "#888888") {
  // blocks: [{count, color}] → แถบบล็อกแบบเกม
  const gap = Math.max(2, Math.round(w / n * 0.18));
  const bw = (w - gap * (n - 1)) / n;
  const dc = newCtx(w, h);
  let i = 0;
  const draw = (color, alpha) => {
    const x = i * (bw + gap);
    dc.setFillColor(col(color, alpha)); dc.fillRect(new Rect(x, 0, bw, h));
    if (alpha == null) {
      dc.setFillColor(col(shade(color, -0.3))); dc.fillRect(new Rect(x, h * 0.72, bw, h * 0.28));
      dc.setFillColor(col(shade(color, 0.35))); dc.fillRect(new Rect(x, 0, bw, h * 0.18));
    }
    i++;
  };
  for (const b of blocks) for (let k = 0; k < b.count; k++) draw(b.color);
  while (i < n) draw(emptyHex, 0.28);
  return dc.getImage();
}
function catBar(S, n, w, h) {
  const counts = allocBlocks(CAT_ORDER.map((c) => S.cats[c].value), n);
  return blockBar(CAT_ORDER.map((c, i) => ({ count: counts[i], color: CATS[c].color })), n, w, h);
}
function historyBars(hist, w, h, upHex, downHex, rows = 10) {
  const pts = hist.slice(-30);
  const dc = newCtx(w, h);
  if (pts.length < 2) {
    const n = 30, gap = Math.max(2, Math.round(w / n * 0.25)), cw = (w - gap * (n - 1)) / n, rh = h / 10;
    for (let i = 0; i < n; i++) { dc.setFillColor(col("#888888", 0.25)); dc.fillRect(new Rect(i * (cw + gap), h - rh, cw, rh)); }
    return dc.getImage();
  }
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const n = 30, gap = Math.max(2, Math.round(w / n * 0.25)), cw = (w - gap * (n - 1)) / n;
  const rg = Math.max(1, Math.round(h / rows * 0.2)), rh = (h - rg * (rows - 1)) / rows;
  const off = n - pts.length;
  pts.forEach((p, i) => {
    const level = 1 + Math.round(((p.v - min) / rng) * (rows - 1));
    const last = i === pts.length - 1;
    const base = last ? "#FFD84A" : p.v >= p.c ? upHex : downHex;
    for (let k = 0; k < level; k++) {
      const x = (i + off) * (cw + gap), y = h - (k + 1) * rh - k * rg;
      dc.setFillColor(col(k === level - 1 ? shade(base, 0.25) : base, k === level - 1 ? null : 0.85));
      dc.fillRect(new Rect(x, y, cw, rh));
    }
  });
  for (let i = 0; i < off; i++) {
    dc.setFillColor(col("#888888", 0.25));
    dc.fillRect(new Rect(i * (cw + gap), h - rh, cw, rh));
  }
  return dc.getImage();
}

// ภาพสำหรับล็อกสกรีน (iOS แสดงเป็นโทนเดียว จึงเน้นความสว่าง/ความหนาแทนสี)
function lockRing(S, mood, cc, settings) {
  const N = 26, px = 8, dc = newCtx(N * px, N * px);
  const segs = 20, R = N / 2 - 0.3, r = R - 2.4;
  let prog = null;
  if (S && settings.goal > 0) prog = Math.max(0, Math.min(1, S.total / settings.goal));
  const shares = S ? allocBlocks(CAT_ORDER.map((c) => S.cats[c].value), segs) : [];
  const segOf = []; shares.forEach((n, i) => { for (let k = 0; k < n; k++) segOf.push(i); });
  const lum = ["#FFFFFF", "#9C9C9C", "#D6D6D6", "#7A7A7A", "#ECECEC"];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - N / 2, dy = y + 0.5 - N / 2, d = Math.hypot(dx, dy);
    if (d > R || d < r) continue;
    const ang = ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    const si = Math.min(segs - 1, Math.floor(ang * segs));
    if ((ang * segs) % 1 > 0.82) continue; // ช่องว่างระหว่างบล็อก
    let c;
    if (prog != null) c = si < Math.round(prog * segs) ? col("#FFFFFF") : col("#FFFFFF", 0.22);
    else c = S ? col(lum[segOf[si] ?? 0]) : col("#FFFFFF", 0.3);
    dc.setFillColor(c); dc.fillRect(new Rect(x * px, y * px, px, px));
  }
  const face = catGrid(mood, cc).slice(2, 13).map((row) => row.slice(0, 16));
  const pal = Object.assign({}, SPR.fixed, SPR.palettes[cc] || SPR.palettes.orange);
  const fp = px * 1.0, ox = (N * px - 16 * fp) / 2, oy = (N * px - 11 * fp) / 2 + px * 0.3;
  face.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === ".") return;
    dc.setFillColor(col(pal[ch])); dc.fillRect(new Rect(ox + x * fp, oy + y * fp, fp + 0.5, fp + 0.5));
  }));
  return dc.getImage();
}
function lockBar(S, hist, settings) {
  if (settings.goal > 0) {
    const filled = Math.round(Math.max(0, Math.min(1, S.total / settings.goal)) * 20);
    return blockBar([{ count: filled, color: "#FFFFFF" }], 20, 300, 14, "#FFFFFF");
  }
  const counts = allocBlocks(CAT_ORDER.map((c) => S.cats[c].value), 20);
  const lum = ["#FFFFFF", "#9C9C9C", "#D6D6D6", "#7A7A7A", "#ECECEC"];
  return blockBar(CAT_ORDER.map((c, i) => ({ count: counts[i], color: lum[i] })), 20, 300, 14);
}

// @shared-begin
// ===== Pixel cat engine: side-view poses + room scene (shared by widget & in-app animation) =====
function makeCatEngine(SPR) {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- geometry helpers ----------
  function inEllipse(px, py, e) {
    const dx = px - e.x, dy = py - e.y, c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u * u) / (e.rx * e.rx) + (v * v) / (e.ry * e.ry) <= 1;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy || 1), 0, 1);
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }
  function inTri(px, py, a, b, c) {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d;
    const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d;
    return l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0;
  }

  // ---------- poses (cat faces right, grid 34x24, floor at y=22.5) ----------
  const W = 34, H = 24;
  function legs(hipB, hipF, feet, far) {
    // feet: [backNear, backFar, frontNear, frontFar] as [x,y]
    return [
      { a: [hipB[0] + 1.2, hipB[1]], b: feet[1], far: true },
      { a: [hipF[0] + 1.2, hipF[1]], b: feet[3], far: true },
      { a: hipB, b: feet[0] },
      { a: hipF, b: feet[2] },
    ];
  }
  const POSES = {
    walk(t) {
      const a = t * TAU, bob = Math.round(Math.sin(a * 2) * 0.4);
      const f = (ph, x) => [x + Math.sin(a + ph) * 2.3, 21.6 - Math.max(0, Math.cos(a + ph)) * 1.3];
      return {
        body: { x: 16, y: 15 + bob, rx: 8.6, ry: 4.2, rot: 0 },
        head: { x: 25.2, y: 10.3 + bob, r: 4.3 },
        legs: legs([10.6, 16.5 + bob], [21, 16.5 + bob], [f(0, 10.6), f(Math.PI, 11.8), f(Math.PI, 21), f(0, 22.2)]),
        tail: [[8, 13.5 + bob], [5, 11.5], [3.8 + Math.sin(a) * 0.7, 8.5], [4.6 + Math.sin(a) * 1.2, 5.8]],
      };
    },
    run(t) {
      const a = t * TAU, k = Math.cos(a); // k=1 stretch, k=-1 gather
      const lift = Math.max(0, k) * 2.2;
      const by = 14.6 - lift;
      return {
        body: { x: 16.5, y: by, rx: 9.2 + k * 0.6, ry: 3.9, rot: -0.08 * k },
        head: { x: 26.2 + k * 0.4, y: by - 4.2, r: 4.2 },
        ears: "back",
        legs: legs([10.5, by + 2], [22, by + 2], [
          [10.5 - 4.6 * k - 1, 21.6 - lift * 0.7], [11.6 - 4.2 * k, 21.6 - lift * 0.9],
          [22 + 4.6 * k + 1, 21.6 - lift * 0.8], [23 + 4.2 * k, 21.6 - lift * 0.6]]),
        tail: [[8, by - 1], [4.5, by - 2.2 - k], [1.5, by - 3 - k * 1.2]],
      };
    },
    pounce(t) { // crouch → leap
      if (t < 0.45) {
        const w = Math.sin(t * 40) * 0.6; // butt wiggle
        return {
          body: { x: 16 + w * 0.3, y: 18.2, rx: 8.4, ry: 3.6, rot: -0.14 },
          head: { x: 25, y: 16.2, r: 4.1 }, eyes: "wide",
          legs: legs([10.6, 19], [21, 19.5], [[9, 21.7], [10.2, 21.7], [24, 21.7], [25, 21.7]]),
          tail: [[8, 16.5], [4.5, 15 + w], [2, 13 - w], [1.5, 10 + w]],
        };
      }
      const k = (t - 0.45) / 0.55, up = Math.sin(k * Math.PI) * 6;
      return {
        body: { x: 16 + k * 3, y: 14.5 - up, rx: 9.4, ry: 3.8, rot: -0.35 + k * 0.5 },
        head: { x: 25.5 + k * 3, y: 8.6 - up + k * 3, r: 4.2 }, eyes: "wide", ears: "back",
        legs: legs([11 + k * 3, 16 - up], [21 + k * 3, 13 - up], [[5 + k * 3, 19 - up * 0.3], [6 + k * 3, 18.5 - up * 0.3], [28 + k * 3, 10 - up + k * 4], [29 + k * 3, 11 - up + k * 4]]),
        tail: [[8 + k * 3, 16 - up], [3 + k * 3, 17 - up * 0.6], [0.5 + k * 3, 18 - up * 0.4]],
      };
    },
    sit(t, o = {}) {
      const sway = Math.sin(t * TAU) * 1;
      const head = o.lookUp ? { x: 19, y: 5.6, r: 4.3 } : { x: 18.6, y: 6.6, r: 4.3 };
      const p = {
        body: { x: 14.6, y: 15.2, rx: 7, ry: 4.6, rot: -1.15 },
        extra: [{ x: 12, y: 18.4, rx: 5, ry: 3.8, rot: 0 }],
        head, eyes: o.eyes,
        legs: [{ a: [18.2, 13.5], b: [19.6, 21.7], far: true }, { a: [17, 13.5], b: [18, 21.7] }],
        tail: [[9, 21], [4.5, 21.6], [1.8 + sway * 0.3, 20.6], [1.4 + sway, 18.4]],
      };
      if (o.groom) { p.legs[1] = { a: [17, 13.8], b: [21.6, 10.4] }; p.eyes = "closed"; }
      if (o.paw) { const k = Math.sin(t * TAU); p.legs[1] = { a: [17, 13.8], b: [21 + k * 2.5, 13.5 - Math.max(0, k) * 3] }; }
      return p;
    },
    loaf(t, o = {}) {
      const breathe = Math.sin(t * TAU) * 0.25;
      return {
        body: { x: 15.5, y: 18.3 - breathe, rx: 9.2, ry: 4 + breathe, rot: 0 },
        head: { x: 24.3, y: 14.4, r: 4.3 }, eyes: o.eyes,
        legs: [{ a: [22, 21], b: [27.2, 21.7] }],
        tail: [[7, 20.8], [12, 21.8], [18, 21.8]],
      };
    },
    sleep(t) {
      const breathe = Math.sin(t * TAU) * 0.3;
      return {
        body: { x: 15.5, y: 18 - breathe, rx: 8.6, ry: 4.6 + breathe, rot: 0 },
        head: { x: 22.2, y: 18.2, r: 3.9 }, eyes: "closed", ears: "low",
        legs: [],
        tail: [[8, 20.6], [12, 22], [19, 22.1], [25, 21.4]],
      };
    },
    stretch(t) {
      const k = (Math.sin(t * TAU) + 1) / 2;
      return {
        body: { x: 15.5, y: 15.8 + k * 0.6, rx: 9, ry: 3.8, rot: 0.32 },
        head: { x: 25.4, y: 16 + k * 0.5, r: 4.1 }, eyes: "closed",
        legs: legs([10, 13.5], [21, 18.6], [[9.6, 21.7], [10.8, 21.7], [28.5 + k, 21.7], [29.6 + k, 21.7]]),
        tail: [[7.6, 11.6], [5, 8], [5.5 + k, 4.5], [7.5 + k, 2.8]],
      };
    },
    eat(t) {
      const nib = Math.round(Math.sin(t * TAU * 2) * 0.5);
      return {
        body: { x: 15, y: 15.4, rx: 8.6, ry: 4.2, rot: 0.12 },
        head: { x: 24.6, y: 16 + nib, r: 4.1 }, eyes: "closed",
        legs: legs([9.8, 17], [20.5, 17.8], [[9.4, 21.7], [10.6, 21.7], [21.2, 21.7], [22.4, 21.7]]),
        tail: [[7, 13.6], [4.3, 11], [3.4, 8], [4.6, 5.6 + Math.sin(t * TAU)]],
      };
    },
    // นั่งหน้าคอมดูกราฟ (หันขวาไปทางจอ)
    work(t, o = {}) {
      const p = POSES.sit(t, { eyes: o.eyes || "open", paw: o.type });
      p.head = { x: 19, y: 6.8, r: 4.3 };
      return p;
    },
  };

  // ---------- rasterise one cat frame ----------
  function catCells(poseName, t, opts = {}) {
    const P = (POSES[poseName] || POSES.sit)(t, opts.o || {});
    const g = Array.from({ length: H }, () => new Array(W).fill("."));
    const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
    const each = (fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fn(x, y, x + 0.5, y + 0.5); };
    const lw = 2.3;
    // far legs (darker)
    for (const L of P.legs.filter((l) => l.far)) each((x, y, cx, cy) => { if (segDist(cx, cy, L.a[0], L.a[1], L.b[0], L.b[1]) <= lw / 2) set(x, y, "D"); });
    // tail
    for (let i = 0; i < P.tail.length - 1; i++) {
      const [a, b] = [P.tail[i], P.tail[i + 1]];
      const th = lerp(1.15, 0.85, i / Math.max(1, P.tail.length - 2));
      each((x, y, cx, cy) => { if (segDist(cx, cy, a[0], a[1], b[0], b[1]) <= th) set(x, y, opts.points || i === P.tail.length - 2 ? "D" : "O"); });
    }
    // body
    const bodies = [P.body].concat(P.extra || []);
    each((x, y, cx, cy) => {
      for (const e of bodies) if (inEllipse(cx, cy, e)) {
        const belly = cy > P.body.y + P.body.ry * 0.35 && Math.abs(P.body.rot) < 0.5;
        const chest = Math.abs(P.body.rot) >= 0.5 && cx > P.body.x + 0.8;
        const stripe = (Math.floor(cx + cy * 0.25) % 4 === 0) && cy < P.body.y + 0.5;
        set(x, y, belly || chest ? (opts.points ? "M" : "L") : stripe && !opts.points ? "D" : "O");
      }
    });
    // near legs (+ white paws)
    for (const L of P.legs.filter((l) => !l.far)) each((x, y, cx, cy) => {
      if (segDist(cx, cy, L.a[0], L.a[1], L.b[0], L.b[1]) <= lw / 2) set(x, y, opts.points ? "D" : Math.hypot(cx - L.b[0], cy - L.b[1]) < 1.3 ? "L" : "O");
    });
    // head + ears
    const h = P.head, r = h.r, ear = opts.ears || P.ears || "up";
    const earH = ear === "fold" ? 1.4 : ear === "small" ? 2.3 : ear === "low" ? 2 : ear === "back" ? 2.6 : 3.4;
    const tipShift = ear === "back" ? -1.6 : ear === "fold" ? 1 : 0;
    const ears = [
      [[h.x - r * 0.85, h.y - r * 0.35], [h.x - r * 0.1, h.y - r * 0.9], [h.x - r * 0.75 + tipShift, h.y - r * 0.6 - earH]],
      [[h.x + r * 0.05, h.y - r * 0.95], [h.x + r * 0.85, h.y - r * 0.4], [h.x + r * 0.6 + tipShift, h.y - r * 0.65 - earH]],
    ];
    each((x, y, cx, cy) => {
      for (const e of ears) if (inTri(cx, cy, e[0], e[1], e[2])) {
        const c = [(e[0][0] + e[1][0] + e[2][0]) / 3, (e[0][1] + e[1][1] + e[2][1]) / 3];
        set(x, y, opts.points ? "D" : ear !== "fold" && Math.hypot(cx - c[0], cy - c[1]) < earH * 0.38 ? "P" : ear === "fold" ? "D" : "O");
      }
      if (Math.hypot(cx - h.x, cy - h.y) <= r) {
        const muzzle = opts.points ? cx > h.x - r * 0.25 && cy > h.y - r * 0.45 : cx > h.x + r * 0.05 && cy > h.y + r * 0.2;
        const brow = opts.tabby !== false && cy < h.y - r * 0.45 && Math.floor(cx) % 2 === 0;
        set(x, y, muzzle ? "L" : brow ? "D" : "O");
      }
    });
    // face
    const ex = Math.floor(h.x + r * 0.35), ey = Math.floor(h.y - r * 0.15);
    const ex2 = Math.floor(h.x + r * 0.85);
    const eyes = P.eyes || opts.eyes || "open";
    if (eyes === "closed") { set(ex - 1, ey + 1, "K"); set(ex, ey + 1, "K"); set(ex2, ey + 1, "K"); }
    else if (eyes === "happy") { set(ex - 1, ey + 1, "K"); set(ex, ey, "K"); set(ex + 1, ey + 1, "K"); set(ex2, ey + 1, "K"); }
    else if (eyes === "half") { set(ex, ey, "K"); set(ex, ey + 1, "E"); set(ex2, ey, "K"); set(ex2, ey + 1, "E"); }
    else {
      set(ex, ey, opts.iris ? "G" : "E"); set(ex, ey + 1, "E"); set(ex2, ey, opts.iris ? "G" : "E"); set(ex2, ey + 1, "E");
      if (eyes === "wide") { set(ex - 1, ey, "E"); set(ex - 1, ey + 1, "E"); }
      set(ex, ey, "W");
    }
    set(Math.floor(h.x + r - 0.2), Math.floor(h.y + r * 0.3), "N");
    set(Math.floor(h.x + r * 0.1), Math.floor(h.y + r * 0.45), "P"); // cheek
    // outline pass (4-neighbour)
    const out = g.map((row) => row.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== ".") continue;
      if ((g[y - 1] && g[y - 1][x] !== ".") || (g[y + 1] && g[y + 1][x] !== ".") || (g[y][x - 1] && g[y][x - 1] !== ".") || (g[y][x + 1] && g[y][x + 1] !== ".")) {
        if (g[y][x - 1] !== undefined || g[y][x + 1] !== undefined) out[y][x] = "K";
      }
    }
    return out;
  }

  // ---------- palettes ----------
  const GOLD_PAL = { K: "#5A3A0C", O: "#F2C230", D: "#C8901E", L: "#FFF1A8", P: "#FFD27A", N: "#C8901E", E: "#7A4A0C", W: "#FFFFFF", M: "#FFF1A8" };
  function catPalette(name) {
    if (name === "gold") return Object.assign({}, SPR.fixed, GOLD_PAL); // รูปปั้นแมวทอง (ของแต่งห้อง)
    return Object.assign({}, SPR.fixed, SPR.palettes[name] || SPR.palettes.orange);
  }
  function breedOpts(name) {
    if (name === "scottish") return { ears: "fold", iris: true };
    if (name === "british") return { ears: "small", tabby: false };
    if (name === "white" || name === "black") return { tabby: false };
    if (name === "siamese") return { tabby: false, points: true }; // วิเชียรมาศ: หน้า หู ขา หาง สีเข้ม
    return {};
  }

  // ---------- scene ----------
  // painter: (x, y, w, h, hex, alpha?) in cell units
  function skyFor(hour) {
    if (hour < 5 || hour >= 20) return { sky: ["#141833", "#1C2247", "#252C5C"], wall: "#2E2A4A", wall2: "#26223F", floor: "#4A3A5A", floor2: "#3E3050", night: true };
    if (hour < 7) return { sky: ["#3B3F7A", "#C7799A", "#F7B58C"], wall: "#D9C3A5", wall2: "#CDB595", floor: "#A0704A", floor2: "#8E6140" };
    if (hour < 17) return { sky: ["#6EC1FF", "#8FD3FF", "#BDE7FF"], wall: "#F1DFC2", wall2: "#E8D2B0", floor: "#B07A4E", floor2: "#9C6A42" };
    return { sky: ["#3D3A78", "#E0768A", "#FFB070"], wall: "#E5C9A6", wall2: "#D8BA93", floor: "#A36F48", floor2: "#8F603E" };
  }
  function drawSprite(P, rows, pal, ox, oy, flip = false, alpha) {
    const w = rows[0].length;
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const c = row[x];
        if (c === "." || c === " ") continue;
        P(ox + (flip ? w - 1 - x : x), oy + y, 1, 1, pal[c] || c, alpha);
      }
    });
  }
  const PROPS = {
    laptop: { rows: ["..KKKKKKKKK", "..KSSSSSSSK", "..KSSSSSSSK", "..KSSSSSSSK", "..KSSSSSSSK", "..KKKKKKKKK", "......KK...", "KKKKKKKKKKK", "MMMMMMMMMMM"], pal: { K: "#2B2B36", S: "#10141F", M: "#8A8FA3" } },
    bowl: { rows: ["..FFF..", ".FFFFF.", "KRRRRRK", ".KRRRK."], pal: { K: "#5A1E26", R: "#E2464F", F: "#F7C27A" } },
    mug: { rows: [".W.W.", "KKKKK", "KCCCKK", "KCCCK.K", "KCCCKK", "KKKKK"], pal: { K: "#3B2418", C: "#F4E9D2", W: "#FFFFFF" } },
    yarn: { rows: [".KKK.", "KRYRK", "KYRYK", "KRYRK", ".KKK."], pal: { K: "#7A2F5A", R: "#FF7AB6", Y: "#FFC0DD" } },
    fly1: { rows: ["YY.YY", "YWKWY", ".YKY.", "..K.."], pal: { Y: "#FFD84A", W: "#FFF3B0", K: "#3B2418" } },
    fly2: { rows: [".....", "..K..", "YWKWY", "YY.YY"], pal: { Y: "#FFD84A", W: "#FFF3B0", K: "#3B2418" } },
    coin: { rows: [".YY.", "YWYY", "YYYO", ".OO."], pal: { Y: "#FFD84A", W: "#FFF6C2", O: "#C8901E" } },
    cloud: { rows: ["..WWW...", ".WWWWWW.", "WWWWWWWW", ".B..B..B", "B..B..B."], pal: { W: "#9AA6B8", B: "#5BC0FF" } },
    heart: { rows: ["PP.PP", "PPPPP", ".PPP.", "..P.."], pal: { P: "#FF6F91" } },
    sweat: { rows: [".B", "BB", "BB"], pal: { B: "#5BC0FF" } },
    z: { rows: ["ZZZ", ".Z.", "ZZZ"], pal: { Z: "#B9CCFF" } },
    moon: { rows: [".YYY.", "YYYY.", "YYY..", "YYYY.", ".YYY."], pal: { Y: "#FFE9A8" } },
    sun: { rows: ["..Y..", ".YYY.", "YYYYY", ".YYY.", "..Y.."], pal: { Y: "#FFD84A" } },
    plant: { rows: [".G.G.", "GGGGG", ".GGG.", "..G..", ".PPP.", ".PPP."], pal: { G: "#4FAF6A", P: "#C0703A" } },
    lamp: { rows: [".YYY.", "YYYYY", "..K..", "..K..", "..K..", ".KKK."], pal: { Y: "#FFE38A", K: "#3B2418" } },
  };
  function prop(P, name, x, y, flip) { const p = PROPS[name]; drawSprite(P, p.rows, p.pal, Math.round(x), Math.round(y), flip); return p.rows[0].length; }

  // ================= ISOMETRIC (v6.4.2): ห้องไดโอรามา + แมว 3 มิติแบบพิกเซล (v6.4.3: เอาเกาะนอกห้องออก) =================
  // โลก: x → ขวาล่าง, y → ซ้ายล่าง, z ขึ้น · จอ: sx = x - y, sy = (x + y)/2 - z · ใกล้ตาเรา = x+y+z มาก
  const hex2rgb = (h) => { h = h.replace("#", ""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const MIX = {};
  function mix(a, b, k) {
    const key = a + b + k; let v = MIX[key];
    if (!v) { const A = hex2rgb(a), B = hex2rgb(b); v = MIX[key] = rgb2hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); }
    return v;
  }
  // เงา = สีเดิมที่เข้มลงและอมม่วงนิดๆ (ไม่หม่นเป็นเทา) · ไฮไลต์ = อุ่นๆ ครีม
  const DARK = {};
  const darkOf = (c) => DARK[c] || (DARK[c] = (() => { const [r, g, b] = hex2rgb(c); return rgb2hex(r * 0.5 + 14, g * 0.42 + 6, b * 0.5 + 22); })());
  const shade = (c, k) => (k >= 0 ? mix(c, "#FFF6E6", k) : mix(c, darkOf(c), Math.min(1, -k * 1.25)));
  function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  const LIGHT = (() => { const v = [-0.6, 0.15, 1], n = Math.hypot(v[0], v[1], v[2]); return v.map((a) => a / n); })();
  const IRIS = { orange: "#3FAE5E", gray: "#E8A93A", black: "#F2C230", white: "#4A8BEA", calico: "#D98A2B", scottish: "#C9893A", british: "#E39B2E", siamese: "#3D7FE0" };
  const S_BLUSH = new Set(["sit", "work"]);
  // ฟอนต์พิกเซล 3x5 สำหรับตัวเลขลอย/LEVEL UP (มีขอบเข้ม อ่านง่ายบนทุกพื้น)
  const FONT3 = {
    "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
    "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111",
    "+": "000010111010000", "-": "000000111000000", ",": "000000000010100", ".": "000000000000010", "%": "101001010100101",
    "L": "100100100100111", "V": "101101101101010", "U": "101101101101111", "P": "110101110100100", "E": "111100110100111",
    "X": "101101010101101", "!": "010010010000010", "B": "110101110101110", " ": "000000000000000", "K": "101101110101101", "M": "101111111101101",
  };
  function pixText(put, str, x0, y0, sz = 1, col = "#FFE38A", ink = "#3B2418") {
    let x = x0;
    for (const ch of String(str)) {
      const g = FONT3[ch] || FONT3[" "];
      if (put) {
        for (const pass of [0, 1]) for (let i = 0; i < 15; i++) {
          if (g[i] !== "1") continue;
          const gx = x + (i % 3) * sz, gy = y0 + Math.floor(i / 3) * sz;
          for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) {
            if (pass === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) put(gx + a + dx, gy + b + dy, ink);
            else put(gx + a, gy + b, col);
          }
        }
      }
      x += 4 * sz;
    }
    return x - x0 - sz;
  }
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0=ขวาล่าง 1=ซ้ายล่าง 2=ซ้ายบน(หันหลัง) 3=ขวาบน

  // ---------- แมวแบบ voxel: ใช้ท่าเดิม (มุมข้าง) มาปั้นเป็น 3 มิติ แล้วฉายแบบ isometric ----------
  function catSprite(poseName, t, breed, dir, sc, o = {}) {
    const Pz = (POSES[poseName] || POSES.sit)(t, o);
    const bo = breedOpts(breed), pal = catPalette(breed);
    const B0 = Pz.body;
    const pts = !!bo.points, calico = breed === "calico", tabby = bo.tabby !== false && !pts && !calico;
    const [fx, fy] = DIRS[((dir % 4) + 4) % 4], gx = -fy, gy = fx;
    const zb = new Map();
    const step = Math.min(0.55, 0.4 / sc);
    const toW = (x2, y2, z2) => { const U = (x2 - 17) * sc, Z = z2 * sc; return [fx * U + gx * Z, fy * U + gy * Z, (22.5 - y2) * sc]; };
    function plot(x2, y2, z2, n, base) {
      const [wx, wy, wz] = toW(x2, y2, z2);
      const px = Math.round(wx - wy), py = Math.round((wx + wy) / 2 - wz), d = wx + wy + wz, k = py * 4096 + px;
      const cur = zb.get(k);
      if (cur && cur.d >= d) return;
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const L = ((fx * n[0] + gx * n[2]) * LIGHT[0] + (fy * n[0] + gy * n[2]) * LIGHT[1] - n[1] * LIGHT[2]) / nl;
      // แรเงา 5 ระดับแบบสไปรต์เกม MMO ยุคเก่า (ไฮไลต์นุ่ม เงาอมม่วง)
      zb.set(k, { d, px, py, c: L > 0.72 ? shade(base, 0.32) : L > 0.42 ? shade(base, 0.14) : L > 0.04 ? base : L > -0.32 ? shade(base, -0.15) : shade(base, -0.32) });
    }
    function coat(x2, y2, z2) {
      if (calico) { const n = hash(Math.floor(x2 / 3.4), Math.floor(y2 / 3.4), Math.floor((z2 + 9) / 3.4)); return n < 0.24 ? pal.D : n < 0.4 ? "#3A2E2A" : pal.O; }
      if (tabby && y2 < B0.y + 0.6 && Math.floor(x2 * 0.55 + y2 * 0.2 + 40) % 3 === 0) return pal.D; // ลายเฉพาะแผ่นหลัง ห่างๆ ดูสะอาดแบบสไปรต์
      return pal.O;
    }
    // ทรงรี (ตัว/สะโพก/หัว)
    function ell(e, rz, colorFn) {
      const R = Math.max(e.rx, e.ry) + 0.3, c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
      for (let x2 = e.x - R; x2 <= e.x + R; x2 += step) for (let y2 = e.y - R; y2 <= e.y + R; y2 += step) {
        const dx = x2 - e.x, dy = y2 - e.y, u = dx * c + dy * s, v = -dx * s + dy * c;
        const q = (u * u) / (e.rx * e.rx) + (v * v) / (e.ry * e.ry);
        if (q > 1) continue;
        const zm = rz * Math.sqrt(1 - q);
        for (let z2 = -zm; z2 <= zm + 1e-6; z2 += step) {
          const gu = u / (e.rx * e.rx), gv = v / (e.ry * e.ry);
          plot(x2, y2, z2, [gu * c - gv * s, gu * s + gv * c, z2 / (rz * rz)], colorFn(x2, y2, z2, u, v));
        }
      }
    }
    // แคปซูล (ขา/หาง)
    function cap(a, b, r, z0, colorFn) {
      const x0 = Math.min(a[0], b[0]) - r, x1 = Math.max(a[0], b[0]) + r, y0 = Math.min(a[1], b[1]) - r, y1 = Math.max(a[1], b[1]) + r;
      const vx = b[0] - a[0], vy = b[1] - a[1], ll = vx * vx + vy * vy || 1;
      for (let x2 = x0; x2 <= x1; x2 += step) for (let y2 = y0; y2 <= y1; y2 += step) {
        const tt = clamp(((x2 - a[0]) * vx + (y2 - a[1]) * vy) / ll, 0, 1), cx = a[0] + vx * tt, cy = a[1] + vy * tt;
        const d2 = Math.hypot(x2 - cx, y2 - cy);
        if (d2 > r) continue;
        const zm = Math.sqrt(r * r - d2 * d2);
        for (let z2 = z0 - zm; z2 <= z0 + zm + 1e-6; z2 += step) plot(x2, y2, z2, [x2 - cx, y2 - cy, z2 - z0], colorFn(x2, y2, tt));
      }
    }
    // หู (กรวย)
    function cone(base, apex, rb, colorFn) {
      const ax = apex[0] - base[0], ay = apex[1] - base[1], az = apex[2] - base[2], ll = ax * ax + ay * ay + az * az;
      const R = rb + 0.2;
      for (let x2 = Math.min(base[0], apex[0]) - R; x2 <= Math.max(base[0], apex[0]) + R; x2 += step * 0.7)
        for (let y2 = Math.min(base[1], apex[1]) - R; y2 <= Math.max(base[1], apex[1]) + R; y2 += step * 0.7)
          for (let z2 = Math.min(base[2], apex[2]) - R; z2 <= Math.max(base[2], apex[2]) + R; z2 += step * 0.7) {
            const tt = ((x2 - base[0]) * ax + (y2 - base[1]) * ay + (z2 - base[2]) * az) / ll;
            if (tt < 0 || tt > 1) continue;
            const qx = x2 - base[0] - ax * tt, qy = y2 - base[1] - ay * tt, qz = z2 - base[2] - az * tt, rr = Math.hypot(qx, qy, qz), lim = rb * (1 - tt);
            if (rr > lim) continue;
            plot(x2, y2, z2, [qx + 0.4, qy - 0.6, qz], colorFn(qx, rr / (lim || 1)));
          }
    }
    const lr = 1.05;
    // ขา
    for (const L of Pz.legs) cap(L.a, L.b, lr, L.far ? -1.9 : 1.9, (x2, y2, tt) => (pts ? pal.D : tt > 0.82 ? pal.L : coat(x2, y2, 0)));
    // หาง
    for (let i = 0; i < Pz.tail.length - 1; i++) {
      const th = lerp(1.15, 0.85, i / Math.max(1, Pz.tail.length - 2)), last = i === Pz.tail.length - 2;
      cap(Pz.tail[i], Pz.tail[i + 1], th, 0, (x2, y2) => (pts || last ? pal.D : coat(x2, y2, 0)));
    }
    // ตัว
    const B = Pz.body, upright = Math.abs(B.rot) >= 0.5;
    const bodyCol = (x2, y2, z2, u, v) => {
      const belly = !upright && y2 > B.y + B.ry * 0.38, chest = upright && x2 > B.x + 0.8 && Math.abs(z2) < 3;
      if (belly || chest) return pts ? pal.M || pal.O : pal.L;
      return pts ? (y2 < B.y - B.ry * 0.5 && !upright ? mix(pal.O, pal.D, 0.18) : pal.O) : coat(x2, y2, z2);
    };
    ell(B, Math.min(B.ry * 0.98, 4.3), bodyCol);
    for (const e of Pz.extra || []) ell(e, e.ry * 1.05, bodyCol);
    // หัว
    // หัวโตแบบ chibi (หัวเกือบเท่าตัว) ยกขึ้นนิดไม่ให้จมตัว
    const lift = poseName === "sleep" || poseName === "loaf" ? 0.4 : 1.3;
    // หันหน้ามาทางกล้องนิดหนึ่ง (เหมือนตัวละครเกมที่มองผู้เล่น) เมื่อแมวหันมาทางเรา
    const camF = fx + fy, camS = gx + gy, yaw = camF > 0 ? Math.sign(camS) * 0.5 : 0, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const faceP = (a, y, b) => [hd.x + a * cyw - b * syw, y, a * syw + b * cyw]; // จุดบนหน้า (a=หน้า, b=ข้าง) หมุนตาม yaw
    const hd = Object.assign({}, Pz.head, { x: Pz.head.x + 0.6, y: Pz.head.y - lift }), r = Pz.head.r * 1.38;
    ell({ x: hd.x, y: hd.y, rx: r, ry: r * 0.92, rot: 0 }, r * 1.12, (x2, y2, z2) => {
      if (pts) { const fa = (x2 - hd.x) * cyw + z2 * syw; return fa > -r * 0.05 && Math.hypot(fa - r * 0.6, y2 - (hd.y + r * 0.2)) < r * 0.85 ? pal.D : pal.O; }
      const fa = (x2 - hd.x) * cyw + z2 * syw, fb = -(x2 - hd.x) * syw + z2 * cyw; // พิกัดในกรอบหน้า
      if (fa > r * 0.45 && y2 > hd.y + r * 0.18 && Math.abs(fb) < r * 0.62) return pal.L;
      if (tabby && y2 < hd.y - r * 0.5 && fa > -r * 0.1 && Math.abs(fb) < r * 0.45 && Math.floor(fb * 1.3 + 20) % 2 === 0) return pal.D;
      return calico ? coat(x2, y2, z2) : pal.O;
    });
    // หู
    const ear = bo.ears || Pz.ears || "up";
    const eH = (r / 4.8) * (ear === "fold" ? 1.6 : ear === "small" ? 3.2 : ear === "low" ? 2.6 : ear === "back" ? 3.6 : 4.6);
    for (const sd of [-1, 1]) {
      // หูสองข้างกางตามทิศหน้า (หมุนตาม yaw) จะได้เห็นครบทั้งคู่
      const base = faceP(-r * 0.05, hd.y - r * 0.62, sd * r * 0.55);
      const tip = ear === "fold" ? [1.5, -0.9, sd * 0.3] : ear === "low" ? [0, -eH * 0.7, sd * 1.4] : [ear === "back" ? -1.7 : 0.25, -eH, sd * 0.7];
      const apex = [base[0] + tip[0] * cyw - tip[2] * syw, base[1] + tip[1], base[2] + tip[0] * syw + tip[2] * cyw];
      cone(base, apex, r * (ear === "fold" ? 0.5 : 0.44), (qx, rel) => (pts || ear === "fold" ? pal.D : qx > 0.15 && rel < 0.62 ? pal.P : calico ? pal.D : pal.O));
    }
    // หน้า (ตา จมูก แก้ม) — วาดเฉพาะด้านที่หันมาทางเรา
    const C = [hd.x, hd.y, 0];
    const feat = (p, color, h2) => {
      const [wx, wy, wz] = toW(p[0], p[1], p[2]), [cx, cy, cz] = toW(C[0], C[1], C[2]);
      if ((wx - cx) + (wy - cy) + (wz - cz) < 0.08 * r * sc) return;
      const px = Math.round(wx - wy), py = Math.round((wx + wy) / 2 - wz), d = wx + wy + wz;
      const cur = zb.get(py * 4096 + px);
      if (!cur || cur.d - d > 1.6 * Math.max(1, sc * 2)) return;
      cur.c = color; cur.feat = 1;
      if (h2) { const c2 = zb.get((py + 1) * 4096 + px); if (c2) { c2.c = color; c2.feat = 1; } }
    };
    const eyes = Pz.eyes || o.eyes || "open";
    // ตาโตเป็นประกายแบบสไปรต์ chibi: ขอบตาบน + ม่านตา 2 โทน + จุดประกาย
    const iris = IRIS[breed] || pal.E, iris2 = shade(iris, -0.45);
    const scr = (p) => { const [wx, wy, wz] = toW(p[0], p[1], p[2]); return { px: Math.round(wx - wy), py: Math.round((wx + wy) / 2 - wz), d: wx + wy + wz, w: [wx, wy, wz] }; };
    const [ccx, ccy, ccz] = toW(C[0], C[1], C[2]);
    const setPx = (x, y, c) => { const q = zb.get(y * 4096 + x); if (q) { q.c = c; q.feat = 1; } };
    const eyeAt = [-1, 1].map((sd) => {
      const e = scr(faceP(r * 0.82, hd.y + r * 0.02, sd * r * 0.4));
      const facing = (e.w[0] - ccx) + (e.w[1] - ccy) + (e.w[2] - ccz);
      const cur = zb.get(e.py * 4096 + e.px);
      return Object.assign(e, { ok: facing > 0.05 * r * sc && cur && cur.d - e.d < 2.2 * Math.max(1, sc * 2), facing });
    }).filter((e) => e.ok);
    const big = sc * r >= 3.2;
    const near = eyeAt.length ? Math.max(...eyeAt.map((e) => e.facing)) : 0;
    for (const e of eyeAt) {
      const wide = big && e.facing >= near * 0.7 ? 2 : 1; // ตาข้างไกลแคบลง (มุม 3/4)
      const X = e.px - (wide - 1), Y = e.py - 1;
      if (eyes === "happy") { setPx(X, Y + 1, pal.K); if (wide > 1) { setPx(X + 1, Y, pal.K); setPx(X + 2, Y + 1, pal.K); } else setPx(X, Y, pal.K); }
      else if (eyes === "closed") { for (let i = 0; i < wide + (big ? 1 : 0); i++) setPx(X + i, Y + 1, pal.K); }
      else if (eyes === "half") { for (let i = 0; i < wide; i++) { setPx(X + i, Y, pal.K); setPx(X + i, Y + 1, iris2); } }
      else {
        const tall = big || eyes === "wide";
        for (let i = 0; i < wide; i++) {
          if (tall) setPx(X + i, Y - (eyes === "wide" ? 1 : 0), pal.K);
          setPx(X + i, Y + 1, i === wide - 1 && wide > 1 ? "#FFFFFF" : iris);
          if (tall) setPx(X + i, Y + 2, iris2);
        }
        if (wide === 1 && big) setPx(X, Y + 1, iris);
      }
    }
    // จมูก + ปาก + แก้มชมพู
    const ns = scr(faceP(r * 1.02, hd.y + r * 0.3, 0));
    if ((ns.w[0] - ccx) + (ns.w[1] - ccy) + (ns.w[2] - ccz) > 0.1 * r * sc) {
      setPx(ns.px, ns.py, pal.N);
      if (big && eyes !== "closed") setPx(ns.px, ns.py + 1, shade(pal.K, 0.25));
    }
    if (o.blush || S_BLUSH.has(poseName)) for (const sd of [-1, 1]) {
      const bl = scr(faceP(r * 0.72, hd.y + r * 0.45, sd * r * 0.6));
      if ((bl.w[0] - ccx) + (bl.w[1] - ccy) + (bl.w[2] - ccz) > 0.15 * r * sc) { setPx(bl.px, bl.py, mix(pal.P, "#FFFFFF", 0.15)); if (big) setPx(bl.px + 1, bl.py, mix(pal.P, "#FFFFFF", 0.15)); }
    }
    // เส้นขอบ: รอบตัว = K, ขอบซ้อนด้านใน = เข้มลง
    const out = [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of zb.values()) {
      let c = p.c;
      if (!p.feat) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = zb.get((p.py + dy) * 4096 + p.px + dx);
        if (q && q.d - p.d > 3.2 * Math.max(0.6, sc)) { c = mix(c, pal.K, 0.5); break; }
      }
      out.push([p.px, p.py, c]);
      x0 = Math.min(x0, p.px); x1 = Math.max(x1, p.px); y0 = Math.min(y0, p.py); y1 = Math.max(y1, p.py);
    }
    for (const p of [...zb.values()]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (p.py + dy) * 4096 + p.px + dx;
      // เส้นขอบรอบตัวแบบสี (ไม่ดำสนิท): สีเข้มของขนข้างๆ — ด้านบนรับแสงจางกว่า
      if (!zb.has(k)) { const oc = mix(shade(p.c, -0.6), pal.K, dy < 0 ? 0.45 : 0.75); zb.set(k, { d: -1e9, px: p.px + dx, py: p.py + dy, c: oc, ol: 1 }); out.push([p.px + dx, p.py + dy, oc]); }
    }
    const [hx, hy, hz] = toW(hd.x, hd.y - r, 0);
    return { pix: out, x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1, head: [Math.round(hx - hy), Math.round((hx + hy) / 2 - hz)] };
  }

  // ---------- ฉากไดโอรามา ----------
  const SKY = (hour) => hour < 5 || hour >= 20 ? { top: "#10142E", bot: "#2A2752", night: 1 }
    : hour < 7 ? { top: "#3B3F7A", bot: "#F4B08C", dawn: 1 }
      : hour < 17 ? { top: "#8CCBFF", bot: "#E9F6FF" }
        : { top: "#3D3A78", bot: "#FFAE73", dawn: 1 };
  const ROOM = { wallL: "#F3E2C4", wallR: "#E7CDA8", cap: "#B97A4C", capSide: "#8E5534", base: "#B98257", floor: "#D39A62", plank: "#B9804B", slab: "#9A5F35",
    soil: "#6E4A30", soil2: "#5A3B27", stone: "#8C7462", };
  const staticCache = new Map();

  function renderScene(P0, S) {
    const { w, h } = S, hour = S.hour, sky = SKY(hour), night = !!sky.night;
    const T = Math.max(5, Math.round(h * 0.1)), Hw = Math.max(12, Math.round(h * 0.29));
    const SS = Math.min(Math.floor((h - Hw - T - 3) * 2), w - 6);
    const A = Math.round(SS * 0.55), Bd = SS - A, k = SS / 110;
    const mnX = -Bd - 2, mxX = A + 2;
    const ox = Math.round((w - (mxX - mnX)) / 2) - mnX, oy = Math.round((h - (SS / 2 + Hw + T)) / 2) + Hw + 1;
    const sc = clamp(SS / 140, 0.4, 0.88); // แมวตัวใหญ่ขึ้น (หัวโตแบบ chibi)
    const X = (x, y) => ox + x - y, Y = (x, y, z) => oy + (x + y) / 2 - z;
    // ทางเดินแมว (สี่เหลี่ยมบนพรม)
    const path = { x0: Math.round(A * 0.36), x1: Math.round(A * 0.86), y0: Math.round(Bd * 0.36), y1: Math.round(Bd * 0.84) };
    const desk = { x: 1, y: Math.round(Bd * 0.12), dx: Math.max(6, Math.round(9 * k)), dy: Math.max(10, Math.round(17 * k)), h: Math.max(5, Math.round(9 * k)) };
    const bed = { x: 1, dx: Math.max(10, Math.round(15 * k)), dy: Math.max(12, Math.round(19 * k)), h: Math.max(3, Math.round(4 * k)) };
    bed.y = Bd - bed.dy - 1;
    const bowl = { x: A - Math.max(6, Math.round(8 * k)), y: Math.max(7, Math.round(Bd * 0.2)) }; // ฝั่งขวาของจอ ใต้ต้นไม้ นอกทางเดินแมว

    // ---------- เลเยอร์นิ่ง (cache) ----------
    const decor = S.decor || [];
    const key = [w, h, Math.floor(hour), S.chartUp !== false, S.activity === "watchUS", decor.join(",")].join("|");
    let base = staticCache.get(key);
    if (!base) {
      const fb = new Array(w * h).fill(null);
      const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < w && y < h) fb[y * w + x] = c; };
      const face = (o, a, b, na, nb, fn) => {
        for (let u = 0; u <= na + 1e-6; u += 0.5) for (let v = 0; v <= nb + 1e-6; v += 0.5) {
          const x = o[0] + a[0] * u + b[0] * v, y = o[1] + a[1] * u + b[1] * v, z = o[2] + a[2] * u + b[2] * v;
          const c = typeof fn === "function" ? fn(u, v) : fn;
          if (c) put(X(x, y), Y(x, y, z), c);
        }
      };
      const line = (p, q, c) => {
        const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 3) || 1;
        for (let i = 0; i <= n; i++) { const t2 = i / n, x = lerp(p[0], q[0], t2), y = lerp(p[1], q[1], t2), z = lerp(p[2], q[2], t2); put(X(x, y), Y(x, y, z), c); }
      };
      const box = (x, y, z, dx, dy, dz, top, left, right, ol) => {
        face([x, y, z + dz], [1, 0, 0], [0, 1, 0], dx, dy, top);
        face([x, y + dy, z], [1, 0, 0], [0, 0, 1], dx, dz, left);
        face([x + dx, y, z], [0, 1, 0], [0, 0, 1], dy, dz, right);
        if (ol) {
          const e = [[[x, y, z + dz], [x + dx, y, z + dz]], [[x, y, z + dz], [x, y + dy, z + dz]], [[x, y + dy, z], [x, y + dy, z + dz]], [[x + dx, y, z], [x + dx, y, z + dz]],
            [[x, y + dy, z], [x + dx, y + dy, z]], [[x + dx, y, z], [x + dx, y + dy, z]]];
          for (const [p, q] of e) line(p, q, ol);
          line([x, y + dy, z + dz], [x + dx, y + dy, z + dz], shade(typeof top === "string" ? top : "#999999", 0.35));
          line([x + dx, y, z + dz], [x + dx, y + dy, z + dz], shade(typeof top === "string" ? top : "#999999", 0.35));
        }
      };
      const tri = (c1, c2, c3) => ({ top: c1, left: c2, right: c3 });
      const B3 = (x, y, z, dx, dy, dz, c, ol = "#3B2418") => box(x, y, z, dx, dy, dz, c.top, c.left, c.right, ol);
      const soilFn = (len, depth, lip, lipC) => (u, v) => {
        const vv = depth - v; // จากผิวลงไป
        if (vv < lip) return lipC;
        if (vv < lip + 0.6) return mix(lipC, "#2A1A12", 0.45);
        const n = hash(Math.floor(u / 2), Math.floor((v + Math.sin(u * 0.4) * 1.2) / 1.5), 7);
        if (n > 0.93) return ROOM.stone;
        return Math.floor(v + Math.sin(u * 0.35) * 1.3) % 4 === 0 ? ROOM.soil2 : ROOM.soil;
      };

      // ===== ห้อง =====
      // ฐานดิน + พื้นไม้
      face([0, Bd, -T], [1, 0, 0], [0, 0, 1], A, T, soilFn(A, T, 2.5, ROOM.slab));
      face([A, 0, -T], [0, 1, 0], [0, 0, 1], Bd, T, (u, v) => shade(soilFn(Bd, T, 2.5, ROOM.slab)(u, v), -0.14));
      face([0, 0, 0], [1, 0, 0], [0, 1, 0], A, Bd, (u, v) => (Math.floor(v) % 5 === 0 ? ROOM.plank : (Math.floor(u + Math.floor(v / 5) * 7) % 13 === 0 ? ROOM.plank : ROOM.floor)));
      // ผนังซ้าย (x=0) + ผนังขวา (y=0)
      face([0, 0, 0], [0, 1, 0], [0, 0, 1], Bd, Hw, (u, v) => (v < 2 ? ROOM.base : Math.floor(u / 3) % 2 ? ROOM.wallL : mix(ROOM.wallL, "#E8CFA5", 0.5)));
      face([0, 0, 0], [1, 0, 0], [0, 0, 1], A, Hw, (u, v) => (v < 2 ? shade(ROOM.base, -0.1) : ROOM.wallR));
      face([-2, 0, Hw], [1, 0, 0], [0, 1, 0], 2, Bd, ROOM.cap);
      face([0, -2, Hw], [1, 0, 0], [0, 1, 0], A, 2, ROOM.cap);
      face([-2, -2, Hw], [1, 0, 0], [0, 1, 0], 2, 2, ROOM.cap);
      face([-2, Bd, -T], [1, 0, 0], [0, 0, 1], 2, Hw + T, (u, v) => (v < T ? soilFn(2, T, 2.5, ROOM.slab)(u, v) : ROOM.capSide));
      face([A, -2, -T], [0, 1, 0], [0, 0, 1], 2, Hw + T, (u, v) => (v < T ? shade(soilFn(2, T, 2.5, ROOM.slab)(u, v), -0.14) : shade(ROOM.capSide, -0.1)));
      line([0, 0, 0], [0, 0, Hw], mix(ROOM.wallL, "#7A4A2A", 0.35));
      // หน้าต่างผนังขวา: ท้องฟ้าตามเวลา
      const wx0 = Math.round(A * 0.44), ww = Math.max(10, Math.round(A * 0.32)), wz0 = Math.round(Hw * 0.36), wh = Math.max(7, Math.round(Hw * 0.5));
      face([wx0, 0, wz0], [1, 0, 0], [0, 0, 1], ww, wh, (u, v) => {
        if (u < 1 || v < 1 || u > ww - 1 || v > wh - 1 || Math.abs(u - ww / 2) < 0.5 || Math.abs(v - wh / 2) < 0.5) return "#7A4A2A";
        const kk = 1 - v / wh;
        let c = mix(sky.top, sky.bot, clamp(kk * 1.1, 0, 1));
        if (night && hash(Math.floor(u), Math.floor(v), 9) > 0.93) c = "#FFFFFF";
        const sx2 = ww * 0.72, sz2 = wh * 0.72;
        if (Math.hypot(u - sx2, (v - sz2) * 1.2) < (night ? 1.8 : 2.2)) c = night ? "#FFE9A8" : "#FFD84A";
        return c;
      });
      box(wx0 - 1, 0, wz0 - 1.5, ww + 2, 2.5, 1.2, "#C98E5A", "#B07A4C", "#8E5A34", null);
      // โปสเตอร์กราฟบนผนังซ้าย
      const py0 = desk.y + 2, pw = Math.max(7, Math.round(desk.dy * 0.6)), pz0 = Math.round(Hw * 0.55), ph2 = Math.max(5, Math.round(Hw * 0.3));
      face([0, py0, pz0], [0, 1, 0], [0, 0, 1], pw, ph2, (u, v) => {
        if (u < 1 || v < 1 || u > pw - 1 || v > ph2 - 1) return "#5E3820";
        const gv = 1.2 + (u / pw) * (ph2 - 3) + Math.sin(u * 1.7) * 0.9;
        return Math.abs(v - gv) < 0.6 ? "#23994A" : "#FFF8E8";
      });
      // ชั้นหนังสือ (ผนังขวา)
      const shx = Math.max(3, Math.round(A * 0.1)), shw = Math.max(7, Math.round(11 * k)), shd = Math.max(3, Math.round(4 * k)), shh = Math.round(Hw * 0.66);
      box(shx, 0, 0, shw, shd, shh, "#A8693E", (u, v) => {
        const lv = Math.floor(v / (shh / 3));
        if (u < 1 || u > shw - 1 || v % (shh / 3) < 1 || v > shh - 1) return "#8E5534";
        const bk = Math.floor(u / 1.5), n = hash(bk, lv, 4);
        if (n > 0.85) return "#6B3E22";
        return ["#E2464F", "#5BC0F0", "#F2C14E", "#86B84E", "#F3E2C4", "#B576D9"][Math.floor(n * 6)];
      }, "#6B3E22", "#3B2418");
      // ต้นไม้กระถาง มุมขวา
      const plx = A - Math.max(6, Math.round(8 * k)), pls = Math.max(4, Math.round(5 * k));
      box(plx, 1, 0, pls, pls, pls * 0.9, "#5E3820", "#D9824A", "#B5683A", "#3B2418");
      box(plx - 1, 0, pls * 0.9, pls + 2, pls + 2, pls * 1.2, (u, v) => (hash(Math.floor(u), Math.floor(v), 2) > 0.7 ? "#9BD066" : "#6FAE48"), "#5E9E3E", "#467E2E", "#2A4A1E");
      box(plx + 0.5, 1.5, pls * 2.1, pls - 1, pls - 1, pls * 0.7, "#9BD066", "#6FAE48", "#518E36", "#2A4A1E");
      // พรม
      face([path.x0 - 3, path.y0 - 3, 0], [1, 0, 0], [0, 1, 0], path.x1 - path.x0 + 6, path.y1 - path.y0 + 6, (u, v) => {
        const W2 = path.x1 - path.x0 + 6, H2 = path.y1 - path.y0 + 6;
        if (u < 1.5 || v < 1.5 || u > W2 - 1.5 || v > H2 - 1.5) return "#C0603A";
        return (Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? "#F0B27A" : "#E89A6A";
      });
      // เตียง (ผนังซ้ายด้านหน้า)
      box(bed.x, bed.y, 0, bed.dx, bed.dy, bed.h, "#8E5534", "#7A4A2A", "#5E3820", "#3B2418");
      box(bed.x, bed.y, bed.h, bed.dx, bed.dy, 2, (u, v) => (v > bed.dy * 0.38 ? ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? "#7FB2E5" : "#9CC6F0") : "#FFF8E8"),
        (u) => (Math.floor(u / 2) % 2 ? "#6A9BD0" : "#7FB2E5"), (u) => (u > bed.dy * 0.38 ? "#5A88BC" : "#E6DCC8"), "#3B2418");
      box(bed.x + 1.5, bed.y + 1.5, bed.h + 2, bed.dx - 3, Math.max(3, bed.dy * 0.22), 1.5, "#FFFFFF", "#EDE4D6", "#D9CDB9", "#8A6E57");
      box(-0.5, bed.y, 0, 1.5, bed.dy, bed.h + 7 * k, "#A8693E", "#8E5534", "#6B3E22", "#3B2418");
      // โต๊ะทำงาน + แล็ปท็อป (จอหันมาหาแมว/เรา)
      const dk = desk;
      box(dk.x, dk.y, dk.h - 1.2, dk.dx, dk.dy, 1.2, "#C98E5A", "#A8693E", "#8E5534", "#3B2418");
      for (const [lx2, ly2] of [[dk.dx - 1.5, 0.3], [dk.dx - 1.5, dk.dy - 1.5]]) box(dk.x + lx2, dk.y + ly2, 0, 1.2, 1.2, dk.h - 1.2, "#8E5534", "#7A4A2A", "#5E3820", null);
      const lpx = dk.x + 1, lpy = dk.y + Math.round(dk.dy * 0.22), lpw = Math.max(6, Math.round(dk.dy * 0.6)), lph = Math.max(4, Math.round(5.5 * k));
      box(lpx + 0.5, lpy, dk.h, Math.max(3, dk.dx * 0.55), lpw, 0.6, "#9AA0B4", "#7A8096", "#5A6076", null);
      const up = S.chartUp !== false, cc = up ? "#5BE38A" : "#FF6B7A";
      face([lpx, lpy, dk.h + 0.6], [0, 1, 0], [0, 0, 1], lpw, lph, (u, v) => {
        if (u < 0.6 || v < 0.6 || u > lpw - 0.6 || v > lph - 0.6) return "#2B2B36";
        const gv = up ? 1 + (u / lpw) * (lph - 2.5) + Math.sin(u * 2.1) * 0.6 : lph - 1.5 - (u / lpw) * (lph - 2.5) + Math.sin(u * 2.1) * 0.6;
        return Math.abs(v - gv) < 0.55 ? cc : "#141A2A";
      });
      if (S.activity === "watchUS") box(dk.x + dk.dx - 3, dk.y + dk.dy - 3.5, dk.h, 2, 2, 2.2, "#F4E9D2", "#E6D6B8", "#C9B48E", "#3B2418");
      // โคมไฟตั้งพื้น
      const lmx = 2, lmy = Math.round((dk.y + dk.dy + bed.y) / 2);
      box(lmx, lmy, 0, 1, 1, Hw * 0.55, "#5E3820", "#4A2C18", "#3B2418", null);
      box(lmx - 1.5, lmy - 1.5, Hw * 0.55, 4, 4, 3, "#FFE38A", "#F2C14E", "#D9A23A", "#7A4A2A");
      // ชามข้าว
      const bs = Math.max(3.5, 4.5 * k);
      box(bowl.x, bowl.y, 0, bs, bs, 1.8, (u, v) => (u > 0.8 && v > 0.8 && u < bs - 0.8 && v < bs - 0.8 ? "#C8782E" : "#E2464F"), "#E2464F", "#B5323B", "#5A1E26");
      if (k > 0.8) face([bowl.x + 1, bowl.y + 1, 2], [1, 0, 0], [0, 1, 0], bs - 2, bs - 2, (u, v) => ((Math.floor(u * 2) + Math.floor(v * 2)) % 3 ? "#E8A050" : "#B8642A"));
      // ===== ของแต่งห้องที่ปลดล็อกจากเควส/เลเวล =====
      if (decor.includes("plant2")) { // มอนสเตอร่าข้างชั้นหนังสือ
        const px2 = shx + shw + 2, ps = Math.max(4, Math.round(4.5 * k));
        box(px2, 1, 0, ps, ps, ps * 0.8, "#5E3820", "#E8E0D0", "#C9BFAE", "#3B2418");
        for (let i = 0; i < 4; i++) box(px2 - 1 + (i % 2) * (ps * 0.5), 0.5 + Math.floor(i / 2) * (ps * 0.4), ps * 0.8 + i * ps * 0.35, ps * 0.7, ps * 0.6, ps * 0.45, (u, v) => (hash(Math.floor(u), Math.floor(v), 9 + i) > 0.75 ? "#7FC85A" : "#3E9A4A"), "#2F7E3A", "#246A30", "#1E4A22");
      }
      if (decor.includes("trophy")) { // ถ้วยทองบนชั้นหนังสือ
        const tx = shx + shw * 0.35, tz = shh, tsz = Math.max(2.5, 3 * k);
        box(tx, 0.8, tz, tsz, tsz, 1, "#8E5534", "#7A4A2A", "#5E3820", "#3B2418");
        box(tx + 0.4, 1.2, tz + 1, tsz - 0.8, tsz - 0.8, tsz * 1.1, "#FFE38A", "#F2C230", "#C8901E", "#6B4A10");
        box(tx - 0.3, 0.5, tz + 1 + tsz * 1.1, tsz + 0.6, tsz + 0.6, 0.8, "#FFF1A8", "#F2C230", "#C8901E", "#6B4A10");
      }
      if (decor.includes("banner")) { // ธงเป้าหมายบนผนังซ้ายเหนือเตียง
        const by0 = bed.y + 2, bw = Math.max(6, Math.round(bed.dy * 0.5)), bz = Math.round(Hw * 0.5), bh = Math.round(Hw * 0.4);
        face([0, by0, bz], [0, 1, 0], [0, 0, 1], bw, bh, (u, v) => {
          const cut = v < (bh * 0.35) * (1 - Math.abs(u - bw / 2) / (bw / 2));
          if (cut) return null;
          if (v > bh - 1.2) return "#6B3E22";
          return Math.abs(u - bw / 2) < 1.2 && v > bh * 0.45 && v < bh * 0.8 ? "#FFE38A" : "#E2464F";
        });
      }
      if (decor.includes("goldcat")) { // รูปปั้นแมวทองบนแท่น ปลายเตียง
        const gx = bed.x + bed.dx + 2.5, gy = Bd - Math.max(5, Math.round(6 * k)), ph = Math.max(2, 2.5 * k);
        box(gx - 2, gy - 2, 0, 5, 5, ph, "#E8E0D0", "#C9BFAE", "#A89E8E", "#5E554A");
        const gs = catSprite("sit", 0.25, "gold", 0, Math.max(0.3, sc * 0.55), { eyes: "happy" });
        const ox2 = X(gx + 0.5, gy + 0.5), oy2 = Y(gx + 0.5, gy + 0.5, ph);
        for (const [x, y, c] of gs.pix) put(ox2 + x, oy2 + y, c);
      }

      // กลางคืน: ห้องมืดลง + แสงไฟอุ่น
      if (night || sky.dawn) {
        const amt = night ? 0.4 : 0.14, tint = night ? "#1B1840" : "#3A2A50";
        for (let i = 0; i < fb.length; i++) if (fb[i]) fb[i] = mix(fb[i], tint, amt);
        const glow = (gx, gy, rad, col, a) => {
          for (let y = Math.floor(gy - rad); y <= gy + rad; y++) for (let x = Math.floor(gx - rad * 1.6); x <= gx + rad * 1.6; x++) {
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const dd = Math.hypot((x - gx) / 1.6, y - gy) / rad;
            if (dd > 1 || !fb[y * w + x]) continue;
            fb[y * w + x] = mix(fb[y * w + x], col, a * (dd < 0.5 ? 1 : dd < 0.8 ? 0.6 : 0.3));
          }
        };
        if (night) {
          glow(X(lmx, lmy), Y(lmx, lmy, Hw * 0.55 + 2), 14 * k + 4, "#FFD27A", 0.35);
          glow(X(lpx, lpy + lpw / 2), Y(lpx, lpy + lpw / 2, dk.h + lph / 2), 7 * k + 2, "#9FD0FF", 0.16);
        }
      }
      base = { fb };
      if (staticCache.size > 8) staticCache.clear();
      staticCache.set(key, base);
    }

    // ---------- เลเยอร์เคลื่อนไหว ----------
    const fb = base.fb.slice();
    const put = (x, y, c, a) => {
      x = Math.round(x); y = Math.round(y);
      if (!c || x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      fb[i] = a == null || a >= 1 ? c : mix(fb[i] || skyAt(x, y), c, a);
    };
    const Pd = (x, y, ww, hh, c, a) => { for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < ww; xx++) put(x + xx, y + yy, c, a); };
    const pr = (name, x, y, flip) => prop(Pd, name, x, y, flip);
    // เมฆลอยช้าๆ (กลางวัน/เย็น) — S.clock = วินาที (แอปส่งมาให้เมฆขยับ, widget นิ่ง)
    const clouds = night ? [] : [0, 1, 2].map((i) => {
      const span = w + 40, cw = 14 + ((S.seed + i * 7) % 3) * 5;
      return { x: ((((S.clock || 0) * (0.5 + i * 0.25) + i * span / 3 + (S.seed || 0) * 13) % span) + span) % span - 20, y: 4 + ((i * 11 + (S.seed || 0)) % Math.max(4, Math.floor(h * 0.3))), w: cw };
    });
    const cloudC = sky.dawn ? "#FFE3D0" : "#FFFFFF";
    function skyAt(x, y) {
      for (const c of clouds) {
        const dx = x - c.x, dy = y - c.y;
        if (dy >= -3 && dy <= 2 && dx >= 0 && dx <= c.w) {
          const top = dx > c.w * 0.25 && dx < c.w * 0.7 ? -3 : dx > c.w * 0.1 && dx < c.w * 0.9 ? -2 : -1;
          if (dy >= top) return dy === 2 ? mix(cloudC, sky.bot, 0.35) : cloudC;
        }
      }
      const kk = y / h;
      let c = mix(sky.top, sky.bot, Math.floor(kk * 6) / 6);
      if (night && hash(x, y, 1) > 0.993) c = hash(x, y, 2) > 0.5 ? "#FFFFFF" : "#B9CCFF";
      return c;
    }

    const A2 = S.activity, t = S.t, ft = S.ft ?? t;
    const pal = catPalette(S.catColor);
    const moodEyes = S.mood === "sad" ? "half" : S.mood === "happy" || S.mood === "wow" ? "happy" : "open";
    let pose = "sit", o = { eyes: moodEyes }, dir = 0, cx = (path.x0 + path.x1) / 2, cy = (path.y0 + path.y1) / 2, cz = 0;
    const around = (u) => { // ตำแหน่งบนเส้นรอบพรม u∈[0,1)
      const L1 = path.x1 - path.x0, L2 = path.y1 - path.y0, per = 2 * (L1 + L2);
      let d = (((u % 1) + 1) % 1) * per;
      if (d < L1) return [path.x0 + d, path.y0, 0]; d -= L1;
      if (d < L2) return [path.x1, path.y0 + d, 1]; d -= L2;
      if (d < L1) return [path.x1 - d, path.y1, 2]; d -= L1;
      return [path.x0, path.y1 - d, 3];
    };
    const extras = [], pre = [];
    if (A2 === "watchTH" || A2 === "watchUS" || A2 === "ready") {
      pose = "work"; dir = 2; o = { eyes: S.mood === "sad" ? "half" : "open", type: A2 !== "ready" };
      cx = desk.x + desk.dx + Math.round(9 * sc + 3); cy = desk.y + desk.dy * 0.68;
    } else if (A2 === "eat") {
      pose = "eat"; o = {}; dir = 0; cx = bowl.x - Math.round(11 * sc); cy = bowl.y + 1.5;
    } else if (A2 === "sleep") {
      pose = "sleep"; dir = 1; cx = bed.x + bed.dx * 0.5; cy = bed.y + bed.dy * 0.35; cz = bed.h + 2;
    } else if (A2 === "butterfly" || A2 === "zoomies" || A2 === "walk" || A2 === "yarn") {
      const sp = A2 === "zoomies" ? 2 : 1, u = t * sp;
      const [x, y, d] = around(u); cx = x; cy = y; dir = d;
      pose = A2 === "walk" || A2 === "yarn" ? "walk" : "run";
      if (A2 === "butterfly") {
        const [bx, by] = around(u + 0.07), bz = 16 * sc + 8 + Math.sin(ft * TAU * 2) * 2;
        extras.push(() => pr(Math.floor(ft * 6) % 2 ? "fly1" : "fly2", X(bx, by) - 2, Y(bx, by, bz) - 2));
        if (Math.abs(((u * 4) % 1) - 0.5) > 0.44) pose = "pounce";
      }
      if (A2 === "yarn") { const [yx, yy] = around(u + 0.08); (d >= 2 ? pre : extras).push(() => pr("yarn", X(yx, yy) - 2, Y(yx, yy, 0) - 4)); }
      if (A2 === "zoomies") for (let i = 0; i < 4; i++) extras.push(() => pr("coin", (S.seed * 7 + i * 23 + t * 60) % (w - 4), (i * 7 + t * h * 2) % (h - 6)));
    } else if (A2 === "stretch") { pose = "stretch"; o = {}; dir = 1; }
    else if (A2 === "groom") { pose = "sit"; o = { groom: true }; dir = 0; }
    else if (A2 === "watchFly") {
      pose = "sit"; o = { lookUp: true, eyes: "wide" }; dir = 0;
      extras.push(() => pr(Math.floor(ft * 6) % 2 ? "fly1" : "fly2", X(cx, cy) + 6 + Math.sin(t * TAU) * 4, Y(cx, cy, 0) - 20 * sc - 6 + Math.cos(t * TAU * 2) * 2));
    } else if (A2 === "sulk") { pose = "loaf"; dir = 2; o = { eyes: "half" }; }
    else if (A2 === "loaf") { pose = "loaf"; dir = 1; o = { eyes: moodEyes }; }
    else { pose = "sit"; dir = 1; o = { eyes: moodEyes }; }
    if (S.sleepy && (A2 === "watchUS" || A2 === "watchTH")) o.eyes = "half";
    if (S.mood === "happy" && pose !== "sleep") o.blush = 1;

    // เงาใต้ตัว
    const sx0 = X(cx, cy), sy0 = Y(cx, cy, cz);
    const shr = 7 * sc + 2;
    for (let y = -Math.ceil(shr / 2); y <= shr / 2; y++) for (let x = -Math.ceil(shr * 1.4); x <= shr * 1.4; x++) {
      if ((x * x) / (shr * shr * 1.9) + (y * y) / (shr * shr * 0.24) <= 1) put(sx0 + x, sy0 + y, "#2A1630", night ? 0.18 : 0.22);
    }
    for (const f of pre) f();
    const spr = catSprite(pose, ft, S.catColor, dir, sc, o);
    const tintC = night ? "#1B1840" : null;
    // squash & stretch (แตะแมว/เลเวลอัป): ยืดหดรอบเท้า แล้วเด้งกลับ (ผู้เรียกส่งค่าที่ค่อยๆ หมดไป)
    const sq = clamp(S.squash || 0, -0.6, 0.6), kx = 1 + sq * 0.35, ky = 1 - sq * 0.35;
    for (const [x, y, c] of spr.pix) {
      const cc2 = tintC ? mix(c, tintC, 0.22) : c;
      if (!sq) { put(sx0 + x, sy0 + y, cc2); continue; }
      const X0 = Math.floor(sx0 + x * kx), X1 = Math.floor(sx0 + (x + 1) * kx), Y0 = Math.floor(sy0 + y * ky), Y1 = Math.floor(sy0 + (y + 1) * ky);
      for (let yy = Y0; yy < Math.max(Y1, Y0 + 1); yy++) for (let xx = X0; xx < Math.max(X1, X0 + 1); xx++) put(xx, yy, cc2);
    }
    for (const f of extras) f();
    const hx = sx0 + Math.round(spr.head[0] * kx), hy = sy0 + Math.round(spr.head[1] * ky);
    if (decor.includes("crown") && pose !== "sleep") { // มงกุฎบนหัว (DCA 12 เดือน)
      const CR = ["Y.Y.Y", "YRYRY", "YYYYY"];
      CR.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] !== ".") put(hx - 2 + x, hy - 3 + y, row[x] === "R" ? "#E2464F" : "#F2C230"); });
    }
    if (A2 === "sleep") { const zt = Math.floor(t * 3); for (let i = 0; i <= zt; i++) pr("z", hx + 3 + i * 3, hy - 4 - i * 4); }
    // อีโมตในฟองคำพูดเหนือหัว (สไตล์เกม MMO) — แอปจะโผล่เป็นจังหวะ, widget โชว์ค้าง
    let emo = null;
    if (A2 === "sulk") emo = "dots";
    else if (A2 === "watchFly" || (A2 === "butterfly" && pose === "pounce") || A2 === "ready") emo = "bang";
    else if (S.mood === "sad" && (A2 === "watchTH" || A2 === "watchUS")) emo = "sweat";
    else if (S.mood === "wow" && A2 !== "sleep" && A2 !== "zoomies") emo = "money";
    else if (S.mood === "happy" && A2 !== "sleep") emo = Math.floor((S.clock || 0) / 4) % 2 ? "note" : "heart";
    else if (A2 === "yarn" || A2 === "eat") emo = "note";
    const showEmo = S.clock == null || ((S.clock % 6) < 3.6);
    if (emo && showEmo) {
      const ex = Math.round(hx + 2), ey = Math.round(hy - 12 + (Math.floor((S.clock || 0) * 2) % 2));
      const W2 = 11, H2 = 9, ink = "#3B2418";
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
        const corner = (x === 0 || x === W2 - 1) && (y === 0 || y === H2 - 1);
        if (corner) continue;
        const edge = x === 0 || y === 0 || x === W2 - 1 || y === H2 - 1 || ((x === 1 || x === W2 - 2) && (y === 1 || y === H2 - 2) && false);
        put(ex + x, ey + y, edge ? ink : "#FFFFFF");
      }
      put(ex + 2, ey + H2, ink); put(ex + 3, ey + H2, "#FFFFFF"); put(ex + 4, ey + H2, ink); put(ex + 2, ey + H2 + 1, ink); put(ex + 3, ey + H2 + 1, ink); put(ex + 3, ey + H2 - 1, "#FFFFFF");
      const ICON = {
        heart: [".R.R.", "RRRRR", "RRRRR", ".RRR.", "..R.."],
        note: ["..KK.", "..K.K", "..K..", "KKK..", "KKK.."],
        bang: ["..R..", "..R..", "..R..", ".....", "..R.."],
        dots: [".....", ".....", ".....", ".....", "K.K.K"],
        sweat: ["...B.", "..BB.", ".BBBB", ".BBBB", "..BB."],
        money: [".YYY.", "YOYOY", "YYOYY", "YOYOY", ".YYY."],
      }[emo];
      const IC = { R: "#E8434F", K: "#3B2418", B: "#4FB0F0", Y: "#F2C230", O: "#B5781A" };
      ICON.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] !== ".") put(ex + 3 + x, ey + 2 + y, IC[row[x]]); });
    }
    // ===== เอฟเฟกต์เกม (juice): ตัวเลขลอย / เหรียญกระเด็น / LEVEL UP — S.fx = [{kind, text, age, color, seed}] =====
    for (const f of S.fx || []) {
      const age = f.age || 0;
      if (f.kind === "num" || f.kind === "lvl") {
        // ตัวเลขลอยขึ้นแบบดาเมจในเกม: เด้งขึ้นเร็วแล้วชะลอ (ease-out) แล้วหายไป
        const rise = 14 * (1 - Math.pow(1 - Math.min(1, age / 1.2), 3));
        const big = f.kind === "lvl", sz = big ? 2 : 1;
        const tw = pixText(null, f.text, 0, 0, sz);
        if (age < 1.8) pixText(put, f.text, Math.round(hx - tw / 2 + (f.dx || 0)), Math.round(hy - 14 - rise - (big ? 8 : 0) - (f.dy || 0)), sz, f.color || "#FFE38A", "#3B2418");
      } else if (f.kind === "coins") {
        // เหรียญพุ่งออกจากตัวแมว: ความเร็วต้น + แรงโน้มถ่วง
        for (let i = 0; i < (f.n || 8); i++) {
          const a = hash(i, f.seed || 1, 3) * Math.PI - Math.PI, sp = 18 + hash(i, f.seed || 1, 4) * 18;
          const x = hx + Math.cos(a) * sp * age, y = hy - 4 + Math.sin(a) * sp * age + 40 * age * age;
          if (age < 1.2) pr("coin", x - 2, y - 2);
        }
      } else if (f.kind === "sparkle") {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + age * 2, rr = 6 + age * 22;
          if (age < 1) put(hx + Math.cos(a) * rr, hy - 2 + Math.sin(a) * rr * 0.6, i % 2 ? "#FFF6B0" : "#FFFFFF");
        }
      }
    }
    // วาดออกจอ (รวมช่วงสีเดียวกันเป็นสี่เหลี่ยมเดียว)
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const c = fb[y * w + x] || skyAt(x, y);
        let x2 = x + 1;
        while (x2 < w && (fb[y * w + x2] || skyAt(x2, y)) === c) x2++;
        P0(x, y, x2 - x, 1, c);
        x = x2;
      }
    }
    return { catX: sx0, face: dir === 1 || dir === 2 ? -1 : 1 };
  }

  return { catCells, catSprite, renderScene, breedOpts, catPalette, POSES, W, H, PROPS };
}
// @shared-end
const CAT_ENGINE = makeCatEngine(SPR);
// วาดฉากห้องแมวเป็นภาพสำหรับ widget (widget ขยับเองไม่ได้ จึงเปลี่ยนท่า/ตำแหน่งทุกครั้งที่รีเฟรช)
function sceneImage(S, act, settings, wPt, hPt, ptPerCell = 1) {
  const cw = Math.floor(wPt / ptPerCell), ch = Math.floor(hPt / ptPerCell), px = 3;
  const dc = newCtx(cw * px, ch * px);
  const P = (x, y, w, h, hex, a) => { if (w <= 0 || h <= 0) return; dc.setFillColor(col(hex, a == null || a >= 1 ? null : a)); dc.fillRect(new Rect(x * px, y * px, w * px, h * px)); };
  const sd = act.seed;
  const thUp = S ? S.cats.thai.day >= 0 : true, usUp = S ? S.cats.us.day + S.cats.fund.day >= 0 : true;
  CAT_ENGINE.renderScene(P, {
    w: cw, h: ch, activity: act.a, mood: act.mood, sleepy: act.sleepy,
    t: ((sd * 0.618) % 1), ft: ((sd * 0.377) % 1), seed: sd % 97, hour: act.M.bkk.min / 60,
    catColor: settings.catColor, chartUp: act.a === "watchUS" ? usUp : thUp, decor: settings._decor || [],
    catX: Math.round(((sd * 13) % Math.max(1, cw - 34))),
  });
  return dc.getImage();
}
function marketRow(parent, act, size = 8.5, compactLabels = false) {
  const r = parent.addStack(); r.layoutVertically();
  for (const [flag, name, st] of [["🇹🇭", "SET", act.M.th], ["🇺🇸", "US", act.M.us]]) {
    const l = r.addStack(); l.layoutHorizontally(); l.centerAlignContent();
    txt(l, "●", size, { color: st.open ? T.up : st.state === "pre" || st.state === "break" || st.state === "after" ? new Color("#E8A33A") : T.sub, w: "heavy" });
    l.addSpacer(3);
    txt(l, `${flag} ${name} ${compactLabels ? st.label.split(" · ")[0] : st.label}`, size, { color: T.text, w: "semi" });
  }
  return r;
}

// ---------- ธีม ----------
function makeTheme(mode) {
  const L = { bg: "#F4E9D2", panel: "#FFF8E8", ink: "#3B2418", text: "#3B2418", sub: "#8A6E57", up: "#23994A", down: "#D93A45", bubble: "#FFFFFF" };
  const D = { bg: "#1D1A2F", panel: "#2A2542", ink: "#0B0816", text: "#F3EAD7", sub: "#A79CC8", up: "#5BE38A", down: "#FF6B7A", bubble: "#352F55" };
  const pick = (k) => mode === "light" ? new Color(L[k]) : mode === "dark" ? new Color(D[k]) : Color.dynamic(new Color(L[k]), new Color(D[k]));
  const t = {};
  for (const k of Object.keys(L)) t[k] = pick(k);
  t.hex = mode === "light" ? L : D;
  // LCD (สีคงที่ทั้งสองธีม)
  t.lcd = new Color("#221E38"); t.lcdBorder = new Color("#0B0816");
  t.lcdLabel = new Color("#8E84C6");
  t.lcdHex = { digit: "#FFE38A", shadow: "#6B4E1A", up: "#6BF08F", down: "#FF7A85", upSh: "#1E5B33", downSh: "#6B1E28" };
  return t;
}
let T = makeTheme("auto");

// ---------- ส่วนประกอบ widget ----------
const shown5 = (S) => CAT_ORDER.filter((c) => S.cats[c].value > 0).length > 4;
// ตัวอักษรอ่านง่าย (SF Rounded) ส่วนความเป็นพิกเซลมาจากภาพแมว กรอบ และตัวเลข LCD
function F(size, w = "bold", mono = false) {
  const m = mono ? {
    regular: Font.regularMonospacedSystemFont, medium: Font.mediumMonospacedSystemFont,
    semi: Font.semiboldMonospacedSystemFont, bold: Font.boldMonospacedSystemFont, heavy: Font.heavyMonospacedSystemFont,
  } : {
    regular: Font.regularRoundedSystemFont, medium: Font.mediumRoundedSystemFont,
    semi: Font.semiboldRoundedSystemFont, bold: Font.boldRoundedSystemFont, heavy: Font.heavyRoundedSystemFont,
  };
  return (m[w] || m.bold).call(Font, size);
}
function txt(stack, s, size, opts = {}) {
  const t = stack.addText(String(s));
  t.font = F(size, opts.w || "semi", !!opts.mono);
  t.textColor = opts.color || T.text;
  t.lineLimit = opts.lines || 1;
  t.minimumScaleFactor = opts.scale ?? 0.55;
  if (opts.right) t.rightAlignText();
  if (opts.center) t.centerAlignText();
  return t;
}
function panel(parent, opts = {}) {
  const p = parent.addStack();
  p.layoutVertically();
  p.backgroundColor = opts.bg || T.panel;
  p.borderColor = opts.border || T.ink;
  p.borderWidth = opts.bw ?? 2;
  p.cornerRadius = opts.radius ?? 3;
  const [a, b, c, d] = opts.pad || [6, 8, 6, 8];
  p.setPadding(a, b, c, d);
  if (opts.size) p.size = opts.size;
  return p;
}
function pixDot(stack, hex, d = 7) {
  const s = stack.addStack(); s.size = new Size(d, d);
  s.backgroundColor = col(hex); s.borderColor = T.ink; s.borderWidth = 1;
}
function bubble(parent, text, size, lines = 2, width) {
  const b = panel(parent, { bg: T.bubble, pad: [4, 7, 4, 7], radius: 4 });
  if (width) b.size = new Size(width, 0);
  txt(b, text, size, { w: "semi", lines, scale: 0.6 });
  return b;
}
function lcd(parent, S, maxW, digitPt, showPL = true) {
  const p = panel(parent, { bg: T.lcd, border: T.lcdBorder, pad: [6, 8, 6, 8], radius: 2 });
  const top = p.addStack(); top.layoutHorizontally(); top.centerAlignContent();
  txt(top, "TOTAL", 8, { color: T.lcdLabel, w: "heavy", mono: true });
  top.addSpacer();
  txt(top, "THB", 8, { color: T.lcdLabel, w: "heavy", mono: true });
  p.addSpacer(3);
  const totalStr = S.total >= 1e8 ? "฿" + compact(S.total) : "฿" + fmt(S.total);
  addPixelText(p, totalStr, T.lcdHex.digit, maxW - 16, digitPt, T.lcdHex.shadow);
  if (showPL) {
    p.addSpacer(4);
    const up = S.pl >= 0;
    txt(p, `${signed(S.pl)}  (${pctStr(S.plPct)})`, Math.max(10, digitPt * 4.3), { color: new Color(up ? T.lcdHex.up : T.lcdHex.down), w: "bold" });
  }
  return p;
}
function refreshLine(parent, S, size = 8.5, withDate = false) {
  const r = parent.addStack(); r.layoutHorizontally(); r.centerAlignContent();
  txt(r, `⟳ ${withDate ? "รีเฟรชล่าสุด " + thDate(S.at) + " " : ""}${hm(S.at)} · `, size, { color: T.sub, w: "medium" });
  const d = r.addDate(S.at);
  d.applyRelativeStyle();
  d.font = F(size, "medium"); d.textColor = T.sub; d.lineLimit = 1;
  txt(r, " ที่แล้ว" + (S.stale ? " ⚠︎" : ""), size, { color: S.stale ? T.down : T.sub, w: "medium" });
  return r;
}
const plColor = (n) => (n >= 0 ? T.up : T.down);

function emptyWidget(w, settings) {
  w.setPadding(12, 12, 12, 12);
  const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
  const ci = row.addImage(catImage("normal", settings.catColor)); ci.imageSize = new Size(55, 53);
  row.addSpacer(8);
  bubble(row, "เพิ่มพอร์ตให้แมวดูแลหน่อย~ แตะเพื่อเปิด", 10, 3);
  return w;
}

function buildWidget(S, hist, family, settings) {
  T = makeTheme(settings.theme);
  const w = new ListWidget();
  w.backgroundColor = T.bg;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
  w.url = URLScheme.forRunningScript();
  const act = catActivity(S, settings);
  const mood = faceMood(act);
  const line = actLine(S, act);
  const cc = settings.catColor;
  try { w.url = URLScheme.forRunningScript() + "?open=room"; } catch (e) {}
  // รีเฟรชถี่ขึ้นช่วงตลาดเปิด (iOS เป็นผู้ตัดสินเวลาจริง)
  let ra = Date.now() + (act.M.th.open || act.M.us.open ? 10 : REFRESH_MIN) * 60 * 1000;
  if (settings.notify !== false) ra = Math.min(ra, nextBriefMs()); // ให้ทันส่งสรุปเช้า/เย็น
  w.refreshAfterDate = new Date(ra);

  if (family === "accessoryCircular") {
    try { w.addAccessoryWidgetBackground = true; } catch (e) {}
    w.setPadding(0, 0, 0, 0);
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const ir = s.addStack(); ir.layoutHorizontally(); ir.addSpacer();
    const ci = ir.addImage(lockRing(S, mood, cc, settings)); ci.imageSize = new Size(50, 50);
    ir.addSpacer();
    const tr = s.addStack(); tr.layoutHorizontally(); tr.addSpacer();
    const t = tr.addText(S ? (S.dayPct >= 0 ? "▲" : "▼") + Math.abs(S.dayPct).toFixed(1) + "%" : "–");
    t.font = Font.heavyRoundedSystemFont(10); t.minimumScaleFactor = 0.5; t.lineLimit = 1;
    tr.addSpacer();
    return w;
  }
  if (family === "accessoryRectangular") {
    try { w.addAccessoryWidgetBackground = true; } catch (e) {}
    w.setPadding(4, 8, 4, 8);
    const r = w.addStack(); r.layoutHorizontally(); r.centerAlignContent();
    const ci = r.addImage(catImage(mood, cc, 8, true)); ci.imageSize = new Size(34, 26);
    r.addSpacer(6);
    const c = r.addStack(); c.layoutVertically();
    if (!S) { const e = c.addText("เพิ่มพอร์ตให้แมวก่อนนะ"); e.font = Font.mediumRoundedSystemFont(11); return w; }
    const a1 = c.addText("฿" + fmt(S.total)); a1.font = Font.heavyRoundedSystemFont(16); a1.minimumScaleFactor = 0.55; a1.lineLimit = 1;
    const b1 = c.addText(`${S.dayPct >= 0 ? "▲" : "▼"} ${pctStr(S.dayPct)} วันนี้`); b1.font = Font.boldRoundedSystemFont(10.5); b1.minimumScaleFactor = 0.6; b1.lineLimit = 1;
    const d1 = c.addText(`รวม ${pctStr(S.plPct)} · ⟳${hm(S.at)}`); d1.font = Font.mediumRoundedSystemFont(9.5); d1.textOpacity = 0.75; d1.minimumScaleFactor = 0.6; d1.lineLimit = 1;
    w.addSpacer(3);
    const bar = w.addImage(lockBar(S, hist, settings)); bar.imageSize = new Size(150, 7); bar.resizable = true;
    return w;
  }
  if (family === "accessoryInline") {
    w.addText(S ? `🐱 ฿${compact(S.total)} ${S.dayPct >= 0 ? "▲" : "▼"}${Math.abs(S.dayPct).toFixed(2)}% · ${hm(S.at)}` : "🐱 เพิ่มพอร์ตก่อนนะ");
    return w;
  }
  if (!S || S.rows.length === 0) return emptyWidget(w, settings);

  // ----- SMALL -----
  if (family === "small") {
    w.setPadding(9, 9, 8, 9);
    const sc = panel(w, { pad: [0, 0, 0, 0], radius: 3, bg: T.panel });
    const si = sc.addImage(sceneImage(S, act, settings, 140, 58)); si.imageSize = new Size(140, 58);
    w.addSpacer(5);
    lcd(w, S, 142, 2.3);
    w.addSpacer();
    const mk = w.addStack(); mk.layoutHorizontally(); mk.centerAlignContent();
    for (const [flag, st] of [["🇹🇭", act.M.th], ["🇺🇸", act.M.us]]) {
      txt(mk, "●", 8, { color: st.open ? T.up : T.sub, w: "heavy" }); txt(mk, flag + (st.open ? "เปิด " : "ปิด "), 8, { w: "semi" });
    }
    mk.addSpacer();
    txt(mk, "⟳" + hm(S.at), 8, { color: T.sub, w: "medium" });
    return w;
  }

  // ----- MEDIUM -----
  if (family === "medium") {
    w.setPadding(10, 10, 9, 11);
    const row = w.addStack(); row.layoutHorizontally();
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(152, 0);
    const sc = panel(left, { pad: [0, 0, 0, 0], radius: 3 });
    const si = sc.addImage(sceneImage(S, act, settings, 148, 104)); si.imageSize = new Size(148, 104);
    left.addSpacer(4);
    txt(left, "🐾 " + line, 9, { w: "semi", lines: 2, scale: 0.6 });
    row.addSpacer(9);
    const right = row.addStack(); right.layoutVertically();
    lcd(right, S, 172, 2.3);
    right.addSpacer(5);
    marketRow(right, act, 8.5, true);
    right.addSpacer(5);
    const bar = right.addImage(catBar(S, 14, 344, 18)); bar.imageSize = new Size(172, 9);
    right.addSpacer(3);
    const shown = CAT_ORDER.filter((c) => S.cats[c].value > 0);
    for (let i = 0; i < shown.length; i += 2) {
      const lr = right.addStack(); lr.layoutHorizontally(); lr.centerAlignContent();
      shown.slice(i, i + 2).forEach((c) => {
        const cell = lr.addStack(); cell.layoutHorizontally(); cell.centerAlignContent(); cell.size = new Size(86, 11);
        pixDot(cell, CATS[c].color, 6); cell.addSpacer(3);
        txt(cell, `${CATS[c].short} ${S.cats[c].share.toFixed(0)}%`, 8.5, { w: "semi" });
        cell.addSpacer();
      });
    }
    right.addSpacer();
    refreshLine(right, S, 8);
    return w;
  }

  // ----- LARGE / EXTRA LARGE -----
  w.setPadding(11, 12, 9, 12);
  const sc = panel(w, { pad: [0, 0, 0, 0], radius: 3 });
  const si = sc.addImage(sceneImage(S, act, settings, 334, 90)); si.imageSize = new Size(334, 90);
  w.addSpacer(5);
  const nm = w.addStack(); nm.layoutHorizontally(); nm.centerAlignContent();
  txt(nm, "♥ " + settings.catName + (settings._lv ? ` · Lv.${settings._lv}` : ""), 11, { w: "heavy" });
  nm.addSpacer(6);
  txt(nm, line, 10, { w: "semi", color: T.sub, scale: 0.6 });
  nm.addSpacer();
  w.addSpacer(4);
  const mid = w.addStack(); mid.layoutHorizontally(); mid.centerAlignContent();
  const leftCol = mid.addStack(); leftCol.layoutVertically();
  lcd(leftCol, S, 200, 2.8);
  leftCol.addSpacer(5);
  marketRow(leftCol, act, 9);
  mid.addSpacer();
  const dn = mid.addImage(pixelDonut(S)); dn.imageSize = new Size(104, 104);
  w.addSpacer(6);

  const tb = panel(w, { pad: [4, 8, 4, 8] });
  const shownL = CAT_ORDER.filter((c) => S.cats[c].value > 0);
  for (let i = 0; i < shownL.length; i += 2) {
    const r = tb.addStack(); r.layoutHorizontally(); r.centerAlignContent();
    shownL.slice(i, i + 2).forEach((c, j) => {
      const x = S.cats[c];
      const cell = r.addStack(); cell.layoutHorizontally(); cell.centerAlignContent(); cell.size = new Size(150, 14);
      pixDot(cell, CATS[c].color, 7); cell.addSpacer(4);
      txt(cell, `${CATS[c].name} ${x.share.toFixed(0)}%`, 10, { w: "bold" });
      cell.addSpacer();
      txt(cell, pctStr(x.plPct), 10, { color: plColor(x.pl), w: "heavy" });
      if (j === 0) r.addSpacer(8);
    });
    tb.addSpacer(1);
  }
  w.addSpacer(5);

  if (settings.goal > 0) {
    const g = w.addStack(); g.layoutHorizontally(); g.centerAlignContent();
    const prog = Math.max(0, Math.min(1, S.total / settings.goal));
    txt(g, "EXP", 9, { w: "heavy", color: T.sub, mono: true });
    g.addSpacer(5);
    const eb = g.addImage(blockBar([{ count: Math.round(prog * 20), color: "#FFD84A" }], 20, 380, 20)); eb.imageSize = new Size(190, 9);
    g.addSpacer(5);
    txt(g, `${(prog * 100).toFixed(0)}% ของ ${compact(settings.goal)}`, 8.5, { color: T.sub, w: "semi" });
    w.addSpacer(4);
  }
  const hh = w.addStack(); hh.layoutHorizontally();
  const n30 = Math.min(30, hist.length);
  txt(hh, n30 >= 2 ? `มูลค่าพอร์ต ${n30} วัน` : "กราฟประวัติ (เริ่มแสดงวันที่ 2)", 8.5, { color: T.sub, w: "semi" });
  hh.addSpacer();
  if (S.best) txt(hh, `▲${S.best.type === "gold" ? "ทอง" : S.best.symbol} ${pctStr(S.best.dayPct)}`, 8.5, { color: T.up, w: "bold" });
  if (S.best && S.worst) hh.addSpacer(6);
  if (S.worst) txt(hh, `▼${S.worst.type === "gold" ? "ทอง" : S.worst.symbol} ${pctStr(S.worst.dayPct)}`, 8.5, { color: T.down, w: "bold" });
  w.addSpacer(2);
  const hb = w.addImage(historyBars(hist, 668, 48, T.hex.up, T.hex.down)); hb.imageSize = new Size(334, 24); hb.resizable = true;
  w.addSpacer();
  refreshLine(w, S, 8.5, true);
  return w;
}

// ---------- แอนิเมชันห้องแมว (ใช้ในแอป: ขยับได้จริง) ----------
function animPayload(S, act, settings) {
  const pool = PLAY[act.mood] || PLAY.normal;
  const base = act.a;
  let seq;
  if (base === "watchTH" || base === "watchUS") seq = [[base, 14], ["stretch", 4], [base, 12], ["groom", 5], ["walk", 12], [base, 10]];
  else if (base === "sleep") seq = [["sleep", 24], ["stretch", 4], ["sleep", 20], ["loaf", 6]];
  else if (base === "eat") seq = [["eat", 10], ["groom", 6], ["loaf", 6], ["walk", 10]];
  else if (base === "ready") seq = [["ready", 8], ["stretch", 5], ["walk", 10], ["ready", 8]];
  else seq = [[base, 12]].concat([...new Set(pool.concat(["walk", "watchFly", "groom", "loaf", "butterfly", "yarn"]))].filter((x) => x !== base).map((x) => [x, x === "zoomies" ? 6 : 10]));
  const lines = {};
  for (const [a] of seq.concat([["zoomies"], ["butterfly"]])) lines[a] = actLine(S, Object.assign({}, act, { a }));
  const dot = (st) => (st.open ? "#3CCB6B" : st.state === "pre" || st.state === "break" || st.state === "after" ? "#E8A33A" : "#8A8A8A");
  return {
    seq, lines, mood: act.mood, sleepy: act.sleepy, cat: settings.catColor, hour: act.M.bkk.min / 60, seed: act.seed % 97, decor: settings._decor || [],
    thUp: S ? S.cats.thai.day >= 0 : true, usUp: S ? S.cats.us.day + S.cats.fund.day >= 0 : true,
    mk: [{ n: "🇹🇭 SET", l: act.M.th.label, c: dot(act.M.th) }, { n: "🇺🇸 US", l: act.M.us.label, c: dot(act.M.us) }],
  };
}
function animJS() {
  return `const ENGINE=(${makeCatEngine.toString()})(D.spr);
function startScene(cv,cw,ch,A,onLine){
  const px=3,ctx=cv.getContext('2d');cv.width=cw*px;cv.height=ch*px;ctx.imageSmoothingEnabled=false;
  const P=(x,y,w,h,c,a)=>{if(w<=0||h<=0)return;ctx.globalAlpha=a==null?1:a;ctx.fillStyle=c;ctx.fillRect(Math.round(x*px),Math.round(y*px),w*px,h*px);ctx.globalAlpha=1};
  const PER={walk:16,yarn:12,butterfly:10,zoomies:5};const FT={walk:.9,run:.45,yarn:.9,butterfly:.45,zoomies:.4,pounce:1.6,eat:1.2,sleep:4,loaf:4,groom:2,stretch:3,watchFly:3};
  let idx=0,t0=performance.now(),tap=null,lastLine='';
  cv.addEventListener('click',()=>{tap={a:Math.random()<.5?'zoomies':'butterfly',until:performance.now()+6000,t0:performance.now()}});
  function frame(){
    const now=performance.now();let a,el;
    if(tap&&now<tap.until){a=tap.a;el=(now-tap.t0)/1000}else{tap=null;let cur=A.seq[idx];el=(now-t0)/1000;if(el>cur[1]){idx=(idx+1)%A.seq.length;t0=now;el=0}a=A.seq[idx][0]}
    const per=PER[a]||4,t=(el%per)/per,ft=((now/1000)%(FT[a]||2))/(FT[a]||2);
    ctx.clearRect(0,0,cv.width,cv.height);
    ENGINE.renderScene(P,{decor:A.decor||[],clock:now/1000,w:cw,h:ch,activity:a,mood:tap?'happy':A.mood,sleepy:A.sleepy,t,ft,seed:A.seed,hour:A.hour,catColor:A.cat,chartUp:a==='watchUS'?A.usUp:A.thUp,catX:Math.round((cw-34)*.35)});
    const ln=tap?'เมี้ยว! เล่นด้วยกัน~':(A.lines[a]||'');if(ln!==lastLine&&onLine){lastLine=ln;onLine(ln)}
  }
  frame();setInterval(frame,90);
}`;
}
function roomHTML(S, hist, settings) {
  const act = catActivity(S, settings);
  const D = { spr: SPR, name: settings.catName, anim: animPayload(S, act, settings), total: S ? S.total : 0, pl: S ? S.pl : 0, plPct: S ? S.plPct : 0, day: S ? S.dayPct : 0, theme: settings.theme };
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#F4E9D2;--card:#FFF8E8;--ink:#3B2418;--text:#3B2418;--sub:#8A6E57}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1D1A2F;--card:#2A2542;--ink:#0B0816;--text:#F3EAD7;--sub:#A79CC8}}
:root[data-theme=dark]{--bg:#1D1A2F;--card:#2A2542;--ink:#0B0816;--text:#F3EAD7;--sub:#A79CC8}
body{margin:0;padding:14px;background:var(--bg);color:var(--text);font:15px 'IBM Plex Sans Thai',-apple-system,sans-serif}
.card{background:var(--card);border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);padding:12px;margin-bottom:14px}
canvas{display:block;width:100%;image-rendering:pixelated;border:3px solid var(--ink)}
h1{font:700 18px 'Pixelify Sans','IBM Plex Sans Thai',sans-serif;margin:0 0 10px}
.say{background:var(--card);border:3px solid var(--ink);padding:10px 12px;margin-top:10px;font-weight:600;min-height:22px}
.mk{display:flex;flex-direction:column;gap:6px;font-size:14px}.dot{display:inline-block;width:10px;height:10px;border:2px solid var(--ink);margin-right:6px}
.sub{color:var(--sub);font-size:12.5px;margin-top:8px}.big{font:700 24px 'Pixelify Sans',monospace}
</style></head><body>
<div class="card"><h1>■ ห้องของ <span id="nm"></span></h1><canvas id="room"></canvas><div class="say" id="say"></div><div class="sub">แตะที่ห้องเพื่อเล่นกับแมว 🐾</div></div>
<div class="card"><div class="big" id="tot"></div><div id="pl" style="margin:4px 0 10px;font-weight:600"></div><div class="mk" id="mk"></div></div>
<script>
const D=${JSON.stringify(D)};
if(D.theme!=='auto')document.documentElement.dataset.theme=D.theme;
const $=id=>document.getElementById(id);
${animJS()}
$('nm').textContent=D.name;
$('tot').textContent='฿'+Math.round(D.total).toLocaleString('en-US');
$('pl').textContent=(D.pl>=0?'+':'')+Math.round(D.pl).toLocaleString('en-US')+' ('+(D.plPct>=0?'+':'')+D.plPct.toFixed(2)+'%) · วันนี้ '+(D.day>=0?'+':'')+D.day.toFixed(2)+'%';
$('mk').innerHTML=D.anim.mk.map(m=>'<div><span class="dot" style="background:'+m.c+'"></span><b>'+m.n+'</b> '+m.l+'</div>').join('');
startScene($('room'),150,104,D.anim,(t)=>{$('say').textContent=t});
</script></body></html>`;
}

// ---------- หน้าดูพอร์ตในแอป (สไตล์พิกเซล) ----------
function reportHTML(S, hist, settings) {
  const act = catActivity(S, settings);
  const mood = faceMood(act);
  const usV = S.cats.us.value, fdV = S.cats.fund.value, usShare = usV + fdV > 0 ? usV / (usV + fdV) : 0;
  hist = hist.map((h) => {
    const c = Object.assign({}, h.cats || {});
    if (c.foreign != null && c.us == null && c.fund == null) { c.us = Math.round(c.foreign * usShare); c.fund = c.foreign - c.us; }
    return Object.assign({}, h, { cats: c });
  });
  const fundInfo = settings.fundInfo || {};
  const payload = {
    spr: SPR, mood, line: actLine(S, act), cat: settings.catColor, anim: animPayload(S, act, settings), name: settings.catName, age: catAgeDays(hist),
    goal: settings.goal, theme: settings.theme,
    cats: CAT_ORDER.map((c) => ({ id: c, name: CATS[c].name, color: CATS[c].color, ...S.cats[c] })),
    rows: S.rows.map((r) => ({
      cat: r.cat, color: CATS[r.cat].color, type: r.type, sym: r.type === "gold" ? "ทองคำแท่ง 96.5%" : r.symbol,
      unit: TYPES[r.type].unit, qty: r.qty, avg: r.avg, price: r.price, native: r.native, value: r.value, cost: r.cost,
      pl: r.pl, plPct: r.plPct, day: r.day, dayPct: r.dayPct, date: r.firstDate, noCost: r.noCost, bk: !!r.fromBitkub, missing: r.missingPrice,
      region: r.type === "fund" ? (fundInfo[r.symbol] ? REGION[fundInfo[r.symbol].region] || "" : guessRegion(r.symbol) ? REGION.foreign + "?" : "") : "",
    })),
    hist, total: S.total, cost: S.cost, pl: S.pl, plPct: S.plPct, day: S.day, dayPct: S.dayPct,
    fx: S.usdthb, at: thDate(S.at) + " " + hm(S.at), stale: S.stale, errors: S.errors,
  };
  const ANIM_JS = animJS();
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
:root{--bg:#F4E9D2;--card:#FFF8E8;--ink:#3B2418;--text:#3B2418;--sub:#8A6E57;--up:#23994A;--down:#D93A45;--bubble:#fff;--grid:rgba(59,36,24,.12)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1D1A2F;--card:#2A2542;--ink:#0B0816;--text:#F3EAD7;--sub:#A79CC8;--up:#5BE38A;--down:#FF6B7A;--bubble:#352F55;--grid:rgba(255,255,255,.08)}}
:root[data-theme=dark]{--bg:#1D1A2F;--card:#2A2542;--ink:#0B0816;--text:#F3EAD7;--sub:#A79CC8;--up:#5BE38A;--down:#FF6B7A;--bubble:#352F55;--grid:rgba(255,255,255,.08)}
*{box-sizing:border-box}
body{margin:0;padding:16px 16px 48px;background:var(--bg);color:var(--text);font:15px 'IBM Plex Sans Thai',-apple-system,sans-serif;font-variant-numeric:tabular-nums;
background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:8px 8px}
.card{background:var(--card);border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);padding:14px;margin-bottom:16px}
h2{font:700 16px 'Pixelify Sans','IBM Plex Sans Thai',sans-serif;margin:0 0 12px;letter-spacing:.5px}
.hero{display:flex;gap:12px;align-items:flex-end}
.scene{display:block;width:100%;image-rendering:pixelated;border:3px solid var(--ink);margin-bottom:10px;touch-action:manipulation}
.mk{display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px;margin-top:8px}.mk b{font-weight:600}.dot{display:inline-block;width:9px;height:9px;border:2px solid var(--ink);margin-right:5px;vertical-align:-1px}
.say{position:relative;background:var(--bubble);border:3px solid var(--ink);padding:10px 12px;font-size:15px;line-height:1.35;margin-bottom:6px}
.say:after{content:"▼";position:absolute;right:8px;bottom:-2px;font-size:9px;color:var(--sub)}
.say:before{content:"";position:absolute;left:-11px;bottom:12px;border:8px solid transparent;border-right-color:var(--ink)}
.name{font-weight:700;font-size:14px}.sub{color:var(--sub);font-size:12px}
.lcd{background:#221E38;border:3px solid #0B0816;padding:12px;color:#FFE38A;margin-top:12px}
.lcd .lab{font:700 11px 'Pixelify Sans',monospace;color:#8E84C6;display:flex;justify-content:space-between}
.lcd .big{font:700 34px 'Pixelify Sans',monospace;text-shadow:3px 3px 0 #6B4E1A;margin:4px 0 2px;letter-spacing:1px}
.lcd .pl{font:600 16px 'IBM Plex Sans Thai',sans-serif;font-variant-numeric:tabular-nums}
.up{color:var(--up)}.down{color:var(--down)}.lcd .up{color:#6BF08F}.lcd .down{color:#FF7A85}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.k{border:2px solid var(--ink);padding:8px;background:var(--bg)}.k b{display:block;font-size:16px;margin-top:2px}
.dn{display:flex;gap:14px;align-items:center}
.dn canvas{image-rendering:pixelated;width:150px;height:150px;flex:none}
.leg{flex:1}.li{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:2px dashed var(--grid);font-size:14px}
.li:last-child{border:0}
.sq{width:11px;height:11px;border:2px solid var(--ink);display:inline-block;margin-right:6px;vertical-align:-1px}
.bar{display:flex;gap:3px;margin:12px 0 4px}.bar i{flex:1;height:14px;border:2px solid var(--ink)}
.row{padding:10px 0;border-top:2px dashed var(--grid)}.row:first-child{border-top:0}
.r1{display:flex;justify-content:space-between;font-weight:700}.r2{display:flex;justify-content:space-between;font-size:13px;color:var(--sub);margin-top:3px;gap:8px}
.tag{font-size:11px;font-weight:500;padding:0 5px;border:2px solid var(--ink);margin-left:6px;color:var(--sub);white-space:nowrap}
.exp{display:flex;gap:3px;margin-top:8px}.exp i{flex:1;height:14px;border:2px solid var(--ink);background:transparent}.exp i.on{background:#FFD84A}
canvas.ch{width:100%!important}
</style></head><body>
<div class="card">
 <canvas class="scene" id="scene"></canvas>
 <div><div class="name" id="nm"></div><div class="sub" id="age"></div><div class="say" id="say"></div><div class="mk" id="mk"></div></div>
 <div class="lcd"><div class="lab"><span>TOTAL · THB</span><span id="at"></span></div><div class="big" id="total"></div><div class="pl" id="pl"></div></div>
 <div class="grid"><div class="k"><span class="sub">ต้นทุนรวม</span><b id="cost"></b></div><div class="k"><span class="sub">วันนี้</span><b id="day"></b></div></div>
 <div id="goal"></div>
 <div class="sub" id="note" style="margin-top:10px"></div>
</div>
<div class="card"><h2>■ สัดส่วนพอร์ต</h2><div class="dn"><canvas id="donut" width="156" height="156"></canvas><div class="leg" id="legend"></div></div><div class="bar" id="bar"></div></div>
<div class="card"><h2>■ ต้นทุน vs มูลค่า</h2><canvas class="ch" id="bars" height="230"></canvas></div>
<div class="card"><h2>■ มูลค่าพอร์ตย้อนหลัง</h2><canvas class="ch" id="line" height="230"></canvas><div class="sub" id="histNote"></div></div>
<div class="card"><h2>■ ช่องเก็บของ (สินทรัพย์)</h2><div id="rows"></div></div>
<script>
const D=${JSON.stringify(payload)};
if(D.theme!=='auto')document.documentElement.dataset.theme=D.theme;
const $=id=>document.getElementById(id);
const f=(n,d=0)=>isFinite(n)?Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'-';
const s=(n,d=0)=>(n>0?'+':'')+f(n,d);const p=n=>isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'-';
const cl=n=>n>=0?'up':'down';const fp=x=>{const a=Math.abs(x);return f(x,a>=1000?0:a>=1?2:a>=.01?4:8)};
function shade(h,k){const n=parseInt(h.slice(1),16);return '#'+[n>>16&255,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k))).toString(16).padStart(2,'0')).join('')}
${ANIM_JS}
startScene($('scene'),150,100,D.anim,(t)=>{$('say').textContent=t});
$('mk').innerHTML=D.anim.mk.map(m=>'<span><span class="dot" style="background:'+m.c+'"></span><b>'+m.n+'</b> '+m.l+'</span>').join('');$('nm').textContent='♥ '+D.name;$('age').textContent='เลี้ยงมา '+D.age+' วัน';$('say').textContent=D.line;
$('at').textContent='⟳ '+D.at;$('total').textContent='฿'+f(D.total);
$('pl').innerHTML='<span class="'+cl(D.pl)+'">'+s(D.pl)+' ('+p(D.plPct)+')</span>';
$('cost').textContent='฿'+f(D.cost);$('day').innerHTML='<span class="'+cl(D.day)+'">'+s(D.day)+' ('+p(D.dayPct)+')</span>';
if(D.goal>0){const pr=Math.max(0,Math.min(1,D.total/D.goal)),on=Math.round(pr*20);
$('goal').innerHTML='<div class="sub" style="margin-top:12px">EXP เป้าหมาย ฿'+f(D.goal)+' · '+(pr*100).toFixed(1)+'%</div><div class="exp">'+Array.from({length:20},(_,i)=>'<i class="'+(i<on?'on':'')+'"></i>').join('')+'</div>'}
$('note').textContent=(isFinite(D.fx)?'USD/THB '+D.fx.toFixed(2)+' · ':'')+'ทองคิดที่ราคารับซื้อฮั่วเซ่งเฮง'+(D.stale?' · ⚠︎ บางรายการใช้ราคาเก่า':'')+(D.errors.length?' · ดึงไม่ได้: '+D.errors.join(', '):'');
const C=D.cats.filter(c=>c.value>0);
// โดนัทพิกเซล
(function(){const N=26,px=6,cx=$('donut').getContext('2d'),tot=C.reduce((a,c)=>a+c.value,0)||1;let acc=0;const b=C.map(c=>({end:(acc+=c.value/tot),color:c.color}));
const R=N/2-.4,r=N/2-8.2;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=x+.5-N/2,dy=y+.5-N/2,d=Math.hypot(dx,dy);if(d>R||d<r)continue;let col;
if(d>R-1.15||d<r+1.15)col='#2B1A12';else{const a=((Math.atan2(dx,-dy)+Math.PI*2)%(Math.PI*2))/(Math.PI*2);col=(b.find(q=>a<=q.end)||b[b.length-1]).color;if(d>R-2.2)col=shade(col,.25);else if(d<r+2.2)col=shade(col,-.22)}
cx.fillStyle=col;cx.fillRect(x*px,y*px,px,px)}})();
$('legend').innerHTML=C.map(c=>'<div class="li"><span><span class="sq" style="background:'+c.color+'"></span>'+c.name+'<br><span class="sub">'+c.share.toFixed(1)+'%</span></span><span style="text-align:right">฿'+f(c.value)+'<br><span class="'+cl(c.pl)+'" style="font-size:12px">'+p(c.plPct)+'</span></span></div>').join('');
(function(){const n=24,tot=C.reduce((a,c)=>a+c.value,0),raw=C.map(c=>c.value/tot*n),o=raw.map(Math.floor);let l=n-o.reduce((a,b)=>a+b,0);raw.map((x,i)=>[x-Math.floor(x),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(l>0){o[i]++;l--}});
$('bar').innerHTML=C.map((c,i)=>Array.from({length:o[i]},()=>'<i style="background:'+c.color+';box-shadow:inset 0 -4px 0 '+shade(c.color,-.3)+'"></i>').join('')).join('')})();
$('rows').innerHTML=D.rows.map(r=>'<div class="row"><div class="r1"><span><span class="sq" style="background:'+r.color+'"></span>'+r.sym+(r.bk?'<span class="tag">Bitkub</span>':'')+(r.region?'<span class="tag">'+r.region+'</span>':'')+(r.missing?'<span class="tag">ไม่มีราคา</span>':'')+'</span><span>฿'+f(r.value)+'</span></div>'+
'<div class="r2"><span>'+f(r.qty,r.type==='crypto'?8:4).replace(/(\\.\\d*?)0+$/,'$1').replace(/\\.$/,'')+' '+r.unit+' · เฉลี่ย ฿'+fp(r.avg)+' · ล่าสุด ฿'+fp(r.price)+(r.type==='us'&&isFinite(r.native)?' ($'+fp(r.native)+')':'')+'</span>'+
'<span class="'+cl(r.pl)+'" style="white-space:nowrap">'+(r.noCost?'ไม่มีต้นทุน':s(r.pl)+' ('+p(r.plPct)+')')+'</span></div>'+
'<div class="r2"><span>'+(r.date?'ซื้อครั้งแรก '+r.date:'')+'</span><span class="'+cl(r.day)+'">วันนี้ '+p(r.dayPct)+'</span></div></div>').join('');
if(!window.Chart){document.querySelectorAll('canvas.ch').forEach(c=>c.closest('.card').remove())}else{
const css=getComputedStyle(document.documentElement),sub=css.getPropertyValue('--sub').trim(),grid=css.getPropertyValue('--grid').trim(),ink=css.getPropertyValue('--ink').trim();
Chart.defaults.color=sub;Chart.defaults.borderColor=grid;Chart.defaults.font.family="'IBM Plex Sans Thai',sans-serif";Chart.defaults.font.size=12;
const kfmt=v=>v>=1e6?(v/1e6)+'M':v>=1e3?(v/1e3)+'K':v;
new Chart($('bars'),{type:'bar',data:{labels:C.map(c=>c.name),datasets:[{label:'ต้นทุน',data:C.map(c=>c.cost),backgroundColor:'rgba(138,110,87,.35)',borderColor:ink,borderWidth:2,borderRadius:0},{label:'มูลค่า',data:C.map(c=>c.value),backgroundColor:C.map(c=>c.color),borderColor:ink,borderWidth:2,borderRadius:0}]},
options:{plugins:{legend:{position:'bottom',labels:{boxWidth:12,useBorderRadius:false}}},scales:{y:{ticks:{callback:kfmt}},x:{grid:{display:false}}}}});
if(D.hist.length>=2){new Chart($('line'),{type:'line',data:{labels:D.hist.map(h=>h.d.slice(5)),datasets:[
...C.map(c=>({label:c.name,data:D.hist.map(h=>(h.cats||{})[c.id]||0),backgroundColor:c.color+'AA',borderColor:c.color,fill:true,stack:'s',pointRadius:0,borderWidth:2,stepped:true})),
{label:'ต้นทุน',data:D.hist.map(h=>h.c),borderColor:sub,borderDash:[6,4],pointRadius:0,borderWidth:2,fill:false,stack:'c',stepped:true}]},
options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:12}}},scales:{y:{stacked:true,ticks:{callback:kfmt}}}}})}
else{$('line').remove();$('histNote').textContent='แมวจะจดมูลค่าพอร์ตวันละ 1 ครั้งทุกครั้งที่ widget รีเฟรช กราฟจะเริ่มแสดงเมื่อมีข้อมูลตั้งแต่ 2 วันขึ้นไป'}}
</script></body></html>`;
}

// @shared-begin
// ---------- นำเข้าจากรูปด้วย AI ----------
const AI_PROMPT = `คุณคือผู้ช่วยอ่านภาพหน้าจอพอร์ตการลงทุน (เช่น แอป Dime, Bitkub, แอปหุ้น, แอปทอง)
อ่าน "ทุกรูป" ที่แนบมา แล้วสรุปสินทรัพย์ที่ถืออยู่ทุกตัว
ตอบกลับเป็น JSON อย่างเดียว ในโค้ดบล็อกเดียว ห้ามมีคำอธิบายอื่น รูปแบบนี้:

{"portfolio_import":2,"items":[
 {"type":"thai","symbol":"PTT","qty":500,"avg":32.75,"value":null,"cost":null,"pl":null,"plPct":null,"currency":"THB","date":null,"nav":null,"region":null},
 {"type":"us","symbol":"PLTR","qty":null,"avg":null,"value":329.00,"cost":null,"pl":58.35,"plPct":21.56,"currency":"USD","date":null,"nav":null,"region":null},
 {"type":"fund","symbol":"KKP US500-UH-E","qty":10263.9308,"avg":11.69,"value":null,"cost":null,"pl":null,"plPct":null,"currency":"THB","date":null,"nav":13.94,"region":"foreign"}
]}

กติกา:
- type (จัดหมวดตาม "สิ่งที่ถือจริง" อย่างเคร่งครัด):
  "thai" = หุ้นสามัญที่จดทะเบียนใน SET/mai เท่านั้น
  "us" = หุ้นหรือ ETF ที่ซื้อตรงในตลาดต่างประเทศ ราคาเป็น USD (เช่น แท็บ "หุ้นสหรัฐฯ" ใน Dime: VOO, AAPL, PLTR)
  "fund" = กองทุนรวมที่จดทะเบียนในไทยทุกกอง (ซื้อเป็น "หน่วย" มี NAV เป็นบาท) รวมถึงกองที่ไปลงทุนหุ้นต่างประเทศ/Feeder Fund/กองดัชนี S&P500 เช่น KKP US500-UH-E, K-USA-A(A) → ห้ามใส่เป็น "us"
  "crypto" = คริปโต | "gold" = ทองคำ
- symbol: ticker ตามที่แสดงในแอป ตรวจทีละตัวอักษร ระวังตัวที่หน้าตาคล้ายกัน (Q/G/O/0, I/l/1, S/5, B/8) ticker ต้องเป็นสัญลักษณ์จริงที่ซื้อขายในตลาด
  หุ้นไทยไม่ต้องมี .BK / คริปโตใช้ชื่อเหรียญ เช่น BTC / กองทุนใช้ชื่อเต็มตรงตามแอป รวมเว้นวรรคและคลาส เช่น KKP US500-UH-E / ทองใช้ "HSH"
- qty: จำนวนที่ถือ (หุ้น / หน่วย / เหรียญ) ทองเป็น "บาททอง" (ถ้าภาพเป็นกรัม ให้หารด้วย 15.244)
- avg: ต้นทุนเฉลี่ยต่อ 1 หุ้น/หน่วย/เหรียญ/บาททอง
- value: มูลค่าปัจจุบันรวมของสินทรัพย์ตัวนั้น (มูลค่าสินทรัพย์ / Market value)
- cost: ต้นทุนรวมของตัวนั้น (ถ้าภาพแสดง)
- pl: กำไร/ขาดทุนเป็นจำนวนเงิน ขาดทุนใส่ติดลบ เช่น -68.35
- plPct: กำไร/ขาดทุนเป็น % ขาดทุนใส่ติดลบ เช่น -5.44 (ห้ามใช้ % สัดส่วนพอร์ต เช่น 61.75% ที่เป็นสัดส่วนของพอร์ต)
- สำคัญ: หน้ารวมสินทรัพย์ของ Dime มักไม่แสดง qty และ avg ให้ใส่ null สองช่องนี้ แล้วใส่ value + pl + plPct ตามที่เห็นแทน ระบบจะคำนวณจำนวนและต้นทุนเฉลี่ยให้เอง ห้ามคำนวณหรือเดา qty/avg เอง
- currency: สกุลเงินของตัวเลข avg/value/cost/pl คือ "USD" หรือ "THB" (หุ้นสหรัฐฯ ใช้ตัวเลข USD ไม่ใช่ตัวที่แปลงเป็นบาท)
- date: วันที่ซื้อแบบ YYYY-MM-DD ถ้าไม่เห็นในภาพให้ใส่ null
- nav: เฉพาะกองทุน ใส่ NAV ล่าสุดต่อหน่วยที่เห็นในภาพ ถ้าไม่มีให้ใส่ null
- region: เฉพาะกองทุน "foreign" ถ้าลงทุนต่างประเทศ (Feeder/FIF/ชื่อมี US, GLOBAL, CHINA, S&P, NASDAQ ฯลฯ) "thai" ถ้าลงทุนหุ้นไทย "mixed" ถ้าผสม ไม่แน่ใจใส่ null
- ตัวเดียวกันที่ปรากฏหลายรูปให้รวมเป็นรายการเดียว
- ตัวเลขต้องเป็น number ไม่มีคอมมา อ่านให้ตรงภาพทุกหลัก อ่านไม่ออกให้ใส่ null
- ไม่ต้องใส่เงินสดหรือยอดรวมทั้งพอร์ต`;

const TYPE_ALIAS = {
  thai: "thai", th: "thai", set: "thai", mai: "thai", thai_stock: "thai", stock_th: "thai", "หุ้นไทย": "thai",
  us: "us", usa: "us", us_stock: "us", stock_us: "us", etf: "us", foreign_stock: "us", "หุ้นต่างประเทศ": "us",
  fund: "fund", mutual_fund: "fund", mf: "fund", "กองทุน": "fund",
  crypto: "crypto", coin: "crypto", "คริปโต": "crypto",
  gold: "gold", "ทอง": "gold", "ทองคำ": "gold",
};
function parseAI(text) {
  let t = String(text || "").replace(/```(?:json)?/gi, "").trim();
  let j = null;
  try { j = JSON.parse(t); } catch (e) {
    const a = t.indexOf("{"), b = t.lastIndexOf("}"), c = t.indexOf("["), d = t.lastIndexOf("]");
    for (const [x, y] of [[a, b], [c, d]]) {
      if (j || x < 0 || y <= x) continue;
      try { j = JSON.parse(t.slice(x, y + 1)); } catch (e2) {}
    }
  }
  if (!j) throw new Error("อ่าน JSON ไม่ได้");
  const items = Array.isArray(j) ? j : j.items || j.holdings || j.assets;
  if (!Array.isArray(items) || !items.length) throw new Error("ไม่พบรายการสินทรัพย์");
  return items.map((it) => {
    const type = TYPE_ALIAS[String(it.type || "").toLowerCase().trim()] || null;
    let sym = String(it.symbol || it.name || "").toUpperCase().trim().replace(/\.BK$/, "");
    if (type === "crypto") sym = sym.replace(/[_/-]?THB$/, "");
    if (type === "gold") sym = "HSH";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(it.date || "")) ? it.date : null;
    let fixedType = type;
    const cur = String(it.currency || "").toUpperCase();
    // เข้มงวด: "หุ้นต่างประเทศ" ที่ต้นทุนเป็นบาท หรือชื่อแบบกองทุนไทย / มี NAV → เป็นกองทุนรวม
    if (type === "us" && (looksLikeThaiFund(sym) || (cur === "THB" && isFinite(num(it.nav))))) fixedType = "fund";
    const region = ["foreign", "thai", "mixed"].includes(it.region) ? it.region : null;
    const out = { type: fixedType, symbol: sym, qty: num(it.qty), avg: num(it.avg), currency: cur, date, nav: num(it.nav), region, moved: fixedType !== type,
      value: num(it.value ?? it.market_value), cost: num(it.cost ?? it.total_cost), pl: num(it.pl ?? it.profit), plPct: num(it.plPct ?? it.pl_pct ?? it.profit_pct) };
    out.ok = !!type && !!sym && out.qty > 0 && out.avg >= 0;
    out.needPrice = !out.ok && !(out.qty > 0) && isFinite(out.value) && !(isFinite(out.avg) && out.avg > 0 && isFinite(aiCost(out)));
    return out;
  });
}
// ต้นทุนรวมจาก cost หรือ มูลค่า − กำไร หรือ มูลค่า ÷ (1 + %กำไร)
function aiCost(x) {
  if (isFinite(x.cost)) return x.cost;
  if (isFinite(x.value) && isFinite(x.pl)) return x.value - x.pl;
  if (isFinite(x.value) && isFinite(x.plPct) && x.plPct > -100) return x.value / (1 + x.plPct / 100);
  return NaN;
}
// หุ้นต่างประเทศที่ AI ให้ตัวเลขเป็นบาท → แปลงเป็น USD
function aiToUSD(x, fx) {
  if (x.type !== "us" || x.currency !== "THB") return x;
  if (!(fx > 0)) { x.ok = false; return x; }
  for (const k of ["avg", "value", "cost", "pl"]) if (isFinite(x[k])) x[k] /= fx;
  x.fx = fx; x.currency = "USD";
  return x;
}
// เติม qty / avg ที่ภาพไม่ได้แสดง (เช่นหน้ารวมของ Dime) จาก มูลค่า + กำไร + ราคาปัจจุบัน
function completeAI(x, price) {
  const cost = aiCost(x);
  const dp = x.type === "thai" ? 0 : x.type === "fund" ? 4 : x.type === "crypto" ? 8 : 6;
  const r = (v) => Math.round(v * 10 ** dp) / 10 ** dp;
  if (!(x.qty > 0)) {
    if (x.avg > 0 && isFinite(cost)) { x.qty = r(cost / x.avg); x.derived = true; }
    else if (isFinite(x.value) && price > 0) { x.qty = r(x.value / price); x.derived = true; }
  }
  if (!(x.avg >= 0) && x.qty > 0 && isFinite(cost)) { x.avg = cost / x.qty; x.derived = true; }
  x.ok = !!x.type && !!x.symbol && x.qty > 0 && x.avg >= 0;
  if (x.ok) x.needPrice = false;
  return x;
}
// @shared-end
async function aiImportFlow(data) {
  const i = await ask("📸 นำเข้าจากรูปด้วย AI",
    "1) คัดลอก Prompt\n2) เปิด ChatGPT / Claude / Gemini วาง Prompt + แนบรูปแคปพอร์ตกี่รูปก็ได้\n3) คัดลอกคำตอบของ AI แล้วกลับมากดข้อ 2",
    ["1) คัดลอก Prompt สำหรับ AI", "2) วางผลลัพธ์จาก AI แล้วเพิ่มเข้าพอร์ต"]);
  if (i === 0) {
    Pasteboard.copy(AI_PROMPT);
    return info("คัดลอก Prompt แล้ว", "ไปวางในแอป AI พร้อมแนบรูปหน้าพอร์ต (Dime, Bitkub, ทอง ฯลฯ) จากนั้นคัดลอกคำตอบแล้วกลับมาเลือกข้อ 2");
  }
  if (i !== 1) return;
  let items;
  try { items = parseAI(Pasteboard.paste()); }
  catch (e) { return info("อ่านผลลัพธ์ไม่ได้", `${e.message}\nให้คัดลอกคำตอบของ AI ทั้งก้อน (ส่วนที่เป็น JSON) แล้วลองใหม่`); }

  // หุ้นต่างประเทศที่ AI ให้ตัวเลขเป็นบาท → แปลงเป็น USD ด้วยเรทปัจจุบัน
  if (items.some((x) => x.type === "us" && x.currency === "THB")) {
    let fx = NaN;
    try { fx = (await yahoo("THB=X")).price; } catch (e) {}
    for (const x of items) aiToUSD(x, fx);
  }
  // ไม่มีจำนวน/ต้นทุนเฉลี่ยในภาพ → ดึงราคาปัจจุบันมาคำนวณจากมูลค่า + กำไร
  let bk = null, gold = null;
  const priceOf = async (x) => {
    try {
      if (x.type === "us" || x.type === "thai") {
        try { return (await yahoo(x.type === "thai" ? x.symbol + ".BK" : x.symbol)).price; }
        catch (e) { const r = new Request(cnbcURL([cnbcSym(x.type, x.symbol)])); const q = parseCNBC(await r.loadJSON())[cnbcSym(x.type, x.symbol)]; if (q) return q.price; throw e; }
      }
      if (x.type === "crypto") { bk ||= await bitkubTicker(); return bk[x.symbol] ? bk[x.symbol].price : NaN; }
      if (x.type === "gold") { gold ||= await hshGold(); return gold.price; }
      if (x.type === "fund") return isFinite(x.nav) ? x.nav : data.navs[x.symbol] ? data.navs[x.symbol].nav : NaN;
    } catch (e) {}
    return NaN;
  };
  for (const x of items) {
    if (x.ok || !x.needPrice) { if (!x.ok) completeAI(x, NaN); continue; }
    let price = await priceOf(x);
    // หาราคาไม่เจอ (มักเพราะ AI อ่านชื่อผิด เช่น QQGI แทน QQQI) → ให้แก้ชื่อแล้วลองใหม่
    for (let tries = 0; !(price > 0) && x.type !== "fund" && tries < 2; tries++) {
      const a = new Alert(); a.title = `หาราคา "${x.symbol}" ไม่เจอ`;
      a.message = `AI อาจอ่านชื่อผิด (มูลค่าในภาพ ${fmtPrice(x.value)} ${x.currency || ""})\nพิมพ์ชื่อหุ้นที่ถูกต้อง`;
      a.addTextField("ชื่อหุ้น", x.symbol); a.addAction("ลองใหม่"); a.addCancelAction("ข้าม");
      if ((await a.presentAlert()) === -1) break;
      x.symbol = a.textFieldValue(0).toUpperCase().trim().replace(/\.BK$/, "");
      price = await priceOf(x);
    }
    if (!(price > 0)) x.priceErr = true;
    completeAI(x, price);
  }
  const good = items.filter((x) => x.ok), bad = items.filter((x) => !x.ok);
  const lineOf = (x) => `${x.ok ? "•" : "⚠︎"} ${x.type ? CATS[TYPES[x.type].cat].name : "?"}${x.moved ? "(แก้หมวดให้)" : ""}${x.region ? "·" + REGION[x.region] : ""} ${x.symbol || "?"} · ${isFinite(x.qty) ? fmt(x.qty, 6).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : "?"} @ ${isFinite(x.avg) ? fmtPrice(x.avg) + (x.type === "us" ? " USD" : "") : "?"}${x.derived ? " (คำนวณจากมูลค่า)" : ""}${x.priceErr ? " (หาราคาไม่เจอ ตรวจชื่อหุ้น)" : ""}`;
  const preview = items.map(lineOf).join("\n") + (bad.length ? `\n\n⚠︎ ${bad.length} รายการข้อมูลไม่ครบ จะให้แก้ทีละรายการ` : "");
  const m = await ask(`พบ ${items.length} รายการ`, preview, [
    "อัปเดตทับตัวเดิม (แนะนำ: รูปคือยอดถือปัจจุบัน)",
    "เพิ่มเป็นรายการซื้อใหม่ (เก็บของเดิมไว้)",
  ]);
  if (m < 0) return;
  const replace = m === 0;
  const r = await ask("ตรวจก่อนบันทึกไหม?", null, ["บันทึกทั้งหมดเลย", "ตรวจ/แก้ทีละรายการ"]);
  if (r < 0) return;
  if (data.sample) { data.holdings = []; data.navs = {}; delete data.sample; }

  let added = 0, skipped = 0;
  for (const x of items) {
    let h = null;
    if (x.type) {
      const existing = data.holdings.filter((e) => e.type === x.type && e.symbol === x.symbol);
      const date = x.date || existing.map((e) => e.date).sort()[0] || ymd();
      h = { id: uid(), type: x.type, symbol: x.symbol, qty: x.qty, avg: x.avg, date };
      if (x.fx) h.fx = x.fx;
    }
    if (!x.ok || r === 1) {
      if (!x.type) {
        const k = await ask(`"${x.symbol || "?"}" เป็นสินทรัพย์ประเภทไหน`, null, TYPE_ORDER.map((t) => TYPES[t].label), "ข้าม");
        if (k < 0) { skipped++; continue; }
        h = { id: uid(), type: TYPE_ORDER[k], symbol: x.symbol, qty: x.qty, avg: x.avg, date: x.date || ymd() };
      }
      const pre = Object.assign({}, h, { qty: isFinite(h.qty) ? h.qty : "", avg: isFinite(h.avg) ? h.avg : "" });
      h = await holdingForm(h.type, pre);
      if (!h) { skipped++; continue; }
    }
    if (replace) data.holdings = data.holdings.filter((e) => !(e.type === h.type && e.symbol === h.symbol));
    data.holdings.push(h);
    if (h.type === "fund" && x.region) { data.settings.fundInfo = data.settings.fundInfo || {}; data.settings.fundInfo[h.symbol] = { region: x.region }; }
    if (h.type === "fund" && isFinite(x.nav) && x.nav > 0) {
      const cur = data.navs[h.symbol];
      data.navs[h.symbol] = { nav: x.nav, date: ymd(), prev: cur ? cur.nav : x.nav };
    }
    added++;
  }
  writeJSON(F_DATA, data);
  const needNav = [...new Set(data.holdings.filter((h) => h.type === "fund" && !data.navs[h.symbol]).map((h) => h.symbol))];
  await info("นำเข้าเสร็จแล้ว 🐱", `เพิ่ม ${added} รายการ${skipped ? ` · ข้าม ${skipped}` : ""}` + (needNav.length ? `\nกองทุนที่ยังไม่มี NAV: ${needNav.join(", ")} (อัปเดตได้ที่เมนู 📝)` : ""));
}

// ---------- เมนูในแอป ----------
async function ask(title, message, actions, cancel = "ยกเลิก") {
  const a = new Alert(); a.title = title; if (message) a.message = message;
  actions.forEach((x) => a.addAction(x));
  a.addCancelAction(cancel);
  return await a.presentSheet();
}
async function info(title, message) {
  const a = new Alert(); a.title = title; a.message = message || ""; a.addAction("ตกลง"); await a.presentAlert();
}

async function holdingForm(type, h) {
  const Ty = TYPES[type];
  const a = new Alert();
  a.title = (h ? "แก้ไข: " : "เพิ่ม: ") + Ty.label;
  a.message = type === "gold" ? "จำนวนเป็น \"บาททอง\" (เช่น 0.5 = 2 สลึง) ราคาเฉลี่ยต่อ 1 บาททอง"
    : type === "us" ? "ราคาเฉลี่ยเป็น USD ต่อหุ้น (ตามที่แสดงใน Dime)"
    : type === "fund" ? "ราคาเฉลี่ยเป็นบาทต่อหน่วย (ดูจาก Dime)"
    : "ราคาเฉลี่ยเป็นบาทต่อ " + Ty.unit;
  const fields = [];
  if (type !== "gold") fields.push(["symbol", a.addTextField("สัญลักษณ์ " + Ty.ph, h ? h.symbol : "")]);
  const q = a.addTextField("จำนวน (" + Ty.unit + ")", h ? String(h.qty) : ""); q.setDecimalPadKeyboard(); fields.push(["qty", q]);
  const av = a.addTextField(type === "us" ? "ราคาเฉลี่ย (USD)" : "ราคาเฉลี่ย (บาท)", h ? String(h.avg) : ""); av.setDecimalPadKeyboard(); fields.push(["avg", av]);
  fields.push(["date", a.addTextField("วันที่ซื้อ (ปปปป-ดด-วว ค.ศ.)", h ? h.date : ymd())]);
  if (type === "us") { const fx = a.addTextField("เรท USD/THB ตอนซื้อ (เว้นว่าง = ใช้เรทปัจจุบัน)", h && h.fx ? String(h.fx) : ""); fx.setDecimalPadKeyboard(); fields.push(["fx", fx]); }
  a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
  if ((await a.presentAlert()) === -1) return null;
  const v = {}; fields.forEach(([k], i) => (v[k] = a.textFieldValue(i).trim()));
  let sym = type === "gold" ? "HSH" : v.symbol.toUpperCase().replace(/\.BK$/, "");
  if (type === "crypto") sym = sym.replace(/_?THB$/, "");
  const out = { id: h ? h.id : uid(), type, symbol: sym, qty: num(v.qty), avg: num(v.avg), date: v.date || ymd() };
  if (type === "us" && isFinite(num(v.fx))) out.fx = num(v.fx);
  if (!sym || !(out.qty > 0) || !(out.avg >= 0)) { await info("ข้อมูลไม่ครบ", "กรุณากรอกสัญลักษณ์ จำนวน และราคาเฉลี่ยเป็นตัวเลข"); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) { await info("รูปแบบวันที่ไม่ถูกต้อง", "ใช้รูปแบบ 2026-10-18 (ปี ค.ศ.)"); return null; }
  return out;
}

async function regionFlow(data, sym) {
  const keys = ["foreign", "thai", "mixed"];
  const j = await ask(`"${sym}" ลงทุนที่ไหน?`, "ยังนับอยู่ในหมวด \"กองทุนรวม\" เหมือนเดิม แค่ใส่ป้ายบอกให้รู้", keys.map((k) => REGION[k]), "ข้าม");
  if (j < 0) return;
  data.settings.fundInfo = data.settings.fundInfo || {};
  data.settings.fundInfo[sym] = { region: keys[j] };
  writeJSON(F_DATA, data);
}
async function checkType(type, sym) {
  // กันใส่ผิดหมวด: กองทุนไทยที่ไปใส่เป็นหุ้นต่างประเทศ
  if (type === "us" && looksLikeThaiFund(sym)) {
    const k = await ask(`"${sym}" ดูเหมือนกองทุนรวมไทย`, "กองทุนที่ซื้อผ่าน Dime/บลจ. แม้จะลงทุนหุ้นต่างประเทศ ให้นับเป็น \"กองทุนรวม\" (ราคาเป็นบาท/NAV) ไม่ใช่หุ้นต่างประเทศ", ["เปลี่ยนเป็นกองทุนรวม (แนะนำ)", "ยืนยันว่าเป็นหุ้นต่างประเทศ"]);
    if (k === 0) return "fund";
  }
  return type;
}

async function addFlow(data) {
  const i = await ask("เพิ่มรายการซื้อ", "ซื้อหลายครั้งให้เพิ่มทีละรายการ ระบบจะรวมเป็นราคาเฉลี่ยให้เอง", TYPE_ORDER.map((t) => TYPES[t].label));
  if (i < 0) return;
  let type = TYPE_ORDER[i];
  let h = await holdingForm(type);
  if (!h) return;
  const fixed = await checkType(type, h.symbol);
  if (fixed !== type) { type = fixed; h = await holdingForm(type, Object.assign({}, h, { type, fx: undefined })); if (!h) return; }
  data.holdings.push(h);
  writeJSON(F_DATA, data);
  if (type === "fund" && !((data.settings.fundInfo || {})[h.symbol])) await regionFlow(data, h.symbol);
  if (type === "fund" && !data.navs[h.symbol]) await navFlow(data, h.symbol);
  if (type === "thai" || type === "us" || type === "crypto") {
    try {
      const P = await fetchPrices({ holdings: [h], navs: {} });
      if (!P.prices[key(type, h.symbol)]) await info("หาราคาไม่เจอ", `ไม่พบราคา "${h.symbol}" ลองตรวจสัญลักษณ์อีกครั้ง (หุ้นไทยไม่ต้องใส่ .BK, คริปโตใส่แค่ BTC)`);
    } catch (e) {}
  }
}

async function editFlow(data) {
  if (!data.holdings.length) return info("ยังไม่มีรายการ");
  const list = data.holdings.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const i = await ask("เลือกรายการ", null, list.map((h) => `${h.type === "gold" ? "ทอง" : h.symbol} · ${fmt(h.qty, 4).replace(/\.?0+$/, "")} ${TYPES[h.type].unit} @ ${fmtPrice(h.avg)} · ${h.date}`));
  if (i < 0) return;
  const h = list[i];
  const acts = ["แก้ไข", "ลบรายการนี้", "ย้ายหมวด (เปลี่ยนประเภทสินทรัพย์)"];
  if (h.type === "fund") acts.push("ตั้งป้ายเขตการลงทุน");
  const j = await ask(h.symbol, `หมวดปัจจุบัน: ${CATS[TYPES[h.type].cat].name}`, acts);
  if (j === 2) {
    const k = await ask("ย้ายไปหมวดไหน", "ทุกล็อตของ " + h.symbol + " จะย้ายไปด้วย", TYPE_ORDER.map((t) => (t === h.type ? "✓ " : "") + TYPES[t].label));
    if (k < 0 || TYPE_ORDER[k] === h.type) return;
    const nt = TYPE_ORDER[k];
    for (const x of data.holdings) if (x.type === h.type && x.symbol === h.symbol) {
      x.type = nt;
      if (nt !== "us") delete x.fx;
      if (nt === "gold") x.symbol = "HSH";
    }
    writeJSON(F_DATA, data);
    if (nt === "fund") { await regionFlow(data, h.symbol); if (!data.navs[h.symbol]) await navFlow(data, h.symbol); }
    if (h.type === "us" && nt !== "us") await info("ตรวจราคาเฉลี่ยด้วยนะ", "หุ้นต่างประเทศเก็บราคาเฉลี่ยเป็น USD ถ้าย้ายเป็นกองทุน/หุ้นไทย ให้แก้ราคาเฉลี่ยเป็นบาทต่อหน่วย");
    return;
  }
  if (j === 3) return regionFlow(data, h.symbol);
  if (j === 0) {
    const n = await holdingForm(h.type, h);
    if (n) { data.holdings[data.holdings.findIndex((x) => x.id === h.id)] = n; writeJSON(F_DATA, data); }
  } else if (j === 1) {
    const a = new Alert(); a.title = "ลบรายการ?"; a.message = `${h.symbol} ${h.qty} ${TYPES[h.type].unit} (${h.date})`;
    a.addDestructiveAction("ลบ"); a.addCancelAction("ยกเลิก");
    if ((await a.presentAlert()) === 0) { data.holdings = data.holdings.filter((x) => x.id !== h.id); writeJSON(F_DATA, data); }
  }
}

async function navFlow(data, only) {
  const funds = only ? [only] : [...new Set(data.holdings.filter((h) => h.type === "fund").map((h) => h.symbol))];
  if (!funds.length) return info("ยังไม่มีกองทุน", "เพิ่มกองทุนก่อนจากเมนู \"เพิ่มรายการซื้อ\"");
  let sym = funds[0];
  if (funds.length > 1) {
    const i = await ask("อัปเดต NAV", "เลือกกองทุน", funds.map((f) => `${f} · NAV ${data.navs[f] ? data.navs[f].nav + " (" + data.navs[f].date + ")" : "-"}`));
    if (i < 0) return;
    sym = funds[i];
  }
  const cur = data.navs[sym];
  const a = new Alert(); a.title = "NAV ล่าสุด: " + sym; a.message = "ดูได้จากแอป Dime หรือเว็บ บลจ.";
  const t = a.addTextField("NAV ต่อหน่วย (บาท)", cur ? String(cur.nav) : ""); t.setDecimalPadKeyboard();
  a.addTextField("วันที่ NAV", ymd());
  a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
  if ((await a.presentAlert()) === -1) return;
  const nav = num(a.textFieldValue(0));
  if (!(nav > 0)) return info("NAV ไม่ถูกต้อง");
  data.navs[sym] = { nav, date: a.textFieldValue(1) || ymd(), prev: cur ? cur.nav : nav };
  writeJSON(F_DATA, data);
}

async function bitkubFlow() {
  const has = Keychain.contains("pw_bk_key");
  const i = await ask("Bitkub API", has
    ? "ตั้งค่าไว้แล้ว — จำนวนเหรียญจะดึงจากบัญชี Bitkub (ต้นทุนยังใช้ราคาเฉลี่ยที่คุณกรอก)"
    : "ไม่จำเป็นต้องใส่ — ถ้าไม่ใส่ จะใช้จำนวนเหรียญที่คุณกรอกเอง\nถ้าใส่ ให้สร้าง API key แบบอ่านอย่างเดียว (ไม่เปิดสิทธิ์เทรด/ถอน)",
    has ? ["เปลี่ยน key", "ลบ key", "ทดสอบการเชื่อมต่อ"] : ["ใส่ API key"]);
  if (i < 0) return;
  if (has && i === 1) { Keychain.remove("pw_bk_key"); Keychain.remove("pw_bk_secret"); return info("ลบแล้ว"); }
  if (has && i === 2) {
    try { const b = await bitkubBalances(); return info("เชื่อมต่อสำเร็จ", Object.entries(b).map(([k, v]) => `${k}: ${v}`).join("\n") || "ไม่มีเหรียญในบัญชี"); }
    catch (e) { return info("เชื่อมต่อไม่สำเร็จ", String(e.message || e)); }
  }
  const a = new Alert(); a.title = "Bitkub API key"; a.message = "เก็บใน Keychain ของเครื่องเท่านั้น";
  a.addTextField("API Key"); a.addSecureTextField("API Secret");
  a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
  if ((await a.presentAlert()) === -1) return;
  const k = a.textFieldValue(0).trim(), s = a.textFieldValue(1).trim();
  if (!k || !s) return;
  Keychain.set("pw_bk_key", k); Keychain.set("pw_bk_secret", s);
  try { await bitkubBalances(); await info("เชื่อมต่อสำเร็จ"); }
  catch (e) { await info("บันทึกแล้ว แต่เชื่อมต่อไม่สำเร็จ", String(e.message || e)); }
}

// รูปตัวอย่างแมว: หน้าตรง + ตัวจริงแบบ isometric (ใช้ในหน้าเลือกแมว)
function catPreviewImage(breed, px = 4) {
  const front = catGrid("happy", breed), iso = CAT_ENGINE.catSprite("walk", 0.25, breed, 0, 0.9, { eyes: "open" });
  const pal = Object.assign({}, SPR.fixed, SPR.palettes[breed] || SPR.palettes.orange);
  const fw = front[0].length, iw = iso.x1 - iso.x0 + 1, ih = iso.y1 - iso.y0 + 1, h = Math.max(front.length, ih);
  const dc = newCtx((fw + iw + 3) * px, h * px);
  front.forEach((row, y) => row.forEach((c, x) => {
    if (c === "." || !pal[c]) return;
    dc.setFillColor(col(pal[c])); dc.fillRect(new Rect(x * px, (h - front.length + y) * px, px, px));
  }));
  for (const [x, y, c] of iso.pix) { dc.setFillColor(col(c)); dc.fillRect(new Rect((fw + 3 + x - iso.x0) * px, (h - ih + y - iso.y0) * px, px, px)); }
  return dc.getImage();
}
async function pickCat(current) {
  const t = new UITable(); t.showSeparators = true;
  let chosen = null;
  const hdr = new UITableRow(); hdr.isHeader = true; hdr.height = 56;
  hdr.addText("🐱 เลือกแมว", "แตะตัวที่ชอบ · ✓ = ตัวที่ใช้อยู่"); t.addRow(hdr);
  for (const k of Object.keys(CAT_COLORS)) {
    const r = new UITableRow(); r.height = 104; r.dismissOnSelect = true;
    const im = r.addImage(catPreviewImage(k)); im.widthWeight = 58;
    const tx = r.addText((k === current ? "✓ " : "") + CAT_COLORS[k], k === current ? "ตัวที่ใช้อยู่" : ""); tx.widthWeight = 42;
    tx.titleFont = Font.boldRoundedSystemFont(15);
    r.onSelect = () => { chosen = k; };
    t.addRow(r);
  }
  await t.present(false);
  return chosen;
}
async function catFlow(data) {
  const st = data.settings;
  const i = await ask("🐱 ตั้งค่าแมว", `ชื่อ: ${st.catName} · สี: ${CAT_COLORS[st.catColor]}`, ["ตั้งชื่อแมว", "เลือกพันธุ์ / สีแมว (มีรูปตัวอย่าง)", "ธีม widget"]);
  if (i === 0) {
    const a = new Alert(); a.title = "ชื่อแมว"; a.addTextField("ชื่อ", st.catName);
    a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
    if ((await a.presentAlert()) === 0 && a.textFieldValue(0).trim()) st.catName = a.textFieldValue(0).trim().slice(0, 12);
  } else if (i === 1) {
    const k = await pickCat(st.catColor);
    if (k) st.catColor = k;
  } else if (i === 2) {
    const modes = [["auto", "อัตโนมัติ (ตามโหมดมืด/สว่าง)"], ["light", "กระดาษครีม (สว่าง)"], ["dark", "ราตรีม่วง (มืด)"]];
    const j = await ask("ธีม widget", null, modes.map(([k, n]) => (k === st.theme ? "✓ " : "") + n));
    if (j >= 0) st.theme = modes[j][0];
  } else return;
  writeJSON(F_DATA, data);
}

// ค่าตั้งค่า + ข้อมูลเกมชั่วคราว (ไม่บันทึกลงไฟล์) สำหรับ widget/แจ้งเตือน
function gameSettings(data) {
  const g = data.game || {}, t = bkkParts(Date.now()), ym = t.ymd.slice(0, 7);
  const daysLeft = new Date(Date.UTC(t.y, t.mo, 0)).getUTCDate() - t.d;
  const todo = !data.sample && (data.holdings || []).length && !(g.dcaDone || {})[ym] && t.d >= 20 ? daysLeft : 0;
  return Object.assign({}, data.settings, { _decor: g.decor || [], _lv: g.xp ? lvInfo(g.xp).lv : 0, _dcaTodo: todo });
}
async function gameAlert(evs, data) {
  const L = lvInfo(gameOf(data).xp);
  const lines = evs.map((e) => (e.kind === "levelup" ? `✨ ${e.text}` : e.kind === "decor" ? `🎁 ${e.text}` : `+${e.xp} EXP · ${e.text}`));
  const lvUp = evs.some((e) => e.kind === "levelup");
  if (!lvUp && evs.every((e) => e.kind === "checkin" || e.kind === "green")) return; // เช็กอินธรรมดาไม่ต้องเด้ง
  await info(lvUp ? `✨ LEVEL UP! Lv.${L.lv}` : "🏆 เควสสำเร็จ!", lines.join("\n"));
}
async function questFlow(data, S) {
  while (true) {
    const g = gameOf(data), L = lvInfo(g.xp), q = questList(data, S);
    const bar = "▰".repeat(Math.round(L.pct * 10)) + "▱".repeat(10 - Math.round(L.pct * 10));
    const msg = `Lv.${L.lv}  ${bar}  ${L.into}/${L.need} EXP\n🔥 เช็กพอร์ตติดกัน ${g.streak} วัน · DCA ติดกัน ${g.dcaStreak} เดือน\n\n` +
      q.map((x) => `${x.done ? "✅" : x.icon} ${x.title} (+${x.xp})\n   ${x.desc}`).join("\n") +
      `\n\nของแต่งห้อง: ${Object.entries(DECOR).map(([k, d]) => (g.decor.includes(k) ? "✨" : "🔒") + d.name).join(" · ")}`;
    const i = await ask("📜 เลเวล & เควส", msg, [`💰 ตั้งยอด DCA ต่อเดือน (${num(data.settings.dcaAmount) > 0 ? "฿" + fmt(data.settings.dcaAmount) : "ยังไม่ตั้ง"})`], "ปิด");
    if (i < 0) return;
    const a = new Alert(); a.title = "💰 ยอด DCA ต่อเดือน"; a.message = "เควสนับยอดซื้อที่ลงวันที่ในเดือนนั้น (0 = แค่มีรายการซื้อ 1 รายการ)";
    const t = a.addTextField("บาท", data.settings.dcaAmount ? String(data.settings.dcaAmount) : ""); t.setDecimalPadKeyboard();
    a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
    if ((await a.presentAlert()) === 0) { const v = num(a.textFieldValue(0)); data.settings.dcaAmount = v > 0 ? v : 0; writeJSON(F_DATA, data); }
  }
}

async function alertFlow(data, S) {
  data.alerts ||= [];
  while (true) {
    const L = data.alerts;
    const mv = num(data.settings.moveAlert) || 0;
    const held = (x) => !S || S.rows.some((r) => r.type === x.type && r.symbol === x.symbol);
    const opts = L.map((x) => `${x.on ? "🟢" : "⚪️"} ${alertLabel(x)}${!held(x) ? " · ไม่ได้ถือแล้ว" : x.on ? "" : x.firedAt ? " · แจ้งแล้ว" : " · ปิด"}`);
    opts.push("➕ ตั้งแจ้งเตือนราคาใหม่", `📊 พอร์ตขยับแรงในวันเดียว (${mv > 0 ? "±" + mv + "%" : "ปิด"})`);
    const i = await ask("⏰ แจ้งเตือนราคา", "แจ้งครั้งเดียวเมื่อราคาแตะเป้า (แล้วปิดเอง แตะรายการเพื่อเปิดใหม่/ลบ)\nหุ้นนอกใช้ราคา USD · อย่างอื่นเป็นบาท · ไม่ใช้ AI", opts, "เสร็จ");
    if (i < 0) return;
    if (i === L.length + 1) {
      const a = new Alert(); a.title = "📊 พอร์ตขยับแรง"; a.message = "แจ้งเมื่อพอร์ตทั้งก้อนขึ้นหรือลงเกินกี่ % ในวันเดียว (0 = ปิด)";
      const t = a.addTextField("เช่น 2", mv ? String(mv) : ""); t.setDecimalPadKeyboard();
      a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
      if ((await a.presentAlert()) === 0) { const v = num(a.textFieldValue(0)); data.settings.moveAlert = v > 0 ? v : 0; writeJSON(F_DATA, data); }
    } else if (i === L.length) {
      if (!S || !S.rows.length) { await info("ยังไม่มีพอร์ต", "เพิ่มรายการก่อน แล้วค่อยตั้งแจ้งเตือน"); continue; }
      const rows = S.rows.filter((r) => isFinite(alertPrice(r)));
      const j = await ask("เลือกตัวที่จะตั้งเตือน", null, rows.map((r) => `${r.symbol} · ตอนนี้ ${alertUnit(r.type)}${fmtPrice(alertPrice(r))}`));
      if (j < 0) continue;
      const r = rows[j], cur = alertPrice(r);
      const a = new Alert(); a.title = `${r.symbol} ตอนนี้ ${alertUnit(r.type)}${fmtPrice(cur)}`;
      a.message = "ใส่ราคาเป้าหมาย\nสูงกว่าตอนนี้ = แจ้งเมื่อขึ้นถึง · ต่ำกว่า = แจ้งเมื่อลงถึง";
      const t = a.addTextField(`ราคา (${alertUnit(r.type)})`, ""); t.setDecimalPadKeyboard();
      a.addAction("ตั้งแจ้งเตือน"); a.addCancelAction("ยกเลิก");
      const k = await a.presentAlert();
      const v = num(a.textFieldValue(0));
      if (k < 0 || !(v > 0)) continue;
      const nw = { id: uid(), type: r.type, symbol: r.symbol, op: v < cur ? "<=" : ">=", price: v, on: true };
      L.push(nw);
      writeJSON(F_DATA, data);
      await info("ตั้งแล้ว ⏰", `แจ้งเมื่อ ${alertLabel(nw)}`);
    } else {
      const x = L[i];
      const k = await ask(alertLabel(x), x.firedAt ? `แจ้งไปแล้วเมื่อ ${thDate(new Date(x.firedAt))} ${hm(new Date(x.firedAt))}` : null, [x.on ? "ปิด" : "เปิดใหม่", "🗑 ลบ"]);
      if (k === 0) { x.on = !x.on; if (x.on) delete x.firedAt; }
      if (k === 1) L.splice(i, 1);
      if (k >= 0) writeJSON(F_DATA, data);
    }
  }
}

async function goalFlow(data) {
  const a = new Alert(); a.title = "🎯 เป้าหมายพอร์ต";
  a.message = "แมวจะแสดงแถบ EXP ใน widget ใหญ่ ใส่ 0 เพื่อปิด";
  const t = a.addTextField("มูลค่าเป้าหมาย (บาท)", data.settings.goal ? String(data.settings.goal) : ""); t.setDecimalPadKeyboard();
  a.addAction("บันทึก"); a.addCancelAction("ยกเลิก");
  if ((await a.presentAlert()) === -1) return;
  const g = num(a.textFieldValue(0));
  data.settings.goal = g > 0 ? g : 0;
  writeJSON(F_DATA, data);
}

async function backupFlow(data) {
  const i = await ask("💾 สำรอง / กู้คืน", "ข้อมูลพอร์ตเก็บอยู่ที่ iCloud Drive/Scriptable/PortfolioWidget อยู่แล้ว เมนูนี้ไว้สำรองเพิ่มหรือย้ายเครื่อง",
    ["คัดลอกข้อมูลไปคลิปบอร์ด", "กู้คืนจากคลิปบอร์ด"]);
  if (i === 0) {
    const hist = await readJSON(F_HIST, []);
    Pasteboard.copy(JSON.stringify({ v: 2, data, hist }));
    await info("คัดลอกแล้ว", "วางเก็บไว้ในโน้ตได้เลย");
  } else if (i === 1) {
    try {
      const j = JSON.parse(Pasteboard.paste() || "");
      const d = j.data || j;
      if (!Array.isArray(d.holdings)) throw new Error("ไม่พบรายการพอร์ต");
      const a = new Alert(); a.title = "กู้คืนข้อมูล?"; a.message = `${d.holdings.length} รายการ — ข้อมูลปัจจุบันจะถูกแทนที่`;
      a.addDestructiveAction("กู้คืน"); a.addCancelAction("ยกเลิก");
      if ((await a.presentAlert()) !== 0) return;
      writeJSON(F_DATA, d);
      if (Array.isArray(j.hist)) writeJSON(F_HIST, j.hist);
      await info("กู้คืนสำเร็จ");
    } catch (e) { await info("กู้คืนไม่สำเร็จ", "ในคลิปบอร์ดไม่ใช่ข้อมูลสำรองของพอร์ต"); }
  }
}

function sampleData(settings) {
  return {
    holdings: [
      { id: uid(), type: "us", symbol: "VOO", qty: 2, avg: 480, fx: 34.5, date: "2026-01-10" },
      { id: uid(), type: "fund", symbol: "K-USA-A(A)", qty: 3000, avg: 14.8, date: "2026-02-03" },
      { id: uid(), type: "thai", symbol: "PTT", qty: 500, avg: 32.75, date: "2026-03-15" },
      { id: uid(), type: "thai", symbol: "CPALL", qty: 200, avg: 55.5, date: "2026-04-20" },
      { id: uid(), type: "crypto", symbol: "BTC", qty: 0.015, avg: 2400000, date: "2026-05-02" },
      { id: uid(), type: "crypto", symbol: "ETH", qty: 0.3, avg: 85000, date: "2026-06-11" },
      { id: uid(), type: "gold", symbol: "HSH", qty: 1, avg: 61500, date: "2026-07-01" },
    ],
    navs: { "K-USA-A(A)": { nav: 15.9, date: ymd(), prev: 15.9 } },
    settings, sample: true,
  };
}

async function loadAll() {
  const data = await readJSON(F_DATA, { holdings: [], navs: {} });
  data.holdings ||= [];
  data.navs ||= {};
  data.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  if (!data.holdings.length && !Keychain.contains("pw_bk_key")) return { data, S: null, hist: [] };
  const P = await fetchPrices(data);
  const S = compute(data, P);
  const hist = data.sample ? [] : await saveHistory(S);
  return { data, S, hist };
}

async function appMenu() {
  while (true) {
    const { data, S, hist } = await loadAll();
    // เกม: เช็กอินรายวัน / เควส / เลเวล (นับเฉพาะตอนเปิดแอป ไม่นับ widget)
    const gev = gameTick(data, S, Date.now(), true);
    if (gev.length) { writeJSON(F_DATA, data); await gameAlert(gev, data); }
    const st = data.settings, gst = gameSettings(data); // st = ตัวจริง (แก้แล้วบันทึก), gst = สำเนา + ข้อมูลเกมไว้แสดงผล
    const act = catActivity(S, st);
    if (!data.sample) { await maybeBrief(S, gst); await maybeAlerts(data, S); }
    const note = await updateNotice();
    const msg = (note ? note + "\n\n" : "") + (S ? `฿${fmt(S.total)}  ${signed(S.pl)} (${pctStr(S.plPct)})\n` : "") + `🐱 ${st.catName}: "${actLine(S, act)}"\n🇹🇭 SET ${act.M.th.label}\n🇺🇸 US ${act.M.us.label}`;
    const opts = ["🐾 ห้องแมว (แมวขยับได้)", "📊 ดูพอร์ตและกราฟ", "📸 นำเข้าจากรูปด้วย AI (หลายรายการ)", "➕ เพิ่มรายการซื้อ", "✏️ แก้ไข / ลบรายการ", "📝 อัปเดต NAV กองทุน",
      `📜 เลเวล & เควส (Lv.${lvInfo(gameOf(data).xp).lv})`, "🐱 ตั้งค่าแมว / ธีม", "🎯 ตั้งเป้าหมายพอร์ต", `🔔 แจ้งเตือนสรุปพอร์ต (${st.notify === false ? "ปิด" : "เปิด"})`, `⏰ แจ้งเตือนราคา (${(data.alerts || []).filter((x) => x.on).length})`, "👁 พรีวิว Widget", "🔑 Bitkub API (ไม่บังคับ)", "💾 สำรอง / กู้คืนข้อมูล", `🔄 อัปเดต (v${VERSION})`, "📤 แชร์ให้เพื่อน"];
    if (!data.holdings.length) opts.push("🧪 ใส่ข้อมูลตัวอย่างเพื่อทดลอง");
    if (data.sample) opts.push("🧹 ล้างข้อมูลตัวอย่าง");
    const i = await ask(`PIXEL CAT PORTFOLIO v${VERSION}`, msg, opts, "ปิด");
    if (i < 0) return;
    const pick = opts[i];
    if (pick.startsWith("🐾")) await WebView.loadHTML(roomHTML(S, hist, gst), null, null, true);
    else if (pick.startsWith("📊")) { if (S) await WebView.loadHTML(reportHTML(S, hist, st), null, null, true); else await info("ยังไม่มีข้อมูล", "เพิ่มรายการซื้อก่อน"); }
    else if (pick.startsWith("➕")) { if (data.sample) { data.holdings = []; data.navs = {}; delete data.sample; } await addFlow(data); }
    else if (pick.startsWith("📸")) await aiImportFlow(data);
    else if (pick.startsWith("✏️")) await editFlow(data);
    else if (pick.startsWith("📝")) await navFlow(data);
    else if (pick.startsWith("🐱")) await catFlow(data);
    else if (pick.startsWith("🎯")) await goalFlow(data);
    else if (pick.startsWith("⏰")) await alertFlow(data, S);
    else if (pick.startsWith("📜")) await questFlow(data, S);
    else if (pick.startsWith("🔔")) {
      const on = st.notify !== false;
      const j = await ask("🔔 แจ้งเตือนสรุปพอร์ต", "แมวจะส่งสรุปสั้นๆ วันละ 2 รอบ\n• เย็น หลังตลาดหุ้นไทยปิด (16:45)\n• เช้า หลังตลาดอเมริกาปิด (7:00)\n\nคำนวณในเครื่องทั้งหมด ไม่ใช้ AI ไม่เสียค่าใช้จ่าย\n(ต้องมี widget อยู่บนหน้าจอ แจ้งเตือนจะมาตอน widget รีเฟรช อาจช้ากว่าเวลาเล็กน้อย)",
        [on ? "🔕 ปิดแจ้งเตือน" : "🔔 เปิดแจ้งเตือน", "📨 ส่งตัวอย่างตอนนี้"]);
      if (j === 0) { st.notify = !on; writeJSON(F_DATA, data); }
      if (j === 1) { if (!(await maybeBrief(S, st, true))) await info("ส่งไม่ได้", S ? "อนุญาตการแจ้งเตือนของ Scriptable ใน ตั้งค่า > การแจ้งเตือน" : "เพิ่มพอร์ตก่อน"); }
    }
    else if (pick.startsWith("🔑")) await bitkubFlow();
    else if (pick.startsWith("💾")) await backupFlow(data);
    else if (pick.startsWith("🔄")) { if ((await updateFlow(data)) === "exit") return; }
    else if (pick.startsWith("📤")) await shareFlow();
    else if (pick.startsWith("👁")) {
      const fams = [["small", "เล็ก", "presentSmall"], ["medium", "กลาง", "presentMedium"], ["large", "ใหญ่", "presentLarge"],
        ["accessoryRectangular", "ล็อกสกรีน: สี่เหลี่ยม", "presentAccessoryRectangular"], ["accessoryCircular", "ล็อกสกรีน: วงกลม", "presentAccessoryCircular"],
        ["accessoryInline", "ล็อกสกรีน: บรรทัดบน", "presentAccessoryInline"]];
      const j = await ask("พรีวิว", null, fams.map((f) => f[1]));
      if (j >= 0) {
        const [fam, , fn] = fams[j];
        const w = buildWidget(S, hist, fam, gst);
        if (typeof w[fn] === "function") await w[fn]();
        else await info("พรีวิวไม่ได้", "Scriptable เวอร์ชันนี้ยังพรีวิวล็อกสกรีนไม่ได้ ให้เพิ่ม widget ที่หน้าจอล็อกเพื่อดูได้เลย");
      }
    }
    else if (pick.startsWith("🧪")) writeJSON(F_DATA, sampleData(st));
    else if (pick.startsWith("🧹")) writeJSON(F_DATA, { holdings: [], navs: {}, settings: st });
  }
}

// ---------- main ----------
if (config.runsInWidget || config.runsInAccessoryWidget) {
  let w;
  try {
    const { data, S, hist } = await loadAll();
    w = buildWidget(S, hist, config.widgetFamily, gameSettings(data));
    if (!data.sample) { await maybeBrief(S, gameSettings(data)); await maybeAlerts(data, S); }
  } catch (e) {
    T = makeTheme("auto");
    w = new ListWidget(); w.backgroundColor = T.bg; w.setPadding(12, 12, 12, 12);
    txt(w, "แมวสะดุด เมี้ยว…", 12, { w: "heavy" });
    txt(w, String(e.message || e), 9, { color: T.sub, lines: 3 });
    w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  }
  Script.setWidget(w);
  // อัปเดตเบื้องหลัง (ไม่ทำให้ widget พัง ถ้าเน็ตไม่ดีจะข้ามไป) — โค้ดใหม่มีผลในการรีเฟรชรอบถัดไป
  try {
    const d = await readJSON(F_DATA, {});
    if (!d.settings || d.settings.autoUpdate !== false) await checkUpdate();
  } catch (e) {}
} else {
  // ผู้ใช้ใหม่ (เช่น เพื่อนที่ติดตั้งผ่านลิงก์): ทักทาย + ตั้งชื่อแมว
  try {
    const d0 = await readJSON(F_DATA, null);
    if (!d0) {
      const a = new Alert(); a.title = "ยินดีต้อนรับสู่ Pixel Cat Portfolio 🐱";
      a.message = "ตั้งชื่อแมวประจำพอร์ตของคุณ (เปลี่ยนทีหลังได้)";
      a.addTextField("ชื่อแมว", "ส้มจี๊ด"); a.addAction("เริ่มเลย");
      await a.presentAlert();
      const nm = (a.textFieldValue(0) || "").trim() || "ส้มจี๊ด";
      writeJSON(F_DATA, { holdings: [], navs: {}, settings: Object.assign({}, DEFAULT_SETTINGS, { catName: nm.slice(0, 12) }) });
    }
  } catch (e) {}
  // เปิดแอปเองก็เช็กอัปเดตเงียบๆ (ไม่บล็อกถ้าเน็ตช้า)
  try { const d = await readJSON(F_DATA, {}); if (!d.settings || d.settings.autoUpdate !== false) await checkUpdate(); } catch (e) {}
  // แตะ widget → เปิดห้องแมวก่อน แล้วค่อยเข้าเมนู
  if (args.queryParameters && args.queryParameters.open === "room") {
    try { const { data, S, hist } = await loadAll(); await WebView.loadHTML(roomHTML(S, hist, gameSettings(data)), null, null, true); } catch (e) {}
  }
  await appMenu();
}
Script.complete();
