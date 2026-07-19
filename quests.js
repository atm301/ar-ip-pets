/* ============================================================
 * 每日任務 + EXP/玩家等級（P3 雛形）
 * 進度存 localStorage，每日重置；獎勵 = EXP + 配件
 * ============================================================ */
/* 常見任務庫（後台「從常見任務加入」的來源；品牌沒自訂就用前 6 個當預設） */
const QUEST_PRESETS = [
  { id: 'greet',   name: '跟夥伴說話 1 次',           target: 1,  ev: 'talk',      exp: 10 },
  { id: 'tap10',   name: '摸摸夥伴 10 次',            target: 10, ev: 'talk',      exp: 25 },
  { id: 'feed3',   name: '餵食 3 次',                 target: 3,  ev: 'feed',      exp: 20 },
  { id: 'scan1',   name: '掃描 1 個產品',             target: 1,  ev: 'scan',      exp: 20 },
  { id: 'invoice', name: '掃 1 張消費發票',           target: 1,  ev: 'invoice',   exp: 30, item: 'glasses' },
  { id: 'walk',    name: '地圖探索：完成 1 次遭遇',   target: 1,  ev: 'encounter', exp: 30 },
  { id: 'scan3',   name: '掃描產品 3 次',             target: 3,  ev: 'scan',      exp: 40 },
  { id: 'photo',   name: '跟夥伴拍 1 張合照',         target: 1,  ev: 'photo',     exp: 15 },
  { id: 'share',   name: '分享合照給朋友',            target: 1,  ev: 'share',     exp: 25 },
  { id: 'duo',     name: '看 1 次角色相聚劇情',       target: 1,  ev: 'duo',       exp: 20 },
  { id: 'feed10',  name: '大胃王：餵食 10 次',        target: 10, ev: 'feed',      exp: 45 },
  { id: 'walk3',   name: '地圖大冒險：3 次遭遇',      target: 3,  ev: 'encounter', exp: 60 }
];
let ARP_QUESTS = QUEST_PRESETS.slice(0, 6);
/* 品牌自訂任務（characters.js 載入品牌設定時呼叫） */
function arpSetQuests(list) {
  if (Array.isArray(list) && list.length) ARP_QUESTS = list;
}

/* 每日邊界統一用台灣時間（任務重置/每日出沒點/活力補滿同一條日界線） */
function arpToday() { return twDateStr(); }
function arpQuestState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('arp_quests')); } catch (e) {}
  if (!s || s.date !== arpToday()) s = { date: arpToday(), prog: {}, claimed: [] };
  return s;
}
function arpQuestSave(s) { localStorage.setItem('arp_quests', JSON.stringify(s)); }

/* 遊戲各處呼叫：questBump('talk'|'feed'|'scan'|'invoice'|'encounter') */
function questBump(ev, n) {
  const s = arpQuestState();
  let hit = false;
  ARP_QUESTS.forEach(q => {
    if (q.ev === ev && (s.prog[q.id] || 0) < q.target) {
      s.prog[q.id] = Math.min(q.target, (s.prog[q.id] || 0) + (n || 1));
      hit = true;
    }
  });
  if (hit) arpQuestSave(s);
  return s;
}
/* 可領取的任務數（給紅點提示用） */
function questClaimable() {
  const s = arpQuestState();
  return ARP_QUESTS.filter(q => !s.claimed.includes(q.id) && (s.prog[q.id] || 0) >= q.target).length;
}
function questClaim(id) {
  const s = arpQuestState();
  const q = ARP_QUESTS.find(x => x.id === id);
  if (!q || s.claimed.includes(id) || (s.prog[q.id] || 0) < q.target) return null;
  s.claimed.push(id);
  arpQuestSave(s);
  arpAddExp(q.exp);
  if (q.item && typeof arpUnlockItem === 'function') arpUnlockItem(q.item);
  return q;
}

/* ---------- 活力值系統（全部用台灣時間 UTC+8，台灣無日光節約） ----------
 * 規則：基礎上限 100；每小時連續回 10；每天台灣時間 08:00 補滿到上限；
 * 產品可加上限(capBonus)與補充活力（掃序號兌換） */
const STAMINA_BASE_CAP = 100;
const STAMINA_REGEN_PER_HOUR = 10;
const REMOTE_RANGE_M = 5000;   // 5 公里內直接互動
const REMOTE_COST = 20;        // 超過 5 公里的遠征費用

function twNow() { return new Date(Date.now() + 8 * 3600e3); } // 之後全用 getUTC* 讀台灣時間
function twDateStr(d) {
  d = d || twNow();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}
