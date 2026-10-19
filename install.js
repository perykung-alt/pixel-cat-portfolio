// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: download;
// Pixel Cat Portfolio — ตัวติดตั้ง (รันครั้งเดียว แล้วลบทิ้งได้)
const SRC = "https://raw.githubusercontent.com/perykung-alt/pixel-cat-portfolio/main/PortfolioWidget.js";
const NAME = "Pixel Cat Portfolio";
const r = new Request(SRC + "?t=" + Date.now());
const code = await r.loadString();
if (!code.includes("PIXEL CAT PORTFOLIO")) throw new Error("ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
let fm; try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
fm.writeString(fm.joinPath(fm.documentsDirectory(), NAME + ".js"), code);
const a = new Alert(); a.title = "ติดตั้งสำเร็จ 🐱";
a.message = 'เพิ่มสคริปต์ "' + NAME + '" แล้ว (อัปเดตอัตโนมัติ)\nลบสคริปต์ติดตั้งนี้ทิ้งได้เลย';
a.addAction("เปิดเลย"); a.addCancelAction("ปิด");
if ((await a.presentAlert()) === 0) Safari.open("scriptable:///run?scriptName=" + encodeURIComponent(NAME));
