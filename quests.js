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

function arpToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
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
