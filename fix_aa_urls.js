import { db } from './src/db.js';

async function run() {
    try {
        console.log('Fetching AA mappings...');
        const [rows] = await db.execute('SELECT id, source_url FROM bot_category_mappings WHERE source_name = "AA"');
        
        for (const row of rows) {
            let newUrl = row.source_url;
            
            // Fix RSS links
            if (newUrl.includes('rss/default?cat=')) {
                const urlObj = new URL(newUrl);
                const cat = urlObj.searchParams.get('cat');
                if (cat === 'guncel') {
                    newUrl = 'https://www.aa.com.tr/tr/gundem';
                } else {
                    newUrl = `https://www.aa.com.tr/tr/${cat}`;
                }
            }
            
            // Fix gallery links
            if (newUrl.includes('/video-galerisi')) {
                newUrl = 'https://www.aa.com.tr/tr/video';
            }
            if (newUrl.includes('/fotoraf-galerisi')) {
                newUrl = 'https://www.aa.com.tr/tr/foto-galeri';
            }
            
            // Update if changed
            if (newUrl !== row.source_url) {
                console.log(`Updating ID ${row.id}: ${row.source_url}  =>  ${newUrl}`);
                await db.execute('UPDATE bot_category_mappings SET source_url = ? WHERE id = ?', [newUrl, row.id]);
            }
        }
        console.log('Update complete.');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
run();
