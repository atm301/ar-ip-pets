/* ============================================================
 * AR IP Pets — 共用邏輯（角色資料在 characters.json，非工程師改那份就好）
 * 這裡只放：設定載入、3D 角色組裝、存檔、音效/震動/TTS、統計
 * ============================================================ */

let CHARACTERS = [];
let DUO_SCRIPTS = [];
let ACCESSORIES = [];

/* 載入設定，優先序：①雲端品牌（?b=slug）②此裝置自訂（後台「存到此裝置」）③預設 characters.json */
async function arpLoadConfig() {
  let cfg = null;
  const slug = (typeof arpBrandSlug === 'function') ? arpBrandSlug() : '';
  if (slug) {
    try {
      const brand = await arpFetchBrand(slug);
      if (brand && brand.config && brand.config.characters && brand.config.characters.length) {
        window.ARP_BRAND = brand;
        cfg = brand.config;
      }
    } catch (e) {}
  }
  if (!cfg) {
    try {
      const custom = localStorage.getItem('arp_custom_chars');
      if (custom) cfg = JSON.parse(custom);
    } catch (e) {}
  }
  if (!cfg) {
    const res = await fetch('characters.json');
    cfg = await res.json();
  }
  CHARACTERS = cfg.characters || [];
  DUO_SCRIPTS = cfg.duoScripts || [];
  ACCESSORIES = cfg.accessories || [];
  // 雲端品牌若沒定義配件，沿用預設三件（序號/等級解鎖機制仍可用）
  if (!ACCESSORIES.length && slug) {
    ACCESSORIES = [
      { id: 'hat', name: '小紅帽', code: 'HAT2026', desc: '序號兌換' },
      { id: 'glasses', name: '圓框眼鏡', code: 'COOL123', desc: '序號兌換' },
      { id: 'scarf', name: '好感圍巾', unlock: 'lv3', desc: '好感度 Lv.3 解鎖' }
    ];
  }
  return cfg;
}

/* ---------- 裝備/紙娃娃系統（雛形）：配件跨角色共用，存 localStorage ---------- */
function arpItems() {
  try { return JSON.parse(localStorage.getItem('arp_items')) || []; } catch (e) { return []; }
}
function arpUnlockItem(id) {
  const s = arpItems();
  if (s.includes(id)) return false;
  s.push(id); localStorage.setItem('arp_items', JSON.stringify(s));
  return true;
}
/* 把已解鎖配件掛到角色身上（可重複呼叫，會先清掉舊的再掛） */
function applyAccessories(ch) {
  const root = document.getElementById('char-' + ch.id);
  if (!root) return;
  const bob = root.querySelector('a-entity');
  if (!bob) return;
  bob.querySelectorAll('.acc').forEach(n => n.remove());
  const items = arpItems();
  const isImg = ch.species === 'image';
  const headY = isImg ? 0.95 : 0.63;
  if (items.includes('hat')) {
    const h = el('a-entity', { class: 'acc', position: '0 ' + headY + ' 0' }, bob);
    el('a-cone', { 'radius-bottom': '0.13', 'radius-top': '0.02', height: '0.16', color: '#E03131', position: '0 0.08 0' }, h);
    el('a-sphere', { radius: '0.03', color: '#FFF', position: '0 0.17 0' }, h);
  }
  if (items.includes('glasses') && !isImg) {
    const g = el('a-entity', { class: 'acc', position: '0 0.55 0.15' }, bob);
    el('a-torus', { position: '-0.06 0 0', radius: '0.035', 'radius-tubular': '0.005', color: '#4A3B47' }, g);
    el('a-torus', { position: '0.06 0 0', radius: '0.035', 'radius-tubular': '0.005', color: '#4A3B47' }, g);
    el('a-box', { position: '0 0.005 0', width: '0.05', height: '0.008', depth: '0.008', color: '#4A3B47' }, g);
  }
  if (items.includes('scarf') && !isImg) {
    el('a-torus', { class: 'acc', position: '0 0.4 0', rotation: '90 0 0', radius: '0.13', 'radius-tubular': '0.035', color: '#FF7FA5' }, bob);
  }
}
function arpIsCustomMode() { return !!localStorage.getItem('arp_custom_chars') || !!localStorage.getItem('arp_custom_mind'); }
function arpClearCustom() { localStorage.removeItem('arp_custom_chars'); localStorage.removeItem('arp_custom_mind'); }
/* 辨識檔來源：①雲端品牌 mind_url ②此裝置自訂 ③預設檔 */
function arpTargetSrc() {
  if (window.ARP_BRAND && window.ARP_BRAND.mind_url) return window.ARP_BRAND.mind_url;
  return localStorage.getItem('arp_custom_mind') || './targets/targets.mind';
}