function _stmLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('arp_stamina')); } catch (e) {}
  if (!s || typeof s.v !== 'number') {
    const tn = twNow();
    // 初始 refillDate：今天 08:00 前建檔要標成「昨天」，這樣今天 08:00 的補滿還領得到
    const rd = tn.getUTCHours() >= 8 ? twDateStr(tn) : twDateStr(new Date(tn.getTime() - 24 * 3600e3));
    s = { v: STAMINA_BASE_CAP, capBonus: 0, ts: Date.now(), refillDate: rd };
  }
  return s;
}
function _stmSave(s) { localStorage.setItem('arp_stamina', JSON.stringify(s)); }
/* 結算（回復+每日補滿）並回傳 { value, cap } */
function staminaState() {
  const s = _stmLoad();
  const cap = STAMINA_BASE_CAP + (s.capBonus || 0);
  const now = Date.now();
  if (now > s.ts && s.v < cap) {
    s.v = Math.min(cap, s.v + (now - s.ts) / 3600e3 * STAMINA_REGEN_PER_HOUR);
  }
  s.ts = Math.max(s.ts, now); // 結算基準只前進：把時鐘撥回再撥正不能重複回復
  const tn = twNow();
  const today = twDateStr(tn);
  const tomorrow = twDateStr(new Date(tn.getTime() + 24 * 3600e3));
  if (s.refillDate > tomorrow) s.refillDate = today; // 異常未來值（誤調時鐘）重設，避免正常用戶被長期鎖補滿
  // 單調比較（字串補零後字典序=日期序）：日期撥來撥去不能重複領每日補滿
  if (today > s.refillDate && tn.getUTCHours() >= 8) {
    s.v = cap;
    s.refillDate = today;
  }
  _stmSave(s);
  return { value: Math.floor(s.v), cap: cap };
}
function staminaSpend(n) {
  const st = staminaState();
  if (st.value < n) return false;
  const s = _stmLoad(); s.v = Math.max(0, s.v - n); _stmSave(s);
  return true;
}
function staminaRestore(n) {
  staminaState();
  const s = _stmLoad();
  const cap = STAMINA_BASE_CAP + (s.capBonus || 0);
  s.v = Math.min(cap, s.v + n); _stmSave(s);
  return Math.floor(s.v);
}
function staminaCapUp(n) {
  staminaState();
  const s = _stmLoad();
  s.capBonus = (s.capBonus || 0) + n;
  _stmSave(s);
  return STAMINA_BASE_CAP + s.capBonus;
}
/* 距離下一個整點回復還有幾分鐘（UI 顯示用） */
function staminaNextRegenMin() {
  const st = staminaState();
  if (st.value >= st.cap) return 0;
  const s = _stmLoad();
  const perMs = 3600e3 / STAMINA_REGEN_PER_HOUR; // 每 1 點所需毫秒
  const frac = (s.v - Math.floor(s.v));
  return Math.max(1, Math.ceil((1 - frac) * perMs / 60000));
}

/* ---------- 活力商品（購買產品附的序號：補充活力 / 提升上限） ---------- */
let STAMINA_ITEMS = [
  { code: 'ENERGY30', name: '活力小點心', type: 'restore', amount: 30, desc: '兌換後活力 +30' },
  { code: 'ENERGY100', name: '活力大補帖', type: 'full', desc: '兌換後活力補滿到上限' },
  { code: 'CAPUP20', name: '活力上限 +20', type: 'cap', amount: 20, desc: '購買指定產品附贈，上限永久 +20（每碼限用一次）' }
];
function arpSetStaminaItems(list) { if (Array.isArray(list) && list.length) STAMINA_ITEMS = list; }
function _redeemedCodes() {
  try { return JSON.parse(localStorage.getItem('arp_redeemed')) || []; } catch (e) { return []; }
}
function _dailyRedeems() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem('arp_redeem_daily')); } catch (e) {}
  if (!s || s.date !== twDateStr()) s = { date: twDateStr(), codes: [] };
  return s;
}
/* 兌換活力序號：回傳結果訊息物件或 null（不是活力序號）
 * cap 型每碼永久一次；restore/full 型每碼每天一次（防同一序號無限刷） */
function staminaRedeem(code) {
  const it = STAMINA_ITEMS.find(x => x.code && x.code.toUpperCase() === String(code).toUpperCase());
  if (!it) return null;
  if (it.type === 'cap') {
    const used = _redeemedCodes();
    if (used.includes(it.code)) return { ok: false, msg: '這個上限序號已經用過了' };
    used.push(it.code); localStorage.setItem('arp_redeemed', JSON.stringify(used));
    const cap = staminaCapUp(it.amount);
    return { ok: true, msg: '⚡ 活力上限提升到 ' + cap + '！' };
  }
  const dr = _dailyRedeems();
  if (dr.codes.includes(it.code)) return { ok: false, msg: '「' + it.name + '」今天已兌換過，明天再來！' };
  dr.codes.push(it.code);
  localStorage.setItem('arp_redeem_daily', JSON.stringify(dr));
  if (it.type === 'full') {
    staminaState();
    const s = _stmLoad();
    s.v = STAMINA_BASE_CAP + (s.capBonus || 0);
    _stmSave(s);
    return { ok: true, msg: '⚡ 活力全滿（' + Math.floor(s.v) + '）！' };
  }
  const v = staminaRestore(it.amount);
  return { ok: true, msg: '⚡ 活力 +' + it.amount + '（目前 ' + v + '）' };
}

/* ---------- EXP / 玩家等級（每 100 EXP 升 1 級） ---------- */
function arpExpState() {
  try { return JSON.parse(localStorage.getItem('arp_exp')) || { exp: 0 }; } catch (e) { return { exp: 0 }; }
}
function arpAddExp(n) {
  const s = arpExpState();
  const before = arpPlayerLevel();
  s.exp += n;
  localStorage.setItem('arp_exp', JSON.stringify(s));
  const after = 1 + Math.floor(s.exp / 100);
  // 玩家 Lv.3 → 解鎖小皇冠（紙娃娃獎勵）
  if (after >= 3 && typeof arpUnlockItem === 'function') arpUnlockItem('crown');
  return { exp: s.exp, levelUp: after > before, level: after };
}
function arpPlayerLevel() { return 1 + Math.floor(arpExpState().exp / 100); }
function arpExpBar() {
  const e = arpExpState().exp;
  return { level: 1 + Math.floor(e / 100), cur: e % 100, next: 100, total: e };
}
