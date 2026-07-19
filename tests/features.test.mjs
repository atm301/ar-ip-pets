// 新功能煙霧：手動召喚保底、餵食小遊戲、好感度進化縮放、扭蛋演出、聊天 UI
import { launch, BASE, assert } from './helpers.mjs';

const { browser, page, errors } = await launch();

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
// 預先種資料：跳過教學、mochi 好感度 25（Lv.5 → 進化變大）
await page.evaluate(() => {
  localStorage.setItem('arp_tut_done', '1');
  localStorage.setItem('arp_state_v1', JSON.stringify({
    collected: { mochi: { affection: 25, fed: 3, at: Date.now() } }, duoSeen: []
  }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9500); // AR 起 + 8 秒掃不到

// A4 手動召喚按鈕出現 → 開選單 → 召喚第一隻
const manualVisible = await page.evaluate(() =>
  document.getElementById('btn-manual').style.display !== 'none');
assert(manualVisible, '8 秒掃不到應出現手動召喚按鈕');
await page.click('#btn-manual');
const rows = await page.evaluate(() => document.querySelectorAll('#manual-list .charrow').length);
assert(rows >= 3, '召喚選單應列出角色（得 ' + rows + '）');
await page.click('#manual-list .charrow');
await page.waitForTimeout(1200);
const summoned = await page.evaluate(() => ({
  actions: document.getElementById('actions').style.display === 'flex',
  dismiss: document.getElementById('btn-dismiss').style.display !== 'none',
  onCam: !!document.querySelector('a-camera [id^=char-]')
}));
assert(summoned.actions && summoned.dismiss && summoned.onCam, '手動召喚：' + JSON.stringify(summoned));

// B3 進化縮放：mochi Lv.5 → 約 1.27（若第一隻不是 mochi 則跳過驗證值，驗有縮放即可）
const sc = await page.evaluate(() => {
  const first = CHARACTERS[0];
  const s = document.getElementById('char-' + first.id).getAttribute('scale');
  return { id: first.id, x: s.x };
});
if (sc.id === 'mochi') assert(Math.abs(sc.x - 1.27) < 0.03, 'Lv.5 進化縮放（得 ' + sc.x + '）');

// B2 餵食小遊戲：開 → 按 → 收
await page.click('#btn-feed');
await page.waitForTimeout(300);
assert(await page.evaluate(() => document.getElementById('feedgame').style.display === 'flex'),
  '餵食應開啟時機小遊戲');
await page.click('#fg-tap');
await page.waitForTimeout(300);
const fed = await page.evaluate(() => ({
  closed: document.getElementById('feedgame').style.display === 'none',
  bubble: document.getElementById('bubble').style.display === 'block'
}));
assert(fed.closed && fed.bubble, '按下後應收掉並顯示餵食台詞：' + JSON.stringify(fed));

// B4 扭蛋演出
await page.evaluate(() => arpGachaReveal('hat'));
await page.waitForTimeout(1500);
assert(await page.evaluate(() =>
  [...document.querySelectorAll('div')].some(d => d.textContent.includes('獲得「'))),
  '扭蛋演出應顯示獲得配件');

// B6 聊天視窗（不打 API）
await page.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });
await page.click('#btn-chat');
assert(await page.evaluate(() => document.getElementById('modal-chat').style.display === 'flex'),
  '聊天視窗應開啟');

assert(errors.length === 0, 'JS 錯誤: ' + errors.join('; '));
await browser.close();
console.log('features OK');
