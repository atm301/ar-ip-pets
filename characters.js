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
  if (typeof arpSetQuests === 'function' && cfg.quests) arpSetQuests(cfg.quests);
  // 雲端品牌若沒定義配件，沿用預設三件（序號/等級解鎖機制仍可用）
  if (!ACCESSORIES.length && slug) {
    ACCESSORIES = [
      { id: 'hat', name: '小紅帽', code: 'HAT2026', desc: '序號兌換或寶箱' },
      { id: 'glasses', name: '圓框眼鏡', code: 'COOL123', desc: '序號兌換或掃發票任務' },
      { id: 'scarf', name: '好感圍巾', unlock: 'lv3', desc: '好感度 Lv.3 解鎖' },
      { id: 'crown', name: '小皇冠', unlock: 'playerlv3', desc: '玩家 Lv.3 解鎖' },
      { id: 'bow', name: '蝴蝶結', code: 'BOW2026', desc: '序號兌換' },
      { id: 'backpack', name: '小背包', unlock: 'chest', desc: '寶箱獲得' }
    ];
  }
  return cfg;
}

/* ---------- 裝備/紙娃娃系統：配件跨角色共用，存 localStorage ----------
 * 視覺註冊表：codex 生成的去背圖 + 穿戴位置（builtin=幾何角色 / image=2D 看板角色）
 * slot 同槽互斥（head 只能戴一頂）
 */
/* head/face 槽有 headPos（掛頭部群組，跟著轉頭點頭）；neck/back 掛身體 */
const ACC_VISUALS = {
  hat:      { slot: 'head', img: 'codex/images/items/acc-hat.webp',      headPos: '0 0.33 0.04',  image: '0 1.02 0.04',  size: 0.34 },
  crown:    { slot: 'head', img: 'codex/images/items/acc-crown.webp',    headPos: '0 0.33 0.04',  image: '0 1.02 0.04',  size: 0.3 },
  bow:      { slot: 'head', img: 'codex/images/items/acc-bow.webp',      headPos: '0.1 0.26 0.05', image: '0.12 0.96 0.05', size: 0.26 },
  glasses:  { slot: 'face', img: 'codex/images/items/acc-glasses.webp',  headPos: '0 0.08 0.17',  image: '0 0.6 0.06',   size: 0.24 },
  scarf:    { slot: 'neck', img: 'codex/images/items/acc-scarf.webp',    builtin: '0 0.37 0.16',  image: '0 0.28 0.06',  size: 0.36 },
  backpack: { slot: 'back', img: 'codex/images/items/acc-backpack.webp', builtin: '0.25 0.34 -0.05', image: '0.3 0.45 -0.02', size: 0.32 }
};
function arpItems() {
  try { return JSON.parse(localStorage.getItem('arp_items')) || []; } catch (e) { return []; }
}
function arpWorn() {
  try {
    const w = JSON.parse(localStorage.getItem('arp_worn'));
    if (w) return w.filter(id => arpItems().includes(id));
  } catch (e) {}
  // 沒有穿戴紀錄 → 已擁有的每槽自動穿一件
  const worn = [], used = {};
  arpItems().forEach(id => {
    const v = ACC_VISUALS[id];
    if (v && !used[v.slot]) { worn.push(id); used[v.slot] = 1; }
  });
  return worn;
}
function arpWear(id) {
  const v = ACC_VISUALS[id];
  if (!v || !arpItems().includes(id)) return;
  const worn = arpWorn().filter(w => (ACC_VISUALS[w] || {}).slot !== v.slot);
  worn.push(id);
  localStorage.setItem('arp_worn', JSON.stringify(worn));
}
function arpUnwear(id) {
  localStorage.setItem('arp_worn', JSON.stringify(arpWorn().filter(w => w !== id)));
}
function arpUnlockItem(id) {
  const s = arpItems();
  if (s.includes(id)) return false;
  s.push(id); localStorage.setItem('arp_items', JSON.stringify(s));
  arpWear(id); // 新配件自動穿上（同槽替換）
  return true;
}
/* 把「穿戴中」配件掛到角色身上（可重複呼叫，會先清掉舊的再掛）
 * 用 codex 生成的去背圖做 2.5D 看板；圖載不到時 fallback 幾何 */
