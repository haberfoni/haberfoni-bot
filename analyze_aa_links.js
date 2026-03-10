import axios from 'axios';
import * as cheerio from 'cheerio';

async function analyzeAALinks() {
    console.log('=== Analyzing AA Link Formats ===\n');

    const testUrl = 'https://www.aa.com.tr/tr/gundem';

    try {
        const response = await axios.get(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const links = new Set();

        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            const title = $(elem).attr('title') || $(elem).text().trim().substring(0, 50);

            if (href) {
                // Look for various patterns
                if (href.includes('fotoraf') || href.includes('foto') || href.includes('pgc')) {
                    links.add(`[PHOTO] ${href} - ${title}`);
                } else if (href.includes('video') || href.includes('vgc')) {
                    links.add(`[VIDEO] ${href} - ${title}`);
                } else if (href.includes('infografik') || href.includes('infographic')) {
                    links.add(`[INFOGRAPHIC] ${href} - ${title}`);
                }
            }
        });

        console.log(`Found ${links.size} media-related links:\n`);
        Array.from(links).slice(0, 15).forEach(link => console.log(link));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeAALinks();
