// 工具腳本（不是測試）：無頭編譯 MindAR targets.mind
// 用法：node compile-mind.mjs <輸出檔> <圖1> <圖2> ...（圖片路徑相對 repo 根目錄，順序 = targetIndex）
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = path.join(import.meta.dirname, '..');
const PORT = 3777;
const [out, ...imgs] = process.argv.slice(2);
if (!out || !imgs.length) {
  console.error('用法：node compile-mind.mjs 輸出.mind 圖1 圖2 ...');
  process.exit(1);
}

async function serveReady() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch('http://localhost:' + PORT + '/characters.json');
      if (r.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}
let server = null;
if (!(await serveReady().catch(() => false))) {
  server = spawn('npx', ['-y', 'serve', '-l', String(PORT), ROOT], { shell: true, stdio: 'ignore' });
}
if (!(await serveReady())) { console.error('❌ 本地伺服器起不來'); process.exit(1); }

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto('http://localhost:' + PORT + '/about.html');
await page.addScriptTag({ type: 'module', content: "import '/libs/mindar-image.prod.js';" });
await page.waitForFunction(() => window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Compiler,
  null, { timeout: 30000 });

const b64 = await page.evaluate(async (urls) => {
  const list = [];
  for (const u of urls) {
    list.push(await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('載不到 ' + u));
      im.src = u;
    }));
  }
  const compiler = new window.MINDAR.IMAGE.Compiler();
  await compiler.compileImageTargets(list, () => {});
  const buf = await compiler.exportData();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}, imgs.map(p => '/' + p.replace(/\\/g, '/')));

const outPath = path.isAbsolute(out) ? out : path.join(ROOT, out);
fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
console.log('✅ ' + outPath + '（' + imgs.length + ' targets, ' +
  Math.round(Buffer.from(b64, 'base64').length / 1024) + ' KB）');
await browser.close();
if (server) server.kill();
process.exit(0);
