

import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveNews } from '../db.js';

const BLOCKED_IMAGE_PATTERNS = [
    'bip.png', 'bip.jpg',
    'next-header-aa', 'aa-logo',
    'dha-logo', 'default.jpg',
    'placeholder', 'logo.png', 'logo.jpg', 'logo.svg',
    'noimage', 'no-image', 'no_image',
];

function isBlockedImage(url) {
    if (!url) return true;
    const lower = url.toLowerCase();
    return BLOCKED_IMAGE_PATTERNS.some(p => lower.includes(p));
}

export async function scrapeDHA() {
    console.log('--- Starting DHA Scrape ---');
    try {
        const mappingsModule = await import('../db.js');
        const mappings = await mappingsModule.getBotMappings('DHA');
        const { updateBotMappingStatus } = mappingsModule;

        if (!mappings || mappings.length === 0) {
            console.log('--- DHA Scrape Skipped (No mappings) ---');
            return;
        }

        let totalSaved = 0;
        for (const mapping of mappings) {
            console.log(`Fetching DHA: ${mapping.source_url} -> ${mapping.target_category}`);
            try {
                // Determine if it is RSS or HTML based on URL content or extension if possible,
                // but for now, assume HTML since RSS failed. Or try both?
                // Given the error, let's switch to Cheerio for standard category pages.

                const response = await axios.get(mapping.source_url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                    timeout: 15000
                });

                const $ = cheerio.load(response.data);
                let count = 0;

                // DHA specific selectors (need to be generic enough or specific)
                // Assuming standard card layout
                const articles = [];

                // Try to find news cards
                // Common DHA selectors: .news-item, .card, etc. 
                // Based on DHA current site, links usually are in <a> tags with titles.
                // Let's grab all links that look like news.

                $('a').each((i, el) => {
                    const link = $(el).attr('href');
                    const title = $(el).attr('title') || $(el).text().trim();
                    const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

                    // Filter valid news links
                    if (link && title && title.length > 20 && !link.includes('video') && !link.includes('galeri')) {
                        // Fix relative URLs
                        const fullLink = link.startsWith('http') ? link : `https://www.dha.com.tr${link}`;

                        articles.push({
                            title: title,
                            original_url: fullLink,
                            image_url: img && !isBlockedImage(img) ? (img.startsWith('http') ? img : `https://www.dha.com.tr${img}`) : null,
                            summary: '',
                            content: '',
                            source: 'DHA',
                            category: mapping.target_category
                        });
                    }
                });

                // Unique articles by URL
                const uniqueArticles = [...new Map(articles.map(item => [item.original_url, item])).values()].slice(0, 10); // Limit to 10 latest

                for (const item of uniqueArticles) {
                    try {
                        // Fetch detail page
                        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
                        const detailResponse = await axios.get(item.original_url, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            timeout: 15000
                        });
                        const $detail = cheerio.load(detailResponse.data);

                        // Extract summary (Spot) first
                        let summary = $detail('h2').first().text().trim() ||
                            $detail('.spot').text().trim() ||
                            $detail('.news-detail-spot').text().trim() ||
                            $detail('.description').text().trim();

                        // Clean up DOM before extracting content
                        $detail('script').remove();
                        $detail('style').remove();
                        $detail('.share-buttons').remove();
                        $detail('.breadcrumb').remove();
                        $detail('.tags').remove();
                        $detail('.related-news').remove();
                        $detail('.news-list').remove();
                        $detail('.slider').remove();
                        $detail('.swiper').remove();
                        $detail('.similar-news').remove();
                        $detail('.other-news').remove();
                        $detail('.most-read').remove();
                        $detail('.side-news').remove();
                        $detail('.video-gallery').remove();
                        $detail('.photo-gallery').remove();
                        $detail('.ad-banner').remove();
                        $detail('.etiketler').remove();
                        $detail('.news-tags').remove();
                        $detail('.article-tags').remove();
                        $detail('.item-tags').remove();
                        $detail('.news-detail-tags').remove();
                        $detail('h1').remove(); // Remove title from content area

                        // Remove summary/spot from content area to avoid duplication
                        if (summary) {
                            $detail('h2').filter((i, el) => $detail(el).text().trim() === summary).remove();
                            $detail('.spot').remove();
                            $detail('.news-detail-spot').remove();
                        }

                        // Try to find the specific content container
                        let contentEl = $detail('.news-detail-text');
                        if (contentEl.length === 0) contentEl = $detail('.nd-article-content');
                        if (contentEl.length === 0) contentEl = $detail('.content-text');

                        // If specific container found, get text from paragraphs and HEADERS to preserve structure
                        let content = '';
                        if (contentEl.length > 0) {
                            // Select paragraphs, headers, lists, and IMAGES
                            let stopExtraction = false;

                            let rawContent = contentEl.find('p, h2, h3, h4, ul, ol, figure, img, iframe, video').map((i, el) => {
                                if (stopExtraction) return '';

                                const tag = el.tagName.toLowerCase();
                                const $el = $detail(el);

                                // Handle Images
                                if (tag === 'img' || tag === 'figure') {
                                    if (tag === 'img' && $el.closest('figure').length > 0) return '';

                                    let imgEl = tag === 'img' ? $el : $el.find('img');
                                    let src = imgEl.attr('data-src') || imgEl.attr('src');

                                    if (src && !src.includes('base64') && !isBlockedImage(src)) {
                                        if (!src.startsWith('http')) src = `https://www.dha.com.tr${src}`;
                                        let caption = tag === 'figure' ? $el.find('figcaption').text().trim() : imgEl.attr('alt');
                                        return `<figure class="my-6"><img src="${src}" alt="${caption || ''}" class="w-full h-auto rounded-lg shadow-md" /><figcaption class="text-sm text-gray-500 mt-2 text-center">${caption || ''}</figcaption></figure>`;
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

                                // Handle native video tags
                                if (tag === 'video') {
                                    const src = $el.attr('src') || $el.find('source').attr('src') || '';
                                    if (src) {
                                        if (!src.startsWith('http')) return '';
                                        return `<div class="my-6"><video src="${src}" controls class="w-full rounded-lg"></video></div>`;
                                    }
                                    return '';
                                }

                                const text = $detail(el).text().trim();
                                const upperText = text.toUpperCase();

                                // Stop if we hit a "Related News" section header that slipped through
                                if (['GÜNCEL HABERLER', 'İLGİLİ HABERLER', 'DİĞER HABERLER', 'EN ÇOK OKUNANLAR'].some(kw => upperText.includes(kw) && text.length < 50)) {
                                    stopExtraction = true;
                                    return '';
                                }

                                // Clean up specific UI words that might remain
                                if (['PAYLAŞ', 'X', 'ABONE OL', 'YAZDIR', 'KAYDET', 'KIŞ'].includes(upperText)) return '';

                                // Filter out very short lines that are likely garbage (less than 3 chars, and not common punctuation/numbers)
                                if (text.length < 3 && !/^[.,!?-]$/.test(text) && !/^\d+$/.test(text)) return '';

                                // Filter out paragraphs/lists that are just collections of links (TAGS)
                                const links = $detail(el).find('a');
                                if (links.length > 0) {
                                    const linkText = links.text().replace(/\s+/g, '').length;
                                    const totalTextLen = text.replace(/\s+/g, '').length;

                                    // If > 60% of the content is links, or if it's short and has links, it's likely tags/related news
                                    if (totalTextLen > 0 && (linkText / totalTextLen) > 0.6) return '';

                                    // Specific check for short lines with links (aggressive tag removal)
                                    if (totalTextLen < 50) return '';
                                }

                                if (!text) return ''; // Skip empty elements

                                if (tag === 'p') return `<p>${$detail(el).html().trim()}</p>`; // Keep inner formatting like bold/links
                                if (tag === 'h2' || tag === 'h3' || tag === 'h4') return `<h3>${text}</h3>`; // Normalize headers to h3
                                if (tag === 'ul') return `<ul>${$detail(el).html().trim()}</ul>`;
                                if (tag === 'ol') return `<ol>${$detail(el).html().trim()}</ol>`;
                                return `<p>${text}</p>`;
                            }).get();

                            // Post-processing: Remove last element if it looks like a tag/garbage
                            let contentArr = rawContent;

                            while (contentArr.length > 0) {
                                const lastItem = contentArr[contentArr.length - 1];
                                const cleanLast = lastItem.replace(/<[^>]*>/g, '').trim();
                                // Check for short garbage words or if it's just a link that was missed
                                if (cleanLast.length < 5 || ['kış', 'yaz', 'etiketler', 'paylaş', 'x'].includes(cleanLast.toLowerCase())) {
                                    contentArr.pop();
                                } else {
                                    break;
                                }
                            }

                            content = contentArr.join('');

                            if (!content) content = contentEl.html().trim(); // Fallback if find fails
                        } else {
                            // Fallback to broader selector but be careful
                            content = $detail('article p').map((i, el) => `<p>${$detail(el).text().trim()}</p>`).get().join('');
                        }

                        // Clean up content
                        // Remove extra whitespace and newlines
                        content = content.replace(/\s+/g, ' ').trim();

                        // Extract date if needed (optional)
                        // const date = $detail('time').attr('datetime');

                        // Summary already extracted above

                        // If no specific summary found, use first long paragraph of content
                        if (!summary && content.length > 50) {
                            summary = content.substring(0, 200) + '...';
                        }

                        // Fallback to title only if absolutely nothing else found
                        if (!summary) summary = item.title;


                        // Extract Author
                        let author = $detail('meta[name="author"]').attr('content') ||
                            $detail('.news-detail-editor-name').text().trim() ||
                            $detail('.news-source-info').text().trim();

                        // DHA specific text pattern check (Name SURNAME / City) if not found strings
                        if (!author) {
                            // Sometimes it's in the text: "Ahmet YILMAZ / İSTANBUL, (DHA)"
                            // Regex to find "Name SURNAME" before a slash or comma
                            const contentText = $detail('.news-detail-text').text(); // Get full text to search
                            const match = contentText.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)*\s+[A-ZÇĞİÖŞÜ]{2,})(?=\s*\/|\s*,)/);
                            if (match) author = match[1];
                        }

                        // Append Agency Name
                        summary = `${summary} - Demirören Haber Ajansı`;

                        const newsItem = {
                            ...item,
                            content: content,
                            summary: summary,
                            author: author, // Author or null/undefined (database will handle it)
                        };

                        const success = await saveNews(newsItem);
                        if (success) count++;
                    } catch (detailErr) {
                        console.error(`Status check: Failed to scrape detail for ${item.original_url}: ${detailErr.message}`);
                        // Fallback to saving just the title/link if detail fails? Better to skip if no content.
                        // But user wants content. Let's try to save what we have or skip? 
                        // If we save empty content, user complains.
                        continue;
                    }
                }

                console.log(`   Saved ${count} items for ${mapping.target_category}`);
                totalSaved += count;

                // Log Success
                await updateBotMappingStatus(mapping.source_url, 'Success', count);

            } catch (err) {
                console.error(`Error scraping DHA mapping ${mapping.source_url}:`, err.message);
                await updateBotMappingStatus(mapping.source_url, 'Failed', 0);
            }
        }

        console.log(`--- DHA Scrape Finished. Saved ${totalSaved} new items. ---`);
    } catch (error) {
        console.error('Error scraping DHA:', error);
    }
}
