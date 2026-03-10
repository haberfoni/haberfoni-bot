-- ACİL DÜZELTME (Sadece Çalışmayan Kısımlar İçin)
-- Bu kodu "Run" yapın.

-- 1. Headlines (Manşet) tablosu hatası için:
ALTER TABLE public.headlines ADD COLUMN IF NOT EXISTS type INTEGER DEFAULT 1;

-- 2. Ads (Reklam) tablosu hatası için:
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS placement_code TEXT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS is_manset_2 BOOLEAN DEFAULT false;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS manset_2_slot INTEGER;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS is_headline BOOLEAN DEFAULT false;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS headline_slot INTEGER;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. News tablosu hatası için:
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_slider BOOLEAN DEFAULT false;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_manset_2 BOOLEAN DEFAULT false;
