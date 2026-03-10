import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from 'bot/.env' or '../.env'
// We'll try to load from root if bot is run from root or bot folder
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try local .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse DATABASE_URL if present, or use individual vars
// DATABASE_URL=mysql://user:pass@host:port/db
let dbConfig = {};
if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    dbConfig = {
        host: url.hostname,
        user: url.username,
        password: url.password,
        database: url.pathname.replace('/', ''),
        port: parseInt(url.port) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
} else {
    // Fallback if no DATABASE_URL
    dbConfig = {
        host: process.env.MYSQL_HOST || 'db',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'haberfoni',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

const pool = mysql.createPool(dbConfig);

export const db = pool; // Export generic pool if needed

/**
 * Checks if a news item already exists based on its Original URL.
 * @param {string} originalUrl 
 * @returns {Promise<Object|null>}
 */
export async function checkNewsExists(originalUrl) {
    if (!originalUrl) return null;

    try {
        const [rows] = await pool.execute(
            'SELECT id, content FROM news WHERE original_url = ? LIMIT 1',
            [originalUrl]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error checking duplicate:', error);
        return null;
    }
}

/**
 * Gets the settings for a specific bot source (e.g. 'IHA').
 * @param {string} sourceName 
 * @returns {Promise<Object>}
 */
export async function getBotSettings(sourceName) {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM bot_settings WHERE source_name = ? LIMIT 1',
            [sourceName]
        );
        if (rows.length === 0) {
            return { auto_publish: false, is_active: true };
        }
        return rows[0];
    } catch (e) {
        // console.warn('Bot settings fetch error (using defaults):', e.message);
        return { auto_publish: false, is_active: true };
    }
}

/**
 * Gets active mappings for a specific bot source (e.g. 'AA').
 * @param {string} sourceName 
 * @returns {Promise<Array>}
 */
export async function getBotMappings(sourceName) {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM bot_category_mappings WHERE source_name = ? AND is_active = 1',
            [sourceName]
        );
        return rows;
    } catch (e) {
        console.error('Exception fetching bot mappings:', e);
        return [];
    }
}

/**
 * Gets category ID by slug
 * @param {string} slug 
 * @returns {Promise<number|null>}
 */
export async function getCategoryIdBySlug(slug) {
    try {
        const [rows] = await pool.execute(
            'SELECT id FROM categories WHERE slug = ? LIMIT 1',
            [slug]
        );
        if (rows.length === 0) {
            console.warn(`Category not found for slug: ${slug}`);
            return null;
        }
        return rows[0].id;
    } catch (e) {
        console.error(`Error fetching category ID for ${slug}:`, e);
        return null;
    }
}

/**
 * Saves a news item to MySQL.
 * @param {Object} newsItem 
 * @returns {Promise<boolean>} success
 */
export async function saveNews(newsItem) {
    try {
        // 1. Check duplicate / existing
        const existing = await checkNewsExists(newsItem.original_url);

        if (existing) {
            const hasExistingContent = existing.content && existing.content.trim().length > 0;
            const hasNewContent = newsItem.content && newsItem.content.trim().length > 0;

            const hasPlaceholderImage = !existing.image_url || existing.image_url.includes('default.jpg') || existing.image_url.includes('placeholder');
            const hasNewRealImage = newsItem.image_url && !newsItem.image_url.includes('default.jpg') && !newsItem.image_url.includes('placeholder');

            // Update content if existing is short/empty and new is long
            const isExistingShort = !hasExistingContent || existing.content.trim().length < 400;
            const isNewLong = hasNewContent && newsItem.content.trim().length > 400;

            if (isExistingShort && isNewLong && hasNewRealImage) {
                console.log(`[UPDATE] Updating content + image for: ${newsItem.title}`);
                await pool.execute(
                    'UPDATE news SET content = ?, summary = ?, image_url = ?, updated_at = NOW() WHERE id = ?',
                    [newsItem.content, newsItem.summary, newsItem.image_url, existing.id]
                );
                console.log(`[UPDATE] Success.`);
                return true;
            } else if (isExistingShort && isNewLong) {
                console.log(`[UPDATE] Updating content for: ${newsItem.title}`);
                await pool.execute(
                    'UPDATE news SET content = ?, summary = ?, updated_at = NOW() WHERE id = ?',
                    [newsItem.content, newsItem.summary, existing.id]
                );
                console.log(`[UPDATE] Success.`);
                return true;
            } else if (hasPlaceholderImage && hasNewRealImage) {
                console.log(`[UPDATE] Updating placeholder image for: ${newsItem.title}`);
                await pool.execute(
                    'UPDATE news SET image_url = ?, updated_at = NOW() WHERE id = ?',
                    [newsItem.image_url, existing.id]
                );
                console.log(`[UPDATE] Image updated.`);
                return true;
            }

            console.log(`[SKIP] Exists (No update needed): ${newsItem.title}`);
            return false;
        }

        // 2. Get Settings
        const settings = await getBotSettings(newsItem.source || 'TEST');
        if (settings && !settings.is_active) {
            console.log(`[SKIP] Source ${newsItem.source} is inactive.`);
            return false;
        }

        const shouldPublish = settings ? settings.auto_publish : false;

        // 3. Prepare Payload
        const slug = newsItem.slug || slugify(newsItem.title);
        const categorySlug = newsItem.category || 'gundem';
        const categoryId = await getCategoryIdBySlug(categorySlug);

        // 4. Insert
        const query = `
            INSERT INTO news 
            (title, slug, summary, content, image_url, category, category_id, original_url, source, author, published_at, is_active, seo_title, seo_description, seo_keywords, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        `;

        const params = [
            newsItem.title,
            slug,
            newsItem.summary,
            newsItem.content,
            newsItem.image_url,
            categorySlug,
            categoryId,
            newsItem.original_url,
            newsItem.source,
            newsItem.author,
            shouldPublish ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
            true, // is_active
            newsItem.title, // seo_title
            newsItem.summary, // seo_description
            newsItem.keywords || '' // seo_keywords
        ];

        await pool.execute(query, params);

        console.log(`[SAVE] Saved (${shouldPublish ? 'Published' : 'Draft'}): ${newsItem.title}`);
        return true;

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log(`[SKIP] Duplicate (DB constraint): ${newsItem.title}`);
            return false;
        }
        console.error('Error saving news:', error);
        return false;
    }
}

// Simple slugify helper
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        + '-' + Math.floor(Math.random() * 1000);
}

export async function updateBotMappingStatus(sourceUrl, status, count) {
    try {
        await pool.execute(
            'UPDATE bot_category_mappings SET last_scraped_at = NOW(), last_status = ?, last_item_count = ?, updated_at = NOW() WHERE source_url = ?',
            [status, count, sourceUrl]
        );
        console.log(`Updated status for ${sourceUrl}: ${status}`);
    } catch (error) {
        console.error('EXCEPTION updating mapping status:', error);
    }
}
