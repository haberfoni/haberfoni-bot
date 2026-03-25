# haberfoni-bot

## Genel Bilgi

Türk haber ajanslarından (AA, İHA, DHA) içerik çeken **Node.js scraper botu**.  
**Docker container** içinde çalışır. Backend ile aynı MySQL veritabanını paylaşır.  
**ESM (ES Modules)** kullanır — `require()` değil, `import/export` kullanılmalıdır.

## Çalışma Mantığı

```
index.js başlar
  ├── runAll() → anlık çalışır (başlangıçta)
  ├── cron (her 15 dakika) → runAll()
  └── setInterval (her 10 sn) → checkCommands()
                                     └── bot_commands tablosunu okur
                                         FORCE_RUN komutu varsa → runAll()
```

`runAll()` sırasıyla çalıştırır: scrapeIHA → scrapeAA → scrapeDHA

## Proje Yapısı

```
index.js              # Giriş noktası (cron + command polling)
src/
├── db.js             # MySQL connection pool (shared)
└── scrapers/
    ├── aa.js         # Anadolu Ajansı scraper
    ├── iha.js        # İhlas Haber Ajansı scraper
    └── dha.js        # Demirören Haber Ajansı scraper
```

## Geliştirme Komutları

```bash
# Docker ile çalıştır (önerilen):
docker-compose up -d --build haberfoni_bot

# Logları izle:
docker-compose logs -f haberfoni_bot

# Local test (DB Docker'da çalışıyorken):
node index.js

# Tek scraper test:
node -e "import('./src/scrapers/aa.js').then(m => m.scrapeAA())"
```

## Env Değişkenleri (`.env`)

```env
MYSQL_HOST=db          # Docker network adı (local için: localhost)
MYSQL_PORT=3306
MYSQL_USER=haberfoni_user
MYSQL_PASSWORD=...
MYSQL_DATABASE=haberfoni
```

**Not:** Docker içinde `MYSQL_HOST=db` (servis adı), local çalışmada `MYSQL_HOST=localhost`.

## Bot Command Sistemi

Backend, `bot_commands` tablosuna `FORCE_RUN` komutu yazar.  
Bot her 10 saniyede bu tabloyu kontrol eder ve komutu işler.  
Admin panelindeki "Botu Çalıştır" butonu bu mekanizmayı kullanır.

```sql
-- Manuel test için:
INSERT INTO bot_commands (command, status) VALUES ('FORCE_RUN', 'PENDING');
```

## Scraper Yapısı

Her scraper:
1. Haber ajansının RSS/API'sinden başlıkları çeker
2. Her haber için detay sayfasına gider (Puppeteer veya axios/cheerio)
3. Başlık, özet, içerik, görsel, kategori bilgilerini ayrıştırır
4. MySQL `news` tablosuna `INSERT IGNORE` ile kaydeder (duplicate önleme)
5. Backend AI servisini tetikler (haber yeniden yazma)

## Docker

```yaml
# haberfoni-bot/docker-compose.yml
# Bot container'ı backend'in db servisine bağlanır
# External network ile backend'in MySQL'ini kullanır
```

---

## Son Geliştirmeler (25.03.2026)

### Scraper & Medya Yönetimi
- **Resim Senkronizasyonu:** İndirilen görseller artık Docker host üzerinden frontend ile paylaşımlı klasöre (`public/uploads`) kaydediliyor.
- **DHA Güncellemesi:** DHA'nın yeni yapısına uygun seçiciler ve meta-detay çekme mantığı eklendi.
- **Hata Toleransı:** Eksik indirilen görseller için dosya kontrol mekanizması kuruldu.
