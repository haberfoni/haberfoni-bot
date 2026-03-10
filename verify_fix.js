
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Hardcode credentials if env fails to load to be absolutely sure for this debug step
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;

console.log('URL:', SUPABASE_URL ? 'Found' : 'Missing');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('news')
        .select('title, author, content')
        .eq('source', 'DHA')
        .ilike('title', '%resim sergisi%')
        .single();

    if (error) { console.error(error); return; }

    console.log('Title:', data.title);
    console.log('Author:', data.author);
    if (!data.author) console.log('✅ Author is null/empty as expected (if not found in text)');
    else console.log('ℹ️ Author found:', data.author);

    const hasImg = data.content.includes('<img');
    console.log('Has Images inside content:', hasImg ? '✅ YES' : '❌ NO');

    if (hasImg) {
        const matches = [...data.content.matchAll(/<img[^>]+src="([^">]+)"/g)];
        console.log('Image Sources:', matches.map(m => m[1]));
    }
}

run();
