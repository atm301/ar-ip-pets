// 角色動作引擎：待機動作觸發、互動反應、動完精準歸位
import { launch, BASE, assert } from './helpers.mjs';

const { browser, page, errors } = await launch();
await page.goto(BASE + '/demo.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const seen = await page.evaluate(() => new Promise(res => {
  const hits = new Set();
  const t0 = Date.now();
  const iv = setInterval(() => {
    document.querySelectorAll('a-entity').forEach(n => {
      if (n.getAttributeNames().some(a => a.startsWith('animation__act'))) hits.add(n.id || 'bob');
    });
    if (Date.now() - t0 > 9000) { clearInterval(iv); res([...hits]); }
  }, 120);
}));
assert(seen.length >= 2, '待機動作應觸發（看到 ' + seen.length + ' 個目標）');

await page.mouse.move(640, 470); await page.waitForTimeout(400);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(300);
const reacting = await page.evaluate(() =>
  [...document.querySelectorAll('a-entity')].some(n =>
    n.getAttributeNames().some(a => a.startsWith('animation__act'))));
assert(reacting, '點擊應觸發反應動作');

await page.waitForTimeout(2500);
const back = await page.evaluate(() => {
  const r = document.getElementById('char-pudding');
  const p = r.getAttribute('position'), rt = document.getElementById('head-pudding').getAttribute('rotation');
  return Math.abs(p.y) < 0.01 && Math.abs(rt.x) < 0.5 && Math.abs(rt.y) < 0.5;
});
assert(back, '動作結束應精準歸位');
assert(errors.length === 0, 'JS 錯誤: ' + errors.join('; '));
await browser.close();
console.log('anim OK');
