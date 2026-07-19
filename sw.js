/* AR IP 夥伴 Service Worker — 靜態資源 cache-first、設定檔 network-first
 * 部署有大改時 bump CACHE 版本 */
const CACHE = 'arp-v5';
const PRECACHE = [
  './', 'index.html', 'demo.html', 'map.html', 'scan.html', 'targets.html',
  'characters.js', 'arp-visual.js', 'characters.json', 'cloud.js', 'quests.js',
  'libs/aframe.min.js', 'libs/aframe-extras.min.js', 'libs/mindar-image-aframe.prod.js',
  'libs/leaflet.js', 'libs/leaflet.css', 'libs/jsQR.js',
  'targets/targets.mind',
  'codex/images/items/acc-hat.webp', 'codex/images/items/acc-glasses.webp',
  'codex/images/items/acc-scarf.webp', 'codex/images/items/acc-crown.webp',
  'codex/images/items/acc-bow.webp', 'codex/images/items/acc-backpack.webp',
  'assets/demo-1.png', 'assets/demo-2.png', 'assets/demo-3.png'
];
/* 重資源（不常變）cache-first；其餘（HTML/app JS/設定檔）network-first，斷網才用快取
 * 避免部署新版後使用者卡在舊快取 */
const CACHE_FIRST = /\/(libs|codex|assets)\//;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(PRECACHE.map(u => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // 不碰 Supabase/GA/圖磚
  if (CACHE_FIRST.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
