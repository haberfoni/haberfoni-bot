import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { scrapeAA } from './src/scrapers/aa.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function resetAA() {
    console.log('=== Resetting AA News ===\n');

    // Delete last 3 days of AA news
    console.log('1. Deleting last 3 days of AA news...');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { error: delError } = await supabase
        .from('news')
        .delete()
        .eq('source', 'AA')
        .gte('created_at', threeDaysAgo.toISOString());

    if (delError) console.error(delError);
    else console.log('   ✅ Deleted.');

    // Run Scraper
    console.log('\n2. Running AA Scraper...');
    await scrapeAA();

    // Verify
    console.log('\n3. Verifying image URLs...');
    const { data, error } = await supabase
        .from('news')
        .select('title, content')
        .eq('source', 'AA')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    data.forEach((n, i) => {
        const hasImg = n.content.includes('<img');
        console.log(`\n[${i + 1}] ${n.title.substring(0, 60)}`);
        console.log(`    Has images: ${hasImg}`);

        if (hasImg) {
            const match = n.content.match(/<img[^>]+src="([^"]+)"/);
            if (match) {
                const src = match[1];
                console.log(`    First img: ${src.substring(0, 100)}`);

                // Check if URL is absolute
                if (src.startsWith('https://')) {
                    console.log('    ✅ Absolute URL');
                } else {
                    console.log('    ❌ Relative URL (should be absolute!)');
                }

                // Check if it's a logo
                if (src.includes('next-header') || src.includes('aa-logo') || src.includes('/logo')) {
                    console.log('    ❌ Logo detected (should be filtered!)');
                } else {
                    console.log('    ✅ Not a logo');
                }
            }
        }
    });
}

resetAA();
