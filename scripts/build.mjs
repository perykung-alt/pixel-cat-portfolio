// สร้างเว็บแอปจาก web/ + โค้ดที่ใช้ร่วมกับสคริปต์ iPhone (ส่วนที่อยู่ระหว่าง // @shared-begin ... // @shared-end)
// ใช้: node scripts/build.mjs [outDir=_site]
import fs from "fs";
import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || path.join(root, "_site"));
const src = fs.readFileSync(path.join(root, "PortfolioWidget.js"), "utf8");
const blocks = [...src.matchAll(/\/\/ @shared-begin\n([\s\S]*?)\/\/ @shared-end\n/g)].map((m) => m[1]);
if (blocks.length < 7) throw new Error("พบ shared block แค่ " + blocks.length);
const version = (src.match(/const VERSION = "([^"]+)"/) || [])[1] || "0";
const shared = `// สร้างอัตโนมัติจาก PortfolioWidget.js v${version} — อย่าแก้ไฟล์นี้ตรงๆ\n"use strict";\nconst VERSION = "${version}";\n` + blocks.join("\n");
fs.mkdirSync(out, { recursive: true });
const copy = (from, to) => {
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); }
    else fs.copyFileSync(a, b);
  }
};
copy(path.join(root, "web"), out);
fs.writeFileSync(path.join(out, "shared.js"), shared);
const stamp = version + "-" + Date.now().toString(36);
for (const f of ["index.html", "sw.js"]) {
  const p = path.join(out, f);
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replaceAll("__BUILD__", stamp));
}
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("built", out, "v" + version, blocks.length, "shared blocks");
