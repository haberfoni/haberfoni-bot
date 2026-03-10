import { saveNews } from '../db.js';
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';

const parser = new Parser();

// Images that should never appear in articles
const BLOCKED_IMAGE_PATTERNS = [
    'bip.png', 'bip.jpg',
    'next-header-aa', 'aa-logo',
    'default.jpg', 'placeholder',
    'logo.png', 'logo.jpg', 'logo.svg',
    'noimage', 'no-image', 'no_image',
];

function isBlockedImage(url) {
    if (!url) return true;
    const lower = url.toLowerCase();
    return BLOCKED_IMAGE_PATTERNS.some(p => lower.includes(p));
}

/**
 * Scrapes an AA HTML category page (e.g., https://www.aa.com.tr/tr/gundem)
 */
async function scrapeAAHTML(url, targetCategory) {
    try {
        console.log(`  Scraping HTML page: ${url}`);

        // Fetch the category page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const articleLinks = new Set();

        // Extract article links from the page
        // AA uses links in format: /tr/gundem/article-title/article-id
        $('a[href*="/tr/"]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.match(/\/tr\/[^\/]+\/[^\/]+\/\d+$/)) {
                // Filter out media content types (photo galleries, videos, infographics)
                // AA media URLs contain: /pgc/ (photo), /vgc/ (video), /info/infographic/
                const isMediaContent = /\/(pgc|vgc|info\/infographic)\//.test(href) ||
                    /\/(fotoraf|video|infografik)-\d+$/.test(href);

                if (!isMediaContent) {
                    // Make absolute URL
                    const fullUrl = href.startsWith('http') ? href : `https://www.aa.com.tr${href}`;
                    articleLinks.add(fullUrl);
                }
            }
        });

        console.log(`  Found ${articleLinks.size} article links`);

        let count = 0;
        // Limit to first 10 articles to avoid overload
        const linksArray = Array.from(articleLinks).slice(0, 10);

        for (const articleUrl of linksArray) {
            try {
                const article = await scrapeAAArticle(articleUrl, targetCategory);
                if (article) {
                    const success = await saveNews(article);
                    if (success) count++;
                }
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error(`  Error scraping article ${articleUrl}:`, err.message);
            }
        }

        return count;
    } catch (error) {
        console.error(`  Error fetching HTML page ${url}:`, error.message);
        return 0;
    }
}

/**
 * Scrapes a single AA article page
 */
