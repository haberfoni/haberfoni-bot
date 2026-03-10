-- ==========================================
-- HABERFONI MASTER SETUP SCRIPT
-- Bu scripti Supabase SQL Editor'de çalıştırın.
-- Tüm eksik tabloları ve ayarları tek seferde kurar.
-- ==========================================

-- 1. NEWS TABLOSU GÜNCELLEMESİ (Bot için)
ALTER TABLE public.news 
ADD COLUMN IF NOT EXISTS original_url TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. BOT AYARLARI TABLOSU (Temiz kurulum için önce siliyoruz)
DROP TABLE IF EXISTS public.bot_settings CASCADE;

CREATE TABLE public.bot_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_name TEXT UNIQUE NOT NULL, -- Örn: 'IHA', 'AA', 'DHA'
    auto_publish BOOLEAN DEFAULT false, -- Otomatik yayınlansın mı?
    is_active BOOLEAN DEFAULT true, -- Bot çalışsın mı?
    check_interval_minutes INTEGER DEFAULT 15,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bot Settings RLS (Güvenlik)
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Bot Settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Admin Write Bot Settings" ON public.bot_settings;

CREATE POLICY "Public Read Bot Settings" ON public.bot_settings FOR SELECT USING (true);
CREATE POLICY "Admin Write Bot Settings" ON public.bot_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Varsayılan Bot Kaynaklarını Ekle
INSERT INTO public.bot_settings (source_name, auto_publish) VALUES 
('IHA', false),
('DHA', false),
('AA', false)
ON CONFLICT (source_name) DO NOTHING;


-- 3. PROFİLLER VE ADMİN YETKİSİ (Giriş yapabilmeniz için)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Otomatik Admin Yapma Trigger'ı (Yeni üye olan herkesi admin yapar - kolay kurulum için)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Eğer zaten kullanıcı oluşturduysanız, kendinizi manuel admin yapın (kendi ID'nizi bulup yazmanız gerekir ama genel trigger yeterli olabilir)
-- ÖRNEK: UPDATE public.profiles SET role = 'admin' WHERE id = '...';

-- 4. BUCKETS (Resim yükleme için)
INSERT INTO storage.buckets (id, name, public) VALUES ('news-images', 'news-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage Politikaları
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'news-images' );
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'news-images' AND auth.role() = 'authenticated' );
