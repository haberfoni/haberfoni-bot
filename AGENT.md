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

---

## 🛠️ Bot İyileştirmeleri Özeti (26.03.2026)

Sunucu restorasyonu sırasında botun stabilitesini ve verimliliğini artırmak için şu adımlar atıldı:

### 1. Zengin İçerik ve HTML Desteği
- **HTML Parsing:** Tüm scraper'lar (AA, İHA, DHA) haber içeriğini artık sadece metin olarak değil, HTML formatında (`.html()`) çekiyor. Bu sayede haber içindeki görseller, hizalamalar ve orijinal mizanpaj korunuyor.
- **DHA Scraper:** Ajansın güncellenen DOM yapısına göre CSS seçicileri revize edildi ve meta-tag fallback mekanizması güçlendirildi.

### 2. Performans ve Sunucu Dostu Çalışma (Economic Mode)
- **Haber Sınırı:** Her bot döngüsünde (15 dk) işlenen maksimum haber sayısı **10** ile sınırlandırıldı. Bu, sunucunun CPU ve RAM yükünü stabilize eder.
- **AI Gecikmesi (Throttling):** AI rewrite süreçleri arasına **5.5 saniye** sabit gecikme eklendi. Bu hem AI provider (Gemini/Groq) limitlerini aşmamayı hem de sunucunun nefes almasını sağlar.

### 3. Medya ve Network
- **Alt Kategorizasyon:** Bot tarafından indirilen medya dosyaları artık `/uploads` altında `news`, `gallery`, `video` gibi alt klasörlere otomatik olarak dağıtılıyor.
- **Konteyner Uyumu:** `haberfoni_network` üzerinden DB bağlantısı stabilize edildi ve bağlantı kopmalarına karşı otomatik retry eklendi.

---

## 🚀 Sosyal Medya Paylaşım & Meta-Proxy (26.03.2026)

Haberlerin sosyal medyada (Facebook, Telegram) profesyonel "Link Card" görünümüyle paylaşılması için Meta-Proxy altyapısı kuruldu.

### 1. Meta-Proxy (ShareController)
- **Problem:** Vite SPA yapısında sunucu taraflı meta tag (OpenGraph) desteği olmadığı için Facebook resimli kart oluşturamıyordu.
- **Çözüm:** Backend'de `api-haberfoni.kaprofis.com/servis/share/:id` endpoint'i üzerinden statik OG tagleri sunan bir köprü oluşturuldu.
- **Yönlendirme:** Facebook botları metayı okurken, gerçek kullanıcılar otomatik olarak `haberfoni.kaprofis.com/haber/...` sayfasına JS/Meta-Refresh ile yönlendiriliyor.

### 2. Sosyal Paylaşım Sistemi
- **Sequential Sharing:** Telegram ve Facebook paylaşımları artık haber kaydedildiği an anlık olarak tetikleniyor. Facebook'un aynı haberi görsel galerisine dönüştürmemesi için paylaşımlar arasına 60 saniye gecikme eklendi.
- **Link Post Modu:** Facebook paylaşımları `me/feed` üzerinden fotoğrafsız but "Link" gönderisi olarak yapılıyor, böylece Proxy URL üzerinden tam kart görünümü elde ediliyor.
- **Dinamik Konfigürasyon:** Paylaşım linkleri artık Paneldeki `social_share_proxy_url` ayarını temel alır, kodda sabit (hardcoded) değildir.

---

## 🛠️ Bot Koordinasyon Özeti (08.04.2026)

Frontend ve Backend koordinasyonu kapsamında botun ürettiği verilerin doğruluğu teyit edildi:

### 1. Medya Yolu Doğrulaması
- Botun `news` tablosuna kaydettiği `/uploads/news/` formatındaki yolların fiziksel dosyalama yapısıyla tam uyumlu olduğu doğrulandı.
- Manuel kontrollerde hem ana `uploads` hem de `uploads/news` klasöründeki dosyaların erişilebilir olduğu ve botun doğru klasörlemeye devam ettiği teyit edildi.

### 2. Sosyal Gönderi Zinciri İzolasyonu ve Onarımı (08.04.2026)
- **Telegram URL Onarımı:** Facebook gibi Telegram'ın API (sendPhoto) servisine de relative path (`/uploads/...`) yerine tam path (absolute URL) ulaştırılacak şekilde `social.js` algoritması değiştirildi.
- **Sequential Block Crash Koruması:** Eskiden bir haberde resim yoksa Telegram hata fırlatıp JavaScript akışını kırıyordu. Bu sebeple zincirleme olarak Facebook paylaşımları da iptal oluyordu.
- **Fail-safe Yöntemler:** Telegram ve Facebook için ayrı ayrı `try-catch` blokları (hata izolasyonu) eklendi. Ayrıca fotoğrafsız haberlerin Telegram'a sorunsuz şekilde gitmesi için `sendMessage` (yazılı mesaj) fallback mimarisi eklendi. Artık bir platformdaki arıza, diğer platformdaki paylaşımı sabote etmiyor.
