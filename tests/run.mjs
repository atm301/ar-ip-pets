// npm test 入口：起本地伺服器 → 依序跑 tests/*.test.mjs → 總結
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dirname, '..');
const PORT = 3777;

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

const tests = fs.readdirSync(import.meta.dirname).filter(f => f.endsWith('.test.mjs'));
let fail = 0;
for (const t of tests) {
  process.stdout.write('▶ ' + t + ' ... ');
  try {
    execSync('node "' + path.join(import.meta.dirname, t) + '"', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('✅');
  } catch (e) {
    fail++;
    console.log('❌');
    console.log(String(e.stdout || '').slice(-800));
    console.log(String(e.stderr || '').slice(-400));
  }
}
if (server) server.kill();
console.log(fail === 0 ? '\n全部通過（' + tests.length + ' 個測試檔）' : '\n❌ ' + fail + ' 個測試檔失敗');
process.exit(fail === 0 ? 0 : 1);