function applyAccessories(ch) {
  const root = document.getElementById('char-' + ch.id);
  if (!root) return;
  const bob = root.querySelector('a-entity');
  if (!bob) return;
  root.querySelectorAll('.acc').forEach(n => n.remove());
  const isImg = ch.species === 'image';
  const head = document.getElementById('head-' + ch.id);
  arpWorn().forEach(id => {
    const v = ACC_VISUALS[id];
    if (!v) return;
    if (v.img) {
      const useHead = !isImg && v.headPos && head;
      el('a-image', { class: 'acc', src: v.img,
        position: isImg ? v.image : (useHead ? v.headPos : (v.builtin || v.headPos)),
        width: v.size, height: v.size, transparent: 'true',
        material: 'alphaTest: 0.15; side: double' }, useHead ? head : bob);
      return;
    }
    // fallback 幾何（沒有圖檔的配件）
    if (id === 'hat') {
      const h = el('a-entity', { class: 'acc', position: '0 ' + (isImg ? 0.95 : 0.63) + ' 0' }, bob);
      el('a-cone', { 'radius-bottom': '0.13', 'radius-top': '0.02', height: '0.16', color: '#E03131', position: '0 0.08 0' }, h);
      el('a-sphere', { radius: '0.03', color: '#FFF', position: '0 0.17 0' }, h);
    } else if (id === 'glasses' && !isImg) {
      const g = el('a-entity', { class: 'acc', position: '0 0.55 0.15' }, bob);
      el('a-torus', { position: '-0.06 0 0', radius: '0.035', 'radius-tubular': '0.005', color: '#4A3B47' }, g);
      el('a-torus', { position: '0.06 0 0', radius: '0.035', 'radius-tubular': '0.005', color: '#4A3B47' }, g);
      el('a-box', { position: '0 0.005 0', width: '0.05', height: '0.008', depth: '0.008', color: '#4A3B47' }, g);
    } else if (id === 'scarf' && !isImg) {
      el('a-torus', { class: 'acc', position: '0 0.4 0', rotation: '90 0 0', radius: '0.13', 'radius-tubular': '0.035', color: '#FF7FA5' }, bob);
    }
  });
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

/* ---------- 7-1 角色說話 ----------
 * 優先播 VoxCPM 預生成的自然語音（assets/voice/manifest.json：台詞→音檔）；
 * 沒對到的台詞（自訂品牌/新增台詞）退回 Web Speech API */
let VOICE_MAP = null;
let _voiceAudio = null;
try {
  fetch('assets/voice/manifest.json')
    .then(r => (r.ok ? r.json() : null))
    .then(m => { VOICE_MAP = m; })
    .catch(function () {});
} catch (e) {}

let _zhVoice = null;
function _pickVoice() {
  const vs = speechSynthesis.getVoices();
  _zhVoice = vs.find(v => v.lang === 'zh-TW') || vs.find(v => v.lang && v.lang.startsWith('zh')) || null;
}
if ('speechSynthesis' in window) {
  _pickVoice();
  speechSynthesis.onvoiceschanged = _pickVoice;
}
/* 行動瀏覽器音訊解鎖：首次觸碰前不准出聲 → 記住被擋的台詞，解鎖後補播 */
let _audioUnlocked = false, _pendingSpeak = null;
const _voiceBufCache = {};
let _voiceSrc = null;
function _unlockAudioOnce() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  try { const ctx = _audio(); if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  try { speechSynthesis.resume(); } catch (e) {}
  if (_pendingSpeak) {
    const p = _pendingSpeak; _pendingSpeak = null;
    setTimeout(() => arpSpeak(p.ch, p.text), 60);
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', _unlockAudioOnce, { capture: true, once: true });
  document.addEventListener('touchstart', _unlockAudioOnce, { capture: true, once: true });
}
/* 用 WebAudio 播語音檔（iOS 靜音鍵下仍可出聲、與音效共用解鎖狀態） */
async function _playVoiceUrl(url) {
  const ctx = _audio();
  if (!ctx) throw new Error('no ctx');
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) {}
    if (ctx.state === 'suspended') throw new Error('locked');
  }
  let buf = _voiceBufCache[url];
  if (!buf) {
    const r = await fetch(url);
    buf = await ctx.decodeAudioData(await r.arrayBuffer());
    _voiceBufCache[url] = buf;
  }
  if (_voiceSrc) { try { _voiceSrc.stop(); } catch (e) {} }
  const src = ctx.createBufferSource();
  const g = ctx.createGain(); g.gain.value = 0.95;
  src.buffer = buf; src.connect(g); g.connect(ctx.destination);
  src.start();
  _voiceSrc = src;
}
function arpSpeakStop() {
  try { if (_voiceSrc) { _voiceSrc.stop(); _voiceSrc = null; } } catch (e) {}
  try { if (_voiceAudio) { _voiceAudio.pause(); _voiceAudio = null; } } catch (e) {}
  try { speechSynthesis.cancel(); } catch (e) {}
  _pendingSpeak = null;
}
function _speakTTS(ch, text) {
  if (!('speechSynthesis' in window)) return;
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
function arpSpeak(ch, text) {
  if (!arpSoundOn() || !text) return;
  try {
    const vid = ch && (ch.baseId || ch.id);
    const url = vid && VOICE_MAP && VOICE_MAP[vid] && VOICE_MAP[vid][text];
    if (url) {
      try { speechSynthesis.cancel(); } catch (e) {}
      _playVoiceUrl(url).catch(() => {
        // 音訊未解鎖（手機首次手勢前）→ 記住這句，解鎖後補播 + 提示使用者
        _pendingSpeak = { ch: ch, text: text };
        if (typeof window.ARP_AUDIO_BLOCKED === 'function') window.ARP_AUDIO_BLOCKED();
      });
      return;
    }
  } catch (e) {}
  _speakTTS(ch, text);
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
  // 腳
  el('a-sphere', { position: '-0.09 0.03 0.05', radius: '0.055', 'scale': '1 0.6 1.1', color: ch.colors.body }, bob);
  el('a-sphere', { position: '0.09 0.03 0.05', radius: '0.055', 'scale': '1 0.6 1.1', color: ch.colors.body }, bob);

  // 頭部群組（樞紐設在脖子附近，轉頭/點頭/歪頭都繞這裡轉；頭部配飾也掛這裡跟著動）
  const head = el('a-entity', { id: 'head-' + ch.id, position: '0 0.47 0' }, bob);
  el('a-sphere', { position: '0 0.05 0', radius: '0.17', color: ch.colors.body, class: 'clickable' }, head);
  // 眼睛群組（獨立出來做眨眼：整組 y 縮扁）
  const eyes = el('a-entity', { id: 'eyes-' + ch.id, position: '0 0.08 0.145' }, head);
  el('a-sphere', { position: '-0.06 0 0', radius: '0.022', color: '#333' }, eyes);
  el('a-sphere', { position: '0.06 0 0', radius: '0.022', color: '#333' }, eyes);
  // 腮紅
  el('a-sphere', { position: '-0.1 0.03 0.12', radius: '0.025', 'scale': '1 0.6 0.4', color: ch.colors.accent, opacity: '0.55' }, head);
  el('a-sphere', { position: '0.1 0.03 0.12', radius: '0.025', 'scale': '1 0.6 0.4', color: ch.colors.accent, opacity: '0.55' }, head);

  if (ch.species === 'bunny') {
    // 耳朵群組（抖耳朵動作用）
    const ears = el('a-entity', { id: 'extra-' + ch.id, position: '0 0 0' }, head);
    el('a-sphere', { position: '-0.07 0.28 -0.02', radius: '0.045', 'scale': '0.7 2.2 0.5', color: ch.colors.body, rotation: '0 0 8' }, ears);
    el('a-sphere', { position: '0.07 0.28 -0.02', radius: '0.045', 'scale': '0.7 2.2 0.5', color: ch.colors.body, rotation: '0 0 -8' }, ears);
    el('a-sphere', { position: '-0.07 0.285 0.005', radius: '0.03', 'scale': '0.5 1.8 0.3', color: ch.colors.belly, rotation: '0 0 8' }, ears);
    el('a-sphere', { position: '0.07 0.285 0.005', radius: '0.03', 'scale': '0.5 1.8 0.3', color: ch.colors.belly, rotation: '0 0 -8' }, ears);
  } else if (ch.species === 'bear') {
    const ears = el('a-entity', { id: 'extra-' + ch.id, position: '0 0 0' }, head);
    el('a-sphere', { position: '-0.12 0.19 0', radius: '0.055', color: ch.colors.body }, ears);
    el('a-sphere', { position: '0.12 0.19 0', radius: '0.055', color: ch.colors.body }, ears);
    el('a-sphere', { position: '-0.12 0.19 0.03', radius: '0.03', color: ch.colors.belly }, ears);
    el('a-sphere', { position: '0.12 0.19 0.03', radius: '0.03', color: ch.colors.belly }, ears);
    el('a-sphere', { position: '0 0.04 0.155', radius: '0.028', color: ch.colors.accent }, head);
  } else if (ch.species === 'chick') {
    el('a-cone', { position: '0 0.04 0.17', 'radius-bottom': '0.03', 'radius-top': '0.001', height: '0.05', rotation: '90 0 0', color: ch.colors.accent }, head);
    el('a-sphere', { position: '0 0.23 0', radius: '0.025', 'scale': '0.6 1.6 0.6', color: ch.colors.accent, rotation: '0 0 15' }, head);
    // 翅膀群組掛在身體（拍翅動作用）
    const wings = el('a-entity', { id: 'extra-' + ch.id, position: '0 0 0' }, bob);
    el('a-sphere', { position: '-0.2 0.28 0', radius: '0.07', 'scale': '0.5 1 0.8', color: ch.colors.body, rotation: '0 0 20' }, wings);
    el('a-sphere', { position: '0.2 0.28 0', radius: '0.07', 'scale': '0.5 1 0.8', color: ch.colors.body, rotation: '0 0 -20' }, wings);
  }
  return root;
}

/* ============================================================
 * 動作引擎：待機隨機動作 + 互動差異化動作
 * 群組：#char-id(整隻) > bob(浮動) > #head-id(頭) > #eyes-id(眼) / #extra-id(耳/翼)
 * ============================================================ */
const _busy = {};      // 動作進行中（待機動作會讓路）
const _idleT = {};     // 待機動作 timer
const _blinkT = {};    // 眨眼 timer

function _part(id, name) {
  const root = document.getElementById('char-' + id);
  if (!root) return null;
  if (name === 'root') return root;
  if (name === 'bob') return root.querySelector('a-entity');
  return document.getElementById(name + '-' + id);
}
/* 記住基準 transform（root 可能有側移/側轉），動作結束要回得來 */
function _base(elm, prop) {
  const key = 'base' + prop;
  if (!elm.dataset[key]) {
    const v = elm.getAttribute(prop);
    elm.dataset[key] = v ? (v.x + ' ' + v.y + ' ' + v.z) : (prop === 'scale' ? '1 1 1' : '0 0 0');
  }
  return elm.dataset[key];
}
function _vadd(base, dx, dy, dz) {
  const p = base.split(' ').map(Number);
  return (p[0] + dx) + ' ' + (p[1] + dy) + ' ' + (p[2] + dz);
}
/* 內部：掛動畫並在結束後恢復基準值。
 * 動畫名與 token 都是 per-property：同元素的 position/rotation/scale 互不干擾，
 * 只有「同屬性」的新動作會接管舊動作（舊清理靠 token 讓位，由新動作負責歸位） */
function _play(elm, prop, animStr, total, base) {
  const name = 'animation__act_' + prop;
  if (!elm._animTok) elm._animTok = {};
  const tok = (elm._animTok[prop] = (elm._animTok[prop] || 0) + 1);
  elm.removeAttribute(name);
  elm.setAttribute(name, animStr);
  setTimeout(() => {
    if (elm._animTok[prop] !== tok) return; // 已被同屬性的新動作接管
    elm.removeAttribute(name);
    elm.setAttribute(prop, base);
  }, total);
  return total;
}
/* 播一段來回動畫，結束後恢復基準值 */
function _swing(elm, prop, delta, dur, loops, easing) {
  if (!elm) return 0;
  const base = _base(elm, prop);
  const to = _vadd(base, delta[0], delta[1], delta[2]);
  return _play(elm, prop,
    'property: ' + prop + '; from: ' + base + '; to: ' + to + '; dur: ' + dur +
    '; dir: alternate; loop: ' + loops + '; easing: ' + (easing || 'easeInOutSine'),
    dur * loops + 80, base);
}
/* 單程動畫（如轉一圈），結束靜默恢復基準 */
function _oneway(elm, prop, delta, dur, easing) {
  if (!elm) return 0;
  const base = _base(elm, prop);
  return _play(elm, prop,
    'property: ' + prop + '; from: ' + base + '; to: ' + _vadd(base, delta[0], delta[1], delta[2]) +
    '; dur: ' + dur + '; easing: ' + (easing || 'easeInOutQuad'),
    dur + 80, base);
}

/* ---- 動作庫（回傳動作總長 ms） ---- */
const ACTIONS = {
  look:    id => _swing(_part(id, 'head'), 'rotation', [0, 28, 0], 550, 2),            // 環顧
  tilt:    id => _swing(_part(id, 'head'), 'rotation', [0, 0, 14], 450, 2),            // 歪頭
  nod:     id => _swing(_part(id, 'head'), 'rotation', [16, 0, 0], 240, 4),            // 點頭
  ears:    id => _swing(_part(id, 'extra'), 'rotation', [0, 0, 10], 120, 6),           // 抖耳/拍翅
  hop:     id => _swing(_part(id, 'root'), 'position', [0, 0.16, 0], 190, 2, 'easeOutQuad'),
  hopBig:  id => _swing(_part(id, 'root'), 'position', [0, 0.26, 0], 220, 4, 'easeOutQuad'),
  spin:    id => _oneway(_part(id, 'root'), 'rotation', [0, 360, 0], 700, 'easeInOutQuad'),
  stretch: id => _swing(_part(id, 'bob'), 'scale', [-0.06, 0.12, -0.06], 500, 2),      // 伸懶腰
  squash:  id => _swing(_part(id, 'bob'), 'scale', [0.12, -0.15, 0.12], 260, 2),       // 擠壓 Q 彈
  wiggle:  id => _swing(_part(id, 'root'), 'rotation', [0, 0, 9], 130, 6),             // 左右搖擺
  bow:     id => _swing(_part(id, 'root'), 'rotation', [22, 0, 0], 420, 2),            // 鞠躬
  eat:     id => {                                                                     // 低頭吃兩口
    const t1 = _swing(_part(id, 'head'), 'rotation', [24, 0, 0], 260, 4);
    setTimeout(() => _swing(_part(id, 'bob'), 'scale', [0.1, -0.12, 0.1], 220, 2), t1);
    return t1 + 550;
  }
};
/* 各角色個性的待機動作池（兔子愛抖耳、熊慢吞吞、小雞過動） */
const IDLE_POOL = {
  bunny: ['look', 'ears', 'tilt', 'hop', 'stretch', 'wiggle'],
  bear:  ['look', 'tilt', 'stretch', 'nod', 'look', 'stretch'],
  chick: ['hop', 'ears', 'spin', 'wiggle', 'hop', 'ears'],
  image: ['hop', 'wiggle', 'spin', 'stretch', 'squash']
};
/* 互動反應池 */
const REACT_POOL = {
  tap:       ['hopBig', 'spin', 'wiggle', 'nod', 'squash'],
  feed:      ['eat'],
  greet:     ['bow', 'hopBig'],
  celebrate: ['spin', 'hopBig']
};

function charAct(id, name) {
  const fn = ACTIONS[name];
  if (!fn) return 0;
  const dur = fn(id);
  if (!dur) return 0; // 動作沒目標元素（例：2D 角色沒頭）→ 不鎖 busy
  // busy 用時間戳：短動作的解鎖不會提早解掉後來長動作的鎖
  _busy[id] = Math.max(_busy[id] || 0, Date.now() + dur);
  return dur;
}
/* 互動反應：kind = tap / feed / greet / celebrate（隨機挑一種動作） */
const IMG_UNSUPPORTED = ['eat', 'bow', 'nod', 'look', 'tilt', 'ears']; // 需要頭/耳群組的動作
function charReact(id, kind) {
  const pool = REACT_POOL[kind] || REACT_POOL.tap;
  const ch = charById(id);
  let name = pool[Math.floor(Math.random() * pool.length)];
  if (ch && ch.species === 'image' && IMG_UNSUPPORTED.includes(name)) name = 'squash';
  return charAct(id, name);
}
/* 待機隨機動作 + 眨眼。gate() 回 false 時暫停（AR 頁角色不在鏡頭裡就不動，省電） */
function charAnimStart(ch, gate) {
  const id = ch.id;
  charAnimStop(id);
  const g = gate || function () { return true; };
  (function idleLoop() {
    _idleT[id] = setTimeout(() => {
      if (!document.hidden && g() && Date.now() >= (_busy[id] || 0)) {
        const pool = IDLE_POOL[ch.species] || IDLE_POOL.image;
        charAct(id, pool[Math.floor(Math.random() * pool.length)]);
      }
      idleLoop();
    }, 3200 + Math.random() * 4200);
  })();
  if (ch.species !== 'image') {
    (function blinkLoop() {
      _blinkT[id] = setTimeout(() => {
        if (!document.hidden && g()) _swing(_part(id, 'eyes'), 'scale', [0, -0.9, 0], 80, 2, 'linear');
        blinkLoop();
      }, 2200 + Math.random() * 3200);
    })();
  }
}
function charAnimStop(id) {
  clearTimeout(_idleT[id]); clearTimeout(_blinkT[id]);
  _busy[id] = 0;
}

/* 相容舊呼叫：開心跳一下 = 互動反應（隨機動作） */
function charJump(chId) { charReact(chId, 'tap'); }

function pickLine(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }
function charById(id) { return CHARACTERS.find(c => c.id === id); }
/* 分身角色（同角色多掃描目標，baseId 指向本尊）：狀態/語音/劇情都歸本尊 */
function arpSid(chOrId) {
  const ch = typeof chOrId === 'string' ? charById(chOrId) : chOrId;
  return (ch && (ch.baseId || ch.id)) || chOrId;
}
function duoScriptFor(idA, idB) {
  const a = arpSid(idA), b = arpSid(idB);
  return DUO_SCRIPTS.find(s => s.pair.includes(a) && s.pair.includes(b) && a !== b);
}
