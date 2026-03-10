
-- Insert default IHA mappings safely
INSERT INTO bot_category_mappings (source_name, source_url, target_category_slug, is_active)
VALUES
    ('IHA', 'https://www.iha.com.tr/gundem', 'gundem', true),
    ('IHA', 'https://www.iha.com.tr/ekonomi', 'ekonomi', true),
    ('IHA', 'https://www.iha.com.tr/spor', 'spor', true),
    ('IHA', 'https://www.iha.com.tr/politika', 'siyaset', true),
    ('IHA', 'https://www.iha.com.tr/dunya', 'dunya', true),
    ('IHA', 'https://www.iha.com.tr/magazin', 'magazin', true),
    ('IHA', 'https://www.iha.com.tr/teknoloji', 'teknoloji', true),
    ('IHA', 'https://www.iha.com.tr/saglik', 'saglik', true)
ON CONFLICT (source_url) DO NOTHING;
