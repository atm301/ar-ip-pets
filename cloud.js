/* ============================================================
 * 雲端層（Supabase 多租戶）— 前台用純 fetch，不載 SDK
 * anon key 為公開金鑰（安全性靠 RLS），與其他靜態站做法一致
 * ============================================================ */
const ARP_SUPA_URL = 'https://dpglkagtzdwiovzbtase.supabase.co';
const ARP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZ2xrYWd0emR3aW92emJ0YXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODY1OTMsImV4cCI6MjA4NzM2MjU5M30.UQZY1o2XQEBx5imMGyBy3V3klSdQmiw150x3PKQgxnc';

/* 目前品牌代號（?b=slug；沒有 = 示範品牌） */
function arpBrandSlug() {
  return (new URLSearchParams(location.search).get('b') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}
/* 站內連結帶上品牌參數 */
function arpLink(page) {
  const b = arpBrandSlug();
  return b ? page + (page.includes('?') ? '&' : '?') + 'b=' + encodeURIComponent(b) : page;
}

/* 抓已發佈品牌設定（config JSONB + mind_url） */
async function arpFetchBrand(slug) {
  const r = await fetch(ARP_SUPA_URL + '/rest/v1/arp_brands?slug=eq.' + encodeURIComponent(slug) +
    '&published=eq.true&select=name,slug,config,mind_url', {
    headers: { apikey: ARP_ANON, Authorization: 'Bearer ' + ARP_ANON }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

/* 匿名事件上報（品牌主後台看數據用；失敗靜默） */
function arpCloudLog(event, characterId, meta) {
  try {
    fetch(ARP_SUPA_URL + '/rest/v1/arp_events', {
      method: 'POST',
      headers: { apikey: ARP_ANON, Authorization: 'Bearer ' + ARP_ANON,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ brand_slug: arpBrandSlug() || 'demo', event: event,
        character_id: characterId || null, meta: meta || {} })
    }).catch(function () {});
  } catch (e) {}
}