/* ---------- 進度存檔（localStorage） ---------- */
const ARP_KEY = 'arp_state_v1';
function arpLoad() {
  try { return JSON.parse(localStorage.getItem(ARP_KEY)) || { collected: {}, duoSeen: [] }; }
  catch (e) { return { collected: {}, duoSeen: [] }; }
}
function arpSave(state) { localStorage.setItem(ARP_KEY, JSON.stringify(state)); }
function arpDiscover(id) {
  const s = arpLoad();
  let isNew = false;
  if (!s.collected[id]) { s.collected[id] = { affection: 0, fed: 0, at: Date.now() }; isNew = true; }
  arpSave(s); return isNew;
}
function arpAffection(id, delta) {
  const s = arpLoad();
  if (!s.collected[id]) return 0;
  s.collected[id].affection += delta;
  arpSave(s); return s.collected[id].affection;
}
function arpFeed(id) {
  const s = arpLoad();
  if (!s.collected[id]) return;
  s.collected[id].fed += 1; s.collected[id].affection += 2;
  arpSave(s);
}
function arpCollectedCount() { return Object.keys(arpLoad().collected).length; }
function arpLevel(aff) { return Math.min(10, Math.floor(aff / 5) + 1); }

/* ---------- 掃描統計（3-3：後台數據分頁讀這份） ---------- */
function arpBumpScan(id) {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('arp_stats')) || {}; } catch (e) {}
  s[id] = (s[id] || 0) + 1;
  localStorage.setItem('arp_stats', JSON.stringify(s));
}
function arpStats() {
  try { return JSON.parse(localStorage.getItem('arp_stats')) || {}; } catch (e) { return {}; }
}

/* ---------- 事件追蹤（GA4 + Pixel，安全包裝） ---------- */
function arpTrack(name, params) {
  try { if (window.gtag) gtag('event', name, params || {}); } catch (e) {}
  try { if (window.fbq) fbq('trackCustom', name, params || {}); } catch (e) {}
}

/* ---------- 1-2 音效 + 震動（WebAudio 合成，不需外部音檔） ---------- */
function arpSoundOn() { return localStorage.getItem('arp_sound') !== 'off'; }
function arpToggleSound() {
  localStorage.setItem('arp_sound', arpSoundOn() ? 'off' : 'on');
  return arpSoundOn();
}
let _actx = null;
function _audio() {
  if (!_actx) { try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (_actx && _actx.state === 'suspended') _actx.resume();
  return _actx;
}
/* type: 'pop'（被摸）| 'yum'（餵食）| 'found'（辨識成功） */
function arpSfx(type) {
  if (!arpSoundOn()) return;
  const ctx = _audio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if (type === 'found') {
    o.type = 'sine';
    o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + 0.1); o.frequency.setValueAtTime(784, t + 0.2);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.start(t); o.stop(t + 0.45);
  } else if (type === 'yum') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(660, t + 0.15);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.3);
  } else {
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.start(t); o.stop(t + 0.15);
  }
}
function arpVibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern || 40); } catch (e) {}
}

