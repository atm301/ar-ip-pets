// 活力系統：規則 + 防刷攻擊情境
import { launch, BASE, assert } from './helpers.mjs';

const { browser, page, errors } = await launch();
await page.goto(BASE + '/map.html?sim=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const r = await page.evaluate(() => {
  const out = {};
  ['arp_stamina', 'arp_redeemed', 'arp_redeem_daily'].forEach(k => localStorage.removeItem(k));
  out.fresh = staminaState();
  localStorage.setItem('arp_stamina', JSON.stringify({ v: 40, capBonus: 0, ts: Date.now() - 2 * 3600e3, refillDate: twDateStr() }));
  out.regen2h = staminaState().value;
  // 攻擊：時鐘倒退（ts 在未來）
  localStorage.setItem('arp_stamina', JSON.stringify({ v: 0, capBonus: 0, ts: Date.now() + 10 * 3600e3, refillDate: twDateStr() }));
  out.rollback = staminaState().value;
  // 攻擊：refillDate 在未來
  localStorage.setItem('arp_stamina', JSON.stringify({ v: 3, capBonus: 0, ts: Date.now(), refillDate: twDateStr(new Date(twNow().getTime() + 24 * 3600e3)) }));
  out.futureRefill = staminaState().value;
  // 扣費
  localStorage.setItem('arp_stamina', JSON.stringify({ v: 25, capBonus: 0, ts: Date.now(), refillDate: twDateStr() }));
  out.spend = [staminaSpend(20), staminaState().value, staminaSpend(20)];
  // 兌換
  out.full = staminaRedeem('ENERGY100');
  out.fullAgain = staminaRedeem('ENERGY100').ok;
  out.cap = staminaRedeem('CAPUP20');
  out.capAgain = staminaRedeem('CAPUP20').ok;
  return out;
});
assert(r.fresh.value === 100 && r.fresh.cap === 100, '初始 100/100');
assert(r.regen2h === 60, '2 小時應回 20（得 ' + r.regen2h + '）');
assert(r.rollback === 0, '時鐘倒退不得回復');
assert(r.futureRefill === 3, '未來 refillDate 不得補滿');
assert(r.spend[0] === true && r.spend[1] === 5 && r.spend[2] === false, '扣費邏輯');
assert(r.full.ok && !r.fullAgain, 'full 型每日一次');
assert(r.cap.ok && !r.capAgain, 'cap 型永久一次');
assert(errors.length === 0, 'JS 錯誤: ' + errors.join('; '));
await browser.close();
console.log('stamina OK');
