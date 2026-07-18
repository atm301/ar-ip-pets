/* ============================================================
 * AR IP Pets — 角色設定 + 共用邏輯
 * 每個「客戶產品」對應一個 IP 角色：
 *   targetIndex = 該產品圖在 targets/*.mind 裡的編號（編譯順序）
 * 新增角色：在 CHARACTERS 加一筆 + 重新編譯 .mind 即可
 * ============================================================ */

const CHARACTERS = [
  {
    id: 'mochi',
    name: '麻糬兔',
    species: 'bunny',
    product: '示範卡片（MindAR 官方示範圖，可先用電腦螢幕顯示 assets/demo-card.png 來掃）',
    targetIndex: 0,
    colors: { body: '#FFC0CB', belly: '#FFF3F6', accent: '#FF7FA5' },
    intro: '愛撒嬌的小兔子，最喜歡被摸頭。',
    greet: ['你找到我了！我是麻糬兔～', '哇！是你！今天也來看我嗎？'],
    taps: [
      '嘿嘿，好癢喔～再摸一下嘛！',
      '你知道嗎？我最喜歡下午曬太陽了。',
      '欸欸，你今天過得好嗎？',
      '再收集其他夥伴，我們可以一起聊天喔！',
      '摸頭 +1！我們感情越來越好了～',
      '我肚子有點餓了…可以餵我吃點心嗎？',
      '你是我最好的朋友！',
      '噓…跟你說個秘密，熊布丁其實很怕黑。'
    ],
    feeds: ['是草莓大福！我最愛了！', '啊嗚～好好吃！', '謝謝你！精神都來了！']
  },
  {
    id: 'pudding',
    name: '熊布丁',
    species: 'bear',
    product: '產品 B（請把客戶產品照編譯進 targets，設 targetIndex: 1）',
    targetIndex: 1,
    colors: { body: '#C89F6E', belly: '#F5E6CE', accent: '#8B5E34' },
    intro: '慢吞吞的小熊，肚子永遠是餓的。',
    greet: ['呼嗯…你來啦…我是熊布丁。', '（揉眼睛）剛剛睡著了嗎…？'],
    taps: [
      '呼嗯…再讓我睡五分鐘…',
      '你身上有食物的味道嗎？',
      '慢慢來比較快，這是我的座右銘。',
      '麻糬兔今天有沒有乖乖的？',
      '被摸摸的感覺…不錯耶…',
      '收集我們全部，會發生好玩的事喔。',
      '你看起來今天有點累，要不要休息一下？'
    ],
    feeds: ['蜂蜜布丁！！（眼睛發亮）', '嗯嗯嗯～幸福的味道～', '再來一個也可以喔？']
  },
  {
    id: 'pipi',
    name: '啾啾',
    species: 'chick',
    product: '產品 C（請把客戶產品照編譯進 targets，設 targetIndex: 2）',
    targetIndex: 2,
    colors: { body: '#FFE066', belly: '#FFF8DC', accent: '#FFA94D' },
    intro: '精力旺盛的小雞，講話速度超快。',
    greet: ['啾！你來了你來了你來了！', '啾啾啾！今天要玩什麼？'],
    taps: [
      '啾！再快一點再快一點！',
      '我剛剛繞著房間飛了三圈！',
      '你知道麻糬兔藏了點心在哪嗎？',
      '啾～被摸摸也不錯啦…才、才沒有很開心呢！',
      '等大家到齊，我們來開派對！',
      '我跑得比熊布丁快一百倍！'
    ],
    feeds: ['小米！啾啾啾！', '好吃到飛起來！真的飛起來！', '還要還要！']
  }
];

/* 兩隻角色同框（或收集滿 2 隻）觸發的特殊劇情 */
const DUO_SCRIPTS = [
  { pair: ['mochi', 'pudding'], lines: [
    ['mochi', '熊布丁！你又在睡覺！'],
    ['pudding', '呼嗯…我在想事情…用睡覺的方式…'],
    ['mochi', '那你想到什麼了？'],
    ['pudding', '想到…等等要吃什麼。'],
    ['mochi', '（扶額）謝謝這位主人把我們收集在一起…吧？']
  ]},
  { pair: ['mochi', 'pipi'], lines: [
    ['pipi', '啾！麻糬兔我們來比賽跑步！'],
    ['mochi', '不要，我跑輸會生氣。'],
    ['pipi', '那比睡覺！'],
    ['mochi', '那你比不過熊布丁。'],
    ['pipi', '啾…好像是耶。']
  ]},
  { pair: ['pudding', 'pipi'], lines: [
    ['pipi', '熊布丁起床！太陽曬屁股了！'],
    ['pudding', '呼嗯…太陽又不會痛…'],
    ['pipi', '主人在看我們耶！'],
    ['pudding', '（瞬間坐好）你好，我一直都很有精神。']
  ]}
];

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

/* ---------- 事件追蹤（GA4 + Pixel，安全包裝） ---------- */
function arpTrack(name, params) {
  try { if (window.gtag) gtag('event', name, params || {}); } catch (e) {}
  try { if (window.fbq) fbq('trackCustom', name, params || {}); } catch (e) {}
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
    // 鼻子
    el('a-sphere', { position: '0 0.51 0.155', radius: '0.028', color: ch.colors.accent }, bob);
  } else if (ch.species === 'chick') {
    // 嘴喙
    el('a-cone', { position: '0 0.51 0.17', 'radius-bottom': '0.03', 'radius-top': '0.001', height: '0.05', rotation: '90 0 0', color: ch.colors.accent }, bob);
    // 頭頂呆毛
    el('a-sphere', { position: '0 0.7 0', radius: '0.025', 'scale': '0.6 1.6 0.6', color: ch.colors.accent, rotation: '0 0 15' }, bob);
    // 小翅膀
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
  p.y = parseFloat(from.split(' ')[1]); p.x = parseFloat(from.split(' ')[0]);
  const to = p.x + ' ' + (p.y + 0.25) + ' ' + p.z;
  rootEl.removeAttribute('animation__jump');
  rootEl.setAttribute('animation__jump',
    'property: position; from: ' + from + '; to: ' + to + '; dir: alternate; dur: 220; loop: 2; easing: easeOutQuad');
  setTimeout(() => { rootEl.removeAttribute('animation__jump'); rootEl.setAttribute('position', from); }, 1000);
}

function pickLine(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function charById(id) { return CHARACTERS.find(c => c.id === id); }
function duoScriptFor(idA, idB) {
  return DUO_SCRIPTS.find(s => s.pair.includes(idA) && s.pair.includes(idB) && idA !== idB);
}
