import { saveNews } from './src/db.js';
import './src/socialSubscriber.js';

async function test() {
    console.log('--- IMMEDIATE SHARING TEST START ---');
    const testNews = {
        title: 'Haberfoni Anında Paylaşım Testi',
        summary: 'Haber veritabanına girdiği an bu özet ile paylaşılmalıdır.',
        content: 'Test içeriği...',
        image_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000',
        slug: 'test-anlik-' + Date.now(),
        source: 'IHA',
        original_url: 'https://haberfoni.com/test-anlik-' + Date.now(),
        author: 'Admin'
    };

    console.log('[DEBUG] Saving news item...');
    await saveNews(testNews);
    
    console.log('[DEBUG] Waiting for subscriber (10s)...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('--- TEST END ---');
    process.exit(0);
}

test();
