
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const mappings = [
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/gundem', target_category_slug: 'gundem', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/ekonomi', target_category_slug: 'ekonomi', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/spor', target_category_slug: 'spor', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/politika', target_category_slug: 'siyaset', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/dunya', target_category_slug: 'dunya', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/magazin', target_category_slug: 'magazin', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/teknoloji', target_category_slug: 'teknoloji', is_active: true },
    { source_name: 'IHA', source_url: 'https://www.iha.com.tr/saglik', target_category_slug: 'saglik', is_active: true }
];

async function seedMappings() {
    console.log('Seeding IHA Mappings...');

    for (const m of mappings) {
        // Check if exists first (since no unique constraint for upsert)
        const { data: existing } = await supabase
            .from('bot_category_mappings')
            .select('id')
            .eq('source_url', m.source_url)
            .single();

        if (existing) {
            console.log(`Skipping (already exists): ${m.target_category_slug}`);
        } else {
            const { error } = await supabase
                .from('bot_category_mappings')
                .insert(m);

            if (error) console.error(`Failed to add ${m.target_category_slug}:`, error.message);
            else console.log(`Added: ${m.target_category_slug}`);
        }
    }
}

seedMappings();
