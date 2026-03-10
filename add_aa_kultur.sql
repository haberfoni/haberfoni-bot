-- Add AA Kultur Sanat mapping
INSERT INTO bot_category_mappings (source_name, source_url, target_category_slug, is_active)
VALUES 
('AA', 'https://www.aa.com.tr/tr/kultur-sanat', 'kultur-sanat', true)
ON CONFLICT (source_name, source_url) DO NOTHING;

-- Ensure auto_publish is on for any new AA items (global setting covers it, but good to double check)
-- UPDATE bot_settings SET auto_publish = true WHERE source_name = 'AA';
