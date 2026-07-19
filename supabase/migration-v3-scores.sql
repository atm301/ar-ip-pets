-- 9-1 排行榜（匿名玩家，sid 為裝置識別；prototype：分數為前端自報，正式商轉需改 RPC 驗證）
BEGIN;

CREATE TABLE IF NOT EXISTS public.arp_scores (
  brand_slug text NOT NULL CHECK (char_length(brand_slug) <= 30),
  sid text NOT NULL CHECK (char_length(sid) BETWEEN 5 AND 40),
  nick text NOT NULL DEFAULT '' CHECK (char_length(nick) <= 20),
  exp int NOT NULL DEFAULT 0 CHECK (exp >= 0 AND exp <= 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_slug, sid)
);
CREATE INDEX IF NOT EXISTS arp_scores_rank_idx ON public.arp_scores (brand_slug, exp DESC);
ALTER TABLE public.arp_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arp_scores_select ON public.arp_scores;
CREATE POLICY arp_scores_select ON public.arp_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS arp_scores_insert ON public.arp_scores;
CREATE POLICY arp_scores_insert ON public.arp_scores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS arp_scores_update ON public.arp_scores;
CREATE POLICY arp_scores_update ON public.arp_scores FOR UPDATE USING (true) WITH CHECK (true);

-- updated_at 一律由 DB 蓋章（防造假時間）
CREATE OR REPLACE FUNCTION public.arp_scores_touch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS arp_scores_touch ON public.arp_scores;
CREATE TRIGGER arp_scores_touch BEFORE INSERT OR UPDATE ON public.arp_scores
  FOR EACH ROW EXECUTE FUNCTION public.arp_scores_touch();

COMMIT;

-- v4（2026-07-20）：排行榜加完美餵食數
ALTER TABLE arp_scores ADD COLUMN IF NOT EXISTS perfect int NOT NULL DEFAULT 0;