async function scrapeAAArticle(url, targetCategory) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        // Extract title
        const title = $('h1').first().text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            $('title').text().trim();

        if (!title) return null;

        // Extract description/summary
        const summaryRaw = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            '';
        const summary = summaryRaw.replace(/\s+/g, ' ').trim();

        // Extract image
        const imageUrlRaw = $('meta[property="og:image"]').attr('content') ||
            $('article img').first().attr('src') ||
            null;
        const imageUrl = isBlockedImage(imageUrlRaw) ? null : imageUrlRaw;


        // Extract content - try to find article body
        let contentEl = $('.detay-icerik');
        if (contentEl.length === 0) contentEl = $('article');

        // Strip only ads/share/tag junk — keep iframe and video!
        contentEl.find('script, style, .ad, .share, .tags, .related').remove();

        let content = '';
        if (contentEl.length > 0) {
            content = contentEl.find('p, h2, h3, h4, img, figure, iframe, video').map((i, el) => {
                const $el = $(el);
                const tag = el.tagName.toLowerCase();
                const text = $el.text().trim();

                // Remove Author/Date line if it matches regex (e.g. "Ali Veli | 06.02.2026")
                if (/^[A-Za-zÇĞİÖŞÜçğıöşü\s]{2,50}\s?\|\s?\d{2}\.\d{2}\.\d{4}/.test(text)) return '';

                if (tag === 'img' || tag === 'figure') {
                    const img = tag === 'img' ? $el : $el.find('img');
                    let src = img.attr('src') || img.attr('data-src');

                    if (src) {
                        // Always decode URL first (handles %2F etc.)
                        try {
                            src = decodeURIComponent(src);
                        } catch (e) {
                            // If decode fails, keep original
                        }

                        // Convert relative URLs to absolute
                        if (src.startsWith('/')) {
                            src = `https://www.aa.com.tr${src}`;
                        } else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
                            src = `https://www.aa.com.tr/${src}`;
                        }
                    }


                    // Strict validation: filter out empty, placeholder, or invalid images
                    if (src && src.length > 10 && !isBlockedImage(src) && !(src.startsWith('data:') && src.length < 100)) {
                        return `<figure class="my-6"><img src="${src}" class="w-full h-auto rounded-lg" /></figure>`;
                    }
                    return '';
                }

                // Handle iframes (YouTube, etc.)
                if (tag === 'iframe') {
                    const src = $el.attr('src') || '';
                    if (src && (src.includes('youtube') || src.includes('youtu.be') || src.includes('dailymotion') || src.includes('vimeo'))) {
                        return `<div class="my-6 aspect-video"><iframe src="${src}" class="w-full h-full rounded-lg" allowfullscreen></iframe></div>`;
                    }
                    return '';
                }

                // Handle native video
                if (tag === 'video') {
                    const src = $el.attr('src') || $el.find('source').attr('src') || '';
                    if (src && src.startsWith('http')) {
                        return `<div class="my-6"><video src="${src}" controls class="w-full rounded-lg"></video></div>`;
                    }
                    return '';
                }

                if (tag.startsWith('h')) return `<h3>${$el.html()}</h3>`;
                return `<p>${$el.html()}</p>`;
            }).get().join('');
        }

        // Filter out empty tags
        content = content.replace(/<p>\s*<\/p>/g, '');

        // Extract Author (Try specific class first, then regex)
        let author = $('meta[name="author"]').attr('content') || '';
        const authorDateRegex = /([A-Za-zÇĞİÖŞÜçğıöşü\s]{2,50})\s+\|\s+\d{2}\.\d{2}\.\d{4}/;

        if (!author) {
            // Check for "Name Surname | Date" pattern in the raw text (if not caught above)
            // We search in the full text of the article
            const fullText = $('body').text();
            const match = fullText.match(authorDateRegex);
            if (match && match[1]) {
                author = match[1].trim();
            }
        }

        return {
            title: title,
            summary: summary, // Full summary, no truncation
            content: content,
            original_url: url,
            image_url: imageUrl,
            source: 'AA',
            author: author, // Add extracted author
            category: targetCategory,
            keywords: ''
        };
    } catch (error) {
        throw new Error(`Failed to scrape article: ${error.message}`);
    }
}

/**
 * Main AA scraper - supports both RSS and HTML
 */
export async function scrapeAA() {
    console.log('--- Starting AA Scrape ---');
    try {
        const mappingsModule = await import('../db.js');
        const mappings = await mappingsModule.getBotMappings('AA');
        const { updateBotMappingStatus } = mappingsModule;

        if (!mappings || mappings.length === 0) {
            console.log('--- AA Scrape Skipped (No mappings) ---');
            return;
        }

        let totalSaved = 0;

        for (const mapping of mappings) {
            console.log(`Fetching AA: ${mapping.source_url} -> ${mapping.target_category}`);

            try {
                let count = 0;

                // Check if URL is RSS or HTML
                if (mapping.source_url.includes('/rss/')) {
                    // RSS scraping
                    const feed = await parser.parseURL(mapping.source_url);

                    for (const item of feed.items) {
                        let imageUrl = null;
                        if (item.enclosure && item.enclosure.url && item.enclosure.type.startsWith('image')) {
                            imageUrl = item.enclosure.url;
                        }

                        const newsItem = {
                            title: item.title,
                            summary: item.contentSnippet ? item.contentSnippet.replace(/\s+/g, ' ').trim().substring(0, 200) : '',
                            content: (item.content || item.contentSnippet || '').replace(/\s+/g, ' ').trim(),
                            original_url: item.link,
                            image_url: imageUrl,
                            source: 'AA',
                            category: mapping.target_category,
                            keywords: ''
                        };

                        const success = await saveNews(newsItem);
                        if (success) count++;
                    }
                } else {
                    // HTML scraping
                    count = await scrapeAAHTML(mapping.source_url, mapping.target_category);
                }

                console.log(`   Saved ${count} items for ${mapping.target_category}`);
                totalSaved += count;

                // Log Success
                await updateBotMappingStatus(mapping.source_url, 'Success', count);

            } catch (err) {
                console.error(`Error scraping AA mapping ${mapping.source_url}:`, err.message);
                // Log Failure
                await updateBotMappingStatus(mapping.source_url, 'Failed', 0);
            }
        }

        console.log(`--- AA Scrape Finished. Total Saved: ${totalSaved} ---`);
    } catch (error) {
        console.error('Error in AA Scraper:', error);
    }
}
