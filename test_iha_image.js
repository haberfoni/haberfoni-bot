import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

async function run() {
    // Test HTML
    try {
        const url = 'https://www.iha.com.tr/haber-yakakent-osbde-gundem-somon-senligi-123'; // Fake URL, just finding a real one
        const res = await axios.get('https://www.iha.com.tr/');
        const $ = cheerio.load(res.data);
        const link = $('a[href*="/haber-"]').first().attr('href');
        const full = link.startsWith('http') ? link : 'https://www.iha.com.tr' + link;
        console.log('Testing HTML page:', full);
        
        const detail = await axios.get(full);
        const $d = cheerio.load(detail.data);
        console.log('og:image:', $d('meta[property="og:image"]').attr('content'));
        console.log('img data-src:', $d('img[data-src]').first().attr('data-src'));
        console.log('img src inside active areas:', $d('.habericerik img, article img, .article-img img').map((i, el) => $d(el).attr('src')).get());
    } catch(e) { }

    // Test RSS
    try {
        const parser = new Parser();
        const feed = await parser.parseURL('https://www.iha.com.tr/rss');
        console.log('RSS Item 0:', JSON.stringify(feed.items[0], null, 2));
    } catch(e) { }
}
run();
