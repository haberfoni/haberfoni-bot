import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const res = await axios.get('https://www.aa.com.tr/tr/gundem', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(res.data);
    
    let pgcLink = null;
    let vgcLink = null;
    
    $('a[href*="/tr/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (href.includes('/pgc/') || href.includes('fotoraf-')) pgcLink = href;
        if (href.includes('/vgc/') || href.includes('video-')) vgcLink = href;
    });
    
    console.log('Photo Gallery Link:', pgcLink);
    console.log('Video Gallery Link:', vgcLink);
    
    if (pgcLink) {
        const fullPgc = pgcLink.startsWith('http') ? pgcLink : `https://www.aa.com.tr${pgcLink}`;
        const pRes = await axios.get(fullPgc, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const $p = cheerio.load(pRes.data);
        console.log('PGC Title:', $p('h1').text().trim());
        console.log('PGC Images in .detay-icerik:', $p('.detay-icerik img').length);
        console.log('PGC Images in article:', $p('article img').length);
        console.log('PGC Images in gallery:', $p('.gallery-container img, .fotoraf img, .fGal img, .fotogaleri img, figure img').length);
        console.log('PGC all img classes:', $p('img').map((i, el) => $p(el).attr('class') || 'none').get().slice(0, 10).join(', '));
    }
    
    if (vgcLink) {
        const fullVgc = vgcLink.startsWith('http') ? vgcLink : `https://www.aa.com.tr${vgcLink}`;
        const vRes = await axios.get(fullVgc, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        const $v = cheerio.load(vRes.data);
        console.log('VGC Title:', $v('h1').text().trim());
        console.log('VGC Videos:', $v('video').length, 'Iframes:', $v('iframe').length);
        console.log('VGC Iframe src:', $v('iframe').first().attr('src'));
    }
}
test().catch(console.error);