/* ---------- 7-1 角色說話（Web Speech API，每隻角色不同音高/語速） ---------- */
let _zhVoice = null;
function _pickVoice() {
  const vs = speechSynthesis.getVoices();
  _zhVoice = vs.find(v => v.lang === 'zh-TW') || vs.find(v => v.lang && v.lang.startsWith('zh')) || null;
}
if ('speechSynthesis' in window) {
  _pickVoice();
  speechSynthesis.onvoiceschanged = _pickVoice;
}
function arpSpeak(ch, text) {
  if (!arpSoundOn() || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const clean = text.replace(/（[^）]*）/g, '').replace(/[～!！?？…]+/g, '，');
    const u = new SpeechSynthesisUtterance(clean);
    if (_zhVoice) u.voice = _zhVoice;
    u.lang = 'zh-TW';
    u.pitch = (ch && ch.voice && ch.voice.pitch) || 1.2;
    u.rate = (ch && ch.voice && ch.voice.rate) || 1.05;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- 用 A-Frame 基本形狀組出可愛角色（免外部模型檔） ---------- */
function el(tag, attrs, parent) {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function buildCharacter(ch) {
  const root = el('a-entity', { id: 'char-' + ch.id, class: 'clickable' });
  // 腳下陰影（不隨浮動動畫移動，增加「站在桌面上」的定著感）
  el('a-circle', { position: '0 0.005 0', rotation: '-90 0 0', radius: '0.26',
    color: '#000', opacity: '0.16' }, root);
  // 待機上下浮動
  const bob = el('a-entity', {
    animation: 'property: position; from: 0 0 0; to: 0 0.06 0; dir: alternate; dur: 1200; loop: true; easing: easeInOutSine'
  }, root);

  // 後台上傳的 2D 角色圖 → 2.5D 可動看板（浮動 + 跳躍 + 點擊擠壓都共用）
  if (ch.species === 'image' && ch.imageSrc) {
    el('a-image', { src: ch.imageSrc, position: '0 0.45 0', width: '0.9', height: '0.9',
      transparent: 'true', class: 'clickable' }, bob);
    return root;
  }

  // 身體（壓扁的球）
  el('a-sphere', { position: '0 0.22 0', radius: '0.22', 'scale': '1 0.92 0.9', color: ch.colors.body, class: 'clickable' }, bob);
  // 肚皮
  el('a-sphere', { position: '0 0.19 0.115', radius: '0.13', 'scale': '1 0.95 0.55', color: ch.colors.belly, class: 'clickable' }, bob);
  // 頭
  el('a-sphere', { position: '0 0.52 0', radius: '0.17', color: ch.colors.body, class: 'clickable' }, bob);
  // 眼睛
  el('a-sphere', { position: '-0.06 0.55 0.145', radius: '0.022', color: '#333' }, bob);
  el('a-sphere', { position: '0.06 0.55 0.145', radius: '0.022', color: '#333' }, bob);
  // 腮紅
  el('a-sphere', { position: '-0.1 0.5 0.12', radius: '0.025', 'scale': '1 0.6 0.4', color: ch.colors.accent, opacity: '0.55' }, bob);
  el('a-sphere', { position: '0.1 0.5 0.12', radius: '0.025', 'scale': '1 0.6 0.4', color: ch.colors.accent, opacity: '0.55' }, bob);
  // 腳
  el('a-sphere', { position: '-0.09 0.03 0.05', radius: '0.055', 'scale': '1 0.6 1.1', color: ch.colors.body }, bob);
  el('a-sphere', { position: '0.09 0.03 0.05', radius: '0.055', 'scale': '1 0.6 1.1', color: ch.colors.body }, bob);

  if (ch.species === 'bunny') {
    el('a-sphere', { position: '-0.07 0.75 -0.02', radius: '0.045', 'scale': '0.7 2.2 0.5', color: ch.colors.body, rotation: '0 0 8' }, bob);
    el('a-sphere', { position: '0.07 0.75 -0.02', radius: '0.045', 'scale': '0.7 2.2 0.5', color: ch.colors.body, rotation: '0 0 -8' }, bob);
    el('a-sphere', { position: '-0.07 0.75 0.005', radius: '0.03', 'scale': '0.5 1.8 0.3', color: ch.colors.belly, rotation: '0 0 8' }, bob);
    el('a-sphere', { position: '0.07 0.75 0.005', radius: '0.03', 'scale': '0.5 1.8 0.3', color: ch.colors.belly, rotation: '0 0 -8' }, bob);
  } else if (ch.species === 'bear') {
    el('a-sphere', { position: '-0.12 0.66 0', radius: '0.055', color: ch.colors.body }, bob);
    el('a-sphere', { position: '0.12 0.66 0', radius: '0.055', color: ch.colors.body }, bob);
    el('a-sphere', { position: '-0.12 0.66 0.03', radius: '0.03', color: ch.colors.belly }, bob);
    el('a-sphere', { position: '0.12 0.66 0.03', radius: '0.03', color: ch.colors.belly }, bob);
    el('a-sphere', { position: '0 0.51 0.155', radius: '0.028', color: ch.colors.accent }, bob);
  } else if (ch.species === 'chick') {
    el('a-cone', { position: '0 0.51 0.17', 'radius-bottom': '0.03', 'radius-top': '0.001', height: '0.05', rotation: '90 0 0', color: ch.colors.accent }, bob);
    el('a-sphere', { position: '0 0.7 0', radius: '0.025', 'scale': '0.6 1.6 0.6', color: ch.colors.accent, rotation: '0 0 15' }, bob);
    el('a-sphere', { position: '-0.2 0.28 0', radius: '0.07', 'scale': '0.5 1 0.8', color: ch.colors.body, rotation: '0 0 20' }, bob);
    el('a-sphere', { position: '0.2 0.28 0', radius: '0.07', 'scale': '0.5 1 0.8', color: ch.colors.body, rotation: '0 0 -20' }, bob);
  }
  return root;
}

/* 角色開心跳一下（相對目前位置，角色可能站在產品旁而非原點） */
function charJump(chId) {
  const rootEl = document.getElementById('char-' + chId);
  if (!rootEl) return;
  const p = rootEl.getAttribute('position');
  if (!rootEl.dataset.basePos) rootEl.dataset.basePos = p.x + ' ' + p.y + ' ' + p.z;
  const from = rootEl.dataset.basePos;
  const fx = parseFloat(from.split(' ')[0]), fy = parseFloat(from.split(' ')[1]);
  const to = fx + ' ' + (fy + 0.25) + ' ' + p.z;
  rootEl.removeAttribute('animation__jump');
  rootEl.setAttribute('animation__jump',
    'property: position; from: ' + from + '; to: ' + to + '; dir: alternate; dur: 220; loop: 2; easing: easeOutQuad');
  setTimeout(() => { rootEl.removeAttribute('animation__jump'); rootEl.setAttribute('position', from); }, 1000);
}

function pickLine(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }
function charById(id) { return CHARACTERS.find(c => c.id === id); }
function duoScriptFor(idA, idB) {
  return DUO_SCRIPTS.find(s => s.pair.includes(idA) && s.pair.includes(idB) && idA !== idB);
}
