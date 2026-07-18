/* ============================================================
 * 每日任務 + EXP/玩家等級（P3 雛形）
 * 進度存 localStorage，每日重置；獎勵 = EXP + 配件
 * ============================================================ */
const ARP_QUESTS = [
  { id: 'greet',   name: '跟夥伴說話 1 次',           target: 1,  ev: 'talk',      exp: 10 },
  { id: 'tap10',   name: '摸摸夥伴 10 次',            target: 10, ev: 'talk',      exp: 25 },
  { id: 'feed3',   name: '餵食 3 次',                 target: 3,  ev: 'feed',      exp: 20 },
  { id: 'scan1',   name: '掃描 1 個產品',             target: 1,  ev: 'scan',      exp: 20 },
  { id: 'invoice', name: '掃 1 張消費發票',           target: 1,  ev: 'invoice',   exp: 30, item: 'glasses' },
  { id: 'walk',    name: '地圖探索：完成 1 次遭遇',   target: 1,  ev: 'encounter', exp: 30 }
];

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
  return { exp: s.exp, levelUp: after > before, level: after };
}
function arpPlayerLevel() { return 1 + Math.floor(arpExpState().exp / 100); }
function arpExpBar() {
  const e = arpExpState().exp;
  return { level: 1 + Math.floor(e / 100), cur: e % 100, next: 100, total: e };
}
