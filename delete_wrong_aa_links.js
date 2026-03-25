import { db } from './src/db.js';

async function run() {
    try {
        const urlsToDelete = [
            'https://www.aa.com.tr/tr/video-galerisi',
            'https://www.aa.com.tr/tr/fotoraf-galerisi'
        ];

        for (const url of urlsToDelete) {
            const [result] = await db.execute('DELETE FROM bot_category_mappings WHERE source_url = ?', [url]);
            console.log(`Deleted ${result.affectedRows} rows for ${url}`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
