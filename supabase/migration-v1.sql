-- AR IP Pets 多租戶 schema v1（arp_ 前綴，共用 Supabase dpglkagtzdwiovzbtase）
BEGIN;

-- ============ 品牌（一列一品牌，config JSONB 裝 characters/accessories/duoScripts/spawns） ============
CREATE TABLE IF NOT EXISTS public.arp_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,30}$'),
  name text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  mind_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.arp_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arp_brands_select ON public.arp_brands;
CREATE POLICY arp_brands_select ON public.arp_brands FOR SELECT
  USING (published = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS arp_brands_insert ON public.arp_brands;
CREATE POLICY arp_brands_insert ON public.arp_brands FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS arp_brands_update ON public.arp_brands;
CREATE POLICY arp_brands_update ON public.arp_brands FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS arp_brands_delete ON public.arp_brands;
CREATE POLICY arp_brands_delete ON public.arp_brands FOR DELETE
  USING (owner_id = auth.uid());

-- 鐵律：UPDATE policy 配 BEFORE UPDATE trigger 擋敏感欄位（owner_id 不可自改）
CREATE OR REPLACE FUNCTION public.arp_brands_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id is read-only';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS arp_brands_guard ON public.arp_brands;
CREATE TRIGGER arp_brands_guard BEFORE UPDATE ON public.arp_brands
  FOR EACH ROW EXECUTE FUNCTION public.arp_brands_guard();

-- ============ 事件（前台匿名玩家的掃描/互動 log，品牌主只能看自己的） ============
CREATE TABLE IF NOT EXISTS public.arp_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_slug text NOT NULL DEFAULT 'demo' CHECK (char_length(brand_slug) <= 30),
  event text NOT NULL CHECK (char_length(event) <= 40),
  character_id text CHECK (character_id IS NULL OR char_length(character_id) <= 40),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arp_events_brand_idx ON public.arp_events (brand_slug, created_at DESC);
ALTER TABLE public.arp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arp_events_insert ON public.arp_events;
CREATE POLICY arp_events_insert ON public.arp_events FOR INSERT
  WITH CHECK (char_length(coalesce(meta::text, '')) <= 2000);

DROP POLICY IF EXISTS arp_events_select ON public.arp_events;
CREATE POLICY arp_events_select ON public.arp_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.arp_brands b
                 WHERE b.slug = arp_events.brand_slug AND b.owner_id = auth.uid()));

-- ============ Storage：arp-assets（.mind 檔 + 2D 角色圖，公開讀、品牌主寫自己資料夾） ============
INSERT INTO storage.buckets (id, name, public)
  VALUES ('arp-assets', 'arp-assets', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS arp_assets_public_read ON storage.objects;
CREATE POLICY arp_assets_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'arp-assets');

DROP POLICY IF EXISTS arp_assets_owner_insert ON storage.objects;
CREATE POLICY arp_assets_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arp-assets'
    AND (storage.foldername(name))[1] IN
      (SELECT id::text FROM public.arp_brands WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS arp_assets_owner_update ON storage.objects;
CREATE POLICY arp_assets_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'arp-assets'
    AND (storage.foldername(name))[1] IN
      (SELECT id::text FROM public.arp_brands WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS arp_assets_owner_delete ON storage.objects;
CREATE POLICY arp_assets_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'arp-assets'
    AND (storage.foldername(name))[1] IN
      (SELECT id::text FROM public.arp_brands WHERE owner_id = auth.uid()));

COMMIT;
