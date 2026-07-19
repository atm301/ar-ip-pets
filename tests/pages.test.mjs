// 頁面煙霧測試：AR 主頁啟動、教學蓋板、示範圖頁、掃碼頁發票解析
import { launch, BASE, assert } from './helpers.mjs';

const { browser, page, errors } = await launch();

// index：教學蓋板（首次）→ 關閉 → AR 啟動 → 3 錨點
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const tut = await page.evaluate(() => document.getElementById('modal-tut').style.display === 'flex');
assert(tut, '首次應顯示教學蓋板');
await page.click('#btn-tut-go');
const r = await page.evaluate(() => ({
  arStarted: document.getElementById('scanbox').style.display === 'block',
  anchors: document.querySelectorAll('[mindar-image-target]').length,
  frames: document.querySelectorAll('[id^=frame-]').length
}));
assert(r.arStarted, 'AR 引擎應啟動');
assert(r.anchors === 3 && r.frames === 3, '3 錨點 + 3 鎖定框');

// targets：3 張卡
await page.goto(BASE + '/targets.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const cards = await page.evaluate(() => document.querySelectorAll('.cardx').length);
assert(cards === 3, '示範圖 3 張（得 ' + cards + '）');

// scan：發票解析
await page.goto(BASE + '/scan.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const inv = await page.evaluate(() =>
  parseInvoice('AB123456781150719123400000064000000c812345678'));
assert(inv && inv.no === 'AB12345678' && inv.total === 200, '發票明文解析');

assert(errors.length === 0, 'JS 錯誤: ' + errors.join('; '));
await browser.close();
console.log('pages OK');
