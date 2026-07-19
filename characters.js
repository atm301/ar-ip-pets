/* ============================================================
 * AR IP Pets — 共用邏輯（角色資料在 characters.json，非工程師改那份就好）
 * 這裡只放：設定載入、3D 角色組裝、存檔、音效/震動/TTS、統計
 * ============================================================ */

let CHARACTERS = [];
let DUO_SCRIPTS = [];
let ACCESSORIES = [];
const ARP_CONFIG_V = 1; // 設定檔結構版本（8-1：日後改結構時前台做相容判斷）

/* 2-3 前端錯誤上報（每 session 最多 3 筆，品牌主後台看得到） */
(function () {
  let n = 0;
  window.addEventListener('error', function (e) {
    if (n >= 3 || typeof arpCloudLog !== 'function') return;
    n++;
    arpCloudLog('js_error', null, {
      msg: String(e.message || '').slice(0, 180),
      src: String(e.filename || '').split('/').pop().slice(0, 60) + ':' + (e.lineno || 0)
    });
  });
})();

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
  if (cfg._v && cfg._v > ARP_CONFIG_V) {
    // 設定檔比前台新：盡力載入並警示（部署順序保護）
    try { console.warn('[arp] config _v=' + cfg._v + ' 新於前台支援版本 ' + ARP_CONFIG_V); } catch (e) {}
  }
  CHARACTERS = cfg.characters || [];
  DUO_SCRIPTS = cfg.duoScripts || [];
  ACCESSORIES = cfg.accessories || [];
  if (typeof arpSetQuests === 'function' && cfg.quests) arpSetQuests(cfg.quests);
  if (typeof arpSetStaminaItems === 'function' && cfg.staminaItems) arpSetStaminaItems(cfg.staminaItems);
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
/* 用 WebAudio 播語音檔（iOS 靜音鍵下仍可出聲、與音效共用解鎖狀態）
 * onended：播完（或被停掉）時回呼，給「排隊講話」用 */
async function _playVoiceUrl(url, onended) {
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
  if (onended) src.onended = onended;
  src.start();
  _voiceSrc = src;
}
/* 依字數估講話時長（音檔缺失/被擋時當 fallback 節奏） */
function arpEstMs(text) { return Math.min(9000, 800 + (text || '').length * 190); }
/* 排隊版說話：回傳 Promise，音檔真正播完才 resolve（劇情逐句接力用） */
function arpSpeakSeq(ch, text) {
  return new Promise(resolve => {
    if (!arpSoundOn() || !text) { setTimeout(resolve, arpEstMs(text) * 0.6); return; }
    let settled = false;
    const done = () => { if (!settled) { settled = true; clearTimeout(guard); resolve(); } };
    const guard = setTimeout(done, arpEstMs(text) + 5000); // 安全網：無論如何不卡死
    const vid = ch && (ch.baseId || ch.id);
    const url = vid && VOICE_MAP && VOICE_MAP[vid] && VOICE_MAP[vid][text];
    if (url) {
      try { speechSynthesis.cancel(); } catch (e) {}
      _playVoiceUrl(url, done).catch(() => setTimeout(done, arpEstMs(text)));
      return;
    }
    if ('speechSynthesis' in window) _speakTTS(ch, text, done);
    else setTimeout(done, arpEstMs(text));
  });
}
function arpSpeakStop() {
  try { if (_voiceSrc) { _voiceSrc.stop(); _voiceSrc = null; } } catch (e) {}
  try { if (_voiceAudio) { _voiceAudio.pause(); _voiceAudio = null; } } catch (e) {}
  try { speechSynthesis.cancel(); } catch (e) {}
  _pendingSpeak = null;
}
function _speakTTS(ch, text, onend) {
  if (!('speechSynthesis' in window)) { if (onend) onend(); return; }
  try {
    speechSynthesis.cancel();
    const clean = text.replace(/（[^）]*）/g, '').replace(/[～!！?？…]+/g, '，');
    const u = new SpeechSynthesisUtterance(clean);
    if (_zhVoice) u.voice = _zhVoice;
    u.lang = 'zh-TW';
    u.pitch = (ch && ch.voice && ch.voice.pitch) || 1.2;
    u.rate = (ch && ch.voice && ch.voice.rate) || 1.05;
    u.volume = 0.9;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
  } catch (e) { if (onend) onend(); }
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
