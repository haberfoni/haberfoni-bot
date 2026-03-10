-- 1. Haber Kaynağı Takibi için Sütunlar
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS original_url TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. Bot Ayarları Tablosu
CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_name TEXT UNIQUE NOT NULL, -- Örn: 'IHA', 'AA', 'RSS'
    auto_publish BOOLEAN DEFAULT false, -- Otomatik yayınlansın mı?
    is_active BOOLEAN DEFAULT true, -- Bot çalışsın mı?
    check_interval_minutes INTEGER DEFAULT 15,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Güvenlik)
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Okuma (Public - Bot okuyabilsin diye, ama aslında sadece authenticated rolü yeterli olabilir. Şimdilik public yapalım test için)
CREATE POLICY "Public Read Bot Settings" ON bot_settings FOR SELECT USING (true);

-- Yazma (Admin)
CREATE POLICY "Admin Write Bot Settings" ON bot_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Varsayılan Ayarlar
INSERT INTO bot_settings (source_name, auto_publish) VALUES 
('IHA', false),
('DHA', false),
('AA', false)
ON CONFLICT (source_name) DO NOTHING;
