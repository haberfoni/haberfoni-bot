import axios from 'axios';
import { getSettingByKey, db as pool } from './db.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function syncSocialMedia() {
    try {
        const isActive = await getSettingByKey('is_social_auto_post_active');
        if (isActive !== 'true') return;
        const [news] = await pool.execute(`
            SELECT id, title, summary, image_url, slug, social_posts 
            FROM news 
            WHERE is_active = 1 
              AND published_at IS NOT NULL 
              AND (
                social_posts IS NULL 
                OR social_posts = "" 
                OR social_posts = "{}" 
                OR NOT (JSON_EXTRACT(social_posts, "$.telegram") = "shared" AND JSON_EXTRACT(social_posts, "$.meta") = "shared")
              )
            ORDER BY published_at DESC 
            LIMIT 5
        `);
        for (const item of news) { await shareNewsItem(item); await delay(60000); }
    } catch (error) { console.error('[SOCIAL] Sync Error:', error.message); }
}

export async function shareSingleNewsById(newsId) {
    try {
        const [rows] = await pool.execute('SELECT id, title, summary, image_url, slug, social_posts FROM news WHERE id = ?', [newsId]);
        if (rows.length === 0) return;
        if (await getSettingByKey('is_social_auto_post_active') !== 'true') return;
        await shareNewsItem(rows[0]);
    } catch (e) { console.error('[SOCIAL] Single error:', e.message); }
}

async function shareNewsItem(item) {
    try {
        const telegramToken = await getSettingByKey('telegram_bot_token');
        const telegramChatId = await getSettingByKey('telegram_channel_id');
        const metaToken = await getSettingByKey('meta_access_token');
        const metaPageId = await getSettingByKey('meta_page_id');
        if (!telegramToken && !metaToken) return;

        let socialPosts = {};
        try {
            if (typeof item.social_posts === 'string') {
                socialPosts = (item.social_posts === '[object Object]' || !item.social_posts) ? {} : JSON.parse(item.social_posts);
            } else { socialPosts = item.social_posts || {}; }
        } catch (e) { socialPosts = {}; }

        // DINAMIK PROXY ADRESİ (Panelden değiştirilebilir)
        const proxyBase = await getSettingByKey('social_share_proxy_url') || 'https://api-haberfoni.kaprofis.com/servis/share/';
        const shareProxyUrl = `${proxyBase}${item.id}`;
        const realNewsUrl = `https://haberfoni.kaprofis.com/haber/${item.slug}`;

        let updated = false;

        let absoluteImgUrl = item.image_url;
        if (absoluteImgUrl && !absoluteImgUrl.startsWith('http')) {
            absoluteImgUrl = absoluteImgUrl.startsWith('/') 
                ? `https://api-haberfoni.kaprofis.com${absoluteImgUrl}` 
                : `https://api-haberfoni.kaprofis.com/${absoluteImgUrl}`;
        }

        // HTML etiketlerini temizle (Telegram parse error önlemek için)
        const cleanTitle = item.title ? item.title.replace(/<[^>]*>/g, '').trim() : '';

        // Telegram
        if (telegramToken && telegramChatId && !socialPosts.telegram) {
            try {
                let res;
                if (absoluteImgUrl) {
                    res = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, { 
                        chat_id: telegramChatId, photo: absoluteImgUrl, 
                        caption: `<b>${cleanTitle}</b>\n\n👉 Devamı: ${realNewsUrl}`, parse_mode: 'HTML' 
                    });
                } else {
                    res = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { 
                        chat_id: telegramChatId, 
                        text: `<b>${cleanTitle}</b>\n\n👉 Devamı: ${realNewsUrl}`, parse_mode: 'HTML' 
                    });
                }
                if (res.data.ok) { socialPosts.telegram = 'shared'; updated = true; }
            } catch (tErr) {
                console.error(`[SOCIAL] Telegram Hatası:`, tErr.response?.data || tErr.message);
            }
        }

        // Facebook - Bağlantı Kartı Modu (Proxy ile)
        if (metaToken && metaPageId && !socialPosts.meta) {
            try {
                console.log(`[SOCIAL] Facebook'a Bağlantı Kartı gönderiliyor: ${item.title}`);
                const res = await axios.post(`https://graph.facebook.com/v19.0/me/feed`, null, { 
                    params: { link: shareProxyUrl, message: `📢 ${item.title}`, access_token: metaToken } 
                });
                if (res.data.id) { socialPosts.meta = 'shared'; updated = true; }
            } catch (fErr) {
                console.error(`[SOCIAL] Facebook Hatası:`, fErr.response?.data || fErr.message);
            }
        }

        if (updated) {
            await pool.execute('UPDATE news SET social_posts = ? WHERE id = ?', [JSON.stringify(socialPosts), item.id]);
            console.log(`[SOCIAL] BAŞARILI: ${item.title}`);
        }
    } catch (error) { console.error(`[SOCIAL] Hata:`, error.response?.data || error.message); }
}
