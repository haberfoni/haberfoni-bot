import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Try with service role key if available, otherwise anon key
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function fixAAGundemURL() {
    console.log('=== Fixing AA Gündem URL (Upsert Approach) ===\n');

    // Delete old mapping and insert new one
    const { error: deleteError } = await supabase
        .from('bot_category_mappings')
        .delete()
        .eq('source_name', 'AA')
        .eq('target_category_slug', 'gundem');

    if (deleteError) {
        console.error('Error deleting old mapping:', deleteError);
    } else {
        console.log('✓ Deleted old mapping');
    }

    // Insert new mapping with correct URL
    const { data: inserted, error: insertError } = await supabase
        .from('bot_category_mappings')
        .insert({
            source_name: 'AA',
            source_url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
            target_category_slug: 'gundem',
            is_active: true
        })
        .select();

    if (insertError) {
        console.error('Error inserting new mapping:', insertError);
        return;
    }

    console.log('✓ Inserted new mapping:', JSON.stringify(inserted, null, 2));

    // Verify
    const { data: verify } = await supabase
        .from('bot_category_mappings')
        .select('*')
        .eq('source_name', 'AA');

    console.log('\n✅ Current AA mappings:', JSON.stringify(verify, null, 2));
}

fixAAGundemURL().catch(console.error);
