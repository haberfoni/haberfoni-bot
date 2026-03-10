-- ==========================================
-- ÖN BELLEK TEMİZLEME (Schema Reload)
-- Bu kodu çalıştırarak veritabanı yapısını yenileyin.
-- ==========================================

NOTIFY pgrst, 'reload config';
