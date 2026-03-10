import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeDHA } from './src/scrapers/dha.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function resetAndTestDHA() {
    console.log('=== Resetting and Testing DHA Scraper ===\n');

    // 1. Delete today's DHA news
    console.log('1. Deleting today\'s DHA news...');
    const { error: deleteError } = await supabase
        .from('news')
        .delete()
        .eq('source', 'DHA')
        .gte('created_at', new Date().toISOString().split('T')[0]); // created >= today

    if (deleteError) {
        console.error('Error deleting DHA news:', deleteError);
        return;
    }
    console.log('   ✅ Deleted recent DHA news.');

    // 2. Run Scraper
    console.log('\n2. Running DHA Scraper...');
    await scrapeDHA();

    // 3. Verify Summaries
    console.log('\n3. Verifying Summaries...');
    const { data: news, error: fetchError } = await supabase
        .from('news')
        .select('title, summary, author, content')
        .eq('source', 'DHA')
        .order('created_at', { ascending: false })
        .limit(5);

    if (fetchError) {
        console.error('Error fetching news:', fetchError);
        return;
    }

    if (news && news.length > 0) {
        news.forEach((n, i) => {
            console.log(`\n[${i + 1}] Title: ${n.title}`);
            console.log(`    Author: ${n.author}`);
            console.log(`    Has Image: ${n.content && n.content.includes('<img') ? 'YES' : 'NO'}`);
            console.log(`    Summary: ${n.summary ? n.summary.substring(0, 100) + '...' : 'NULL'}`);
            if (n.title === n.summary) {
                console.log('    ❌ ERROR: Summary is still identical to Title');
            } else {
                console.log('    ✅ OK: Summary is different');
            }
        });
    } else {
        console.log('   ⚠️ No DHA news found after scrape.');
    }
}

resetAndTestDHA().catch(console.error);
