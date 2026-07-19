// 5-2 品牌靜態介紹頁產生器：從雲端抓已發佈品牌 config → 寫 b/<slug>.html
// 用法：node scripts/gen-brand-pages.mjs（改完品牌設定後重跑 + git push）
import fs from 'fs';
import path from 'path';

const SUPA = 'https://dpglkagtzdwiovzbtase.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZ2xrYWd0emR3aW92emJ0YXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODY1OTMsImV4cCI6MjA4NzM2MjU5M30.UQZY1o2XQEBx5imMGyBy3V3klSdQmiw150x3PKQgxnc';
const SITE = 'https://ar-ip-pets.zeabur.app';
const OUT = path.join(import.meta.dirname, '..', 'b');

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const res = await fetch(SUPA + '/rest/v1/arp_brands?published=eq.true&select=slug,name,config',
  { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
const brands = await res.json();
fs.mkdirSync(OUT, { recursive: true });

for (const b of brands) {
  const cfg = b.config || {};
  const chars = (cfg.characters || []).filter(c => !c.hideInBook);
  const story = (cfg.brand && cfg.brand.story) || '';
  const firstImg = (chars[0] && chars[0].imageSrc) || SITE + '/assets/og.png';
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(b.name)} × AR IP 夥伴 — 掃產品喚醒角色</title>
<meta name="description" content="${esc(b.name)}的 AR 角色：${esc(chars.map(c => c.name).join('、'))}。用手機掃描產品包裝，角色就會跳出來說話互動。${esc(story.slice(0, 60))}">
<link rel="canonical" href="${SITE}/b/${b.slug}.html">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(b.name)} × AR IP 夥伴">
<meta property="og:description" content="掃描${esc(b.name)}的產品，喚醒 ${chars.length} 隻專屬角色！">
<meta property="og:image" content="${esc(firstImg)}">
<meta property="og:url" content="${SITE}/b/${b.slug}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌟</text></svg>">
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: b.name, description: story.slice(0, 200), url: SITE + '/b/' + b.slug + '.html' })}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RDJD1YVHR7"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','G-RDJD1YVHR7');
</script>
<style>
:root { --p:#FF7FA5; --d:#4A3B47; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Microsoft JhengHei','PingFang TC',sans-serif; background:#FFF7FA; color:var(--d); line-height:1.8; }
main { max-width:720px; margin:0 auto; padding:32px 20px 60px; text-align:center; }
h1 { font-size:24px; margin:10px 0 4px; }
p.story { font-size:14px; color:#5c4a55; text-align:left; background:#fff; border-radius:14px; padding:14px 18px; margin:16px 0; }
.chars { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin:18px 0; }
.ch { background:#fff; border-radius:16px; padding:16px 12px; }
.ch img { width:120px; height:120px; object-fit:contain; }
.ch b { display:block; font-size:16px; margin-top:6px; }
.ch p { font-size:12px; color:#987f8f; }
.cta { display:inline-block; background:var(--p); color:#fff; text-decoration:none; font-weight:700;
  border-radius:999px; padding:12px 28px; margin:10px 4px; }
.cta.g { background:#fff; color:var(--d); border:1px solid #f0dbe3; }
footer { text-align:center; font-size:13px; color:#987f8f; padding:20px; }
footer a { color:var(--p); }
</style>
</head>
<body>
<main>
  <h1>${esc(b.name)} × AR IP 夥伴</h1>
  <p style="font-size:14px;color:#987f8f;">用手機掃描產品包裝，角色就會跳出來跟你說話</p>
  ${story ? `<p class="story">${esc(story)}</p>` : ''}
  <div class="chars">
    ${chars.map(c => `<div class="ch">${c.imageSrc ? `<img src="${esc(c.imageSrc)}" alt="${esc(c.name)}" loading="lazy">` : '<div style="font-size:64px;">🌟</div>'}<b>${esc(c.name)}</b><p>${esc(c.intro || c.product || '')}</p></div>`).join('\n    ')}
  </div>
  <a class="cta" href="${SITE}/?b=${b.slug}">📷 開始掃描</a>
  <a class="cta g" href="${SITE}/targets.html?b=${b.slug}">🃏 看可掃描的產品圖</a>
</main>
<footer><a href="${SITE}/about.html">認識 AR IP 夥伴平台</a></footer>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, b.slug + '.html'), html);
  console.log('b/' + b.slug + '.html OK（' + chars.length + ' 隻角色）');
}
console.log('DONE');
