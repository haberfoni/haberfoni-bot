
import { scrapeIHA } from './src/scrapers/iha.js';
import { saveNews } from './src/db.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Re-implementing the core logic since scrapeIHAHTML isn't exported
async function scrapeCategory(url, targetCategory) {
    console.log(`Scraping ${targetCategory} from ${url}...`);
    try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        const articleLinks = new Set();

        const selector = '.widget_General_Category_Dashboard a, .widget_General_Category_TopFive a, .widget_General_Category_All a';

        $(selector).each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && (href.includes('/haber-') || href.match(/-[\d]+\/?$/))) {
                const fullUrl = href.startsWith('http') ? href : `https://www.iha.com.tr${href}`;
                articleLinks.add(fullUrl);
            }
        });

        console.log(`Found ${articleLinks.size} links for ${targetCategory}`);

        // We'll trust the existing saveNews logic to handle duplicates
        // We need to import scrapeIHAArticle too? It's not exported. 
        // Let's just use the main scrapeIHA function? No, it relies on DB.
        // I'll copy the article scraper logic briefly or just use a modified iha.js?
        // Let's just import the scraper file and use what we can. 
        // Actually, easiest way is to modify iha.js to export scrapeIHAHTML, reuse it, then revert? 
        // No, let's just create a standalone simplified scraper here.
    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
    return Array.from(articleLinks); // Placeholder, need actual scraping
}

// Better approach: Modify iha.js to accept manual mappings override
// I'll read iha.js, modify it to take an optional argument, and then call it.
// OR, since I already have iha.js open, I'll just append a "Manual Run" mode to it if run directly?
// No, I'll overwrite run_iha_scrape_now.js to mock the database response.

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Monkey patch the DB module?? No, that's messy (ES modules are read-only bindings).
// I will create a new file `bot/custom_iha_runner.js` that copies the logic of `scrapeIHA` but uses hardcoded mappings.

const mappings = [
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/gundem', target_category_slug: 'gundem', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/ekonomi', target_category_slug: 'ekonomi', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/spor', target_category_slug: 'spor', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/politika', target_category_slug: 'siyaset', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/dunya', target_category_slug: 'dunya', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/magazin', target_category_slug: 'magazin', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/teknoloji', target_category_slug: 'teknoloji', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/saglik', target_category_slug: 'saglik', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/kultur-sanat', target_category_slug: 'kultur-sanat', is_active: true }
];

// I need to import scrapeIHAHTML from iha.js. I will modify iha.js first to export it.
