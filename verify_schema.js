
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    console.log('Checking DB Schema...');

    // Try to select the new columns
    const { data, error } = await supabase
        .from('bot_category_mappings')
        .select('id, last_scraped_at, last_status')
        .limit(1);

    if (error) {
        console.error('Schema verification FAILED:', error.message);
    } else {
        console.log('Schema verification SUCCESS. Columns exist.');
        if (data.length > 0) console.log('Sample row:', data[0]);
    }

    // Check bot_commands table
    const { data: cmdData, error: cmdError } = await supabase
        .from('bot_commands')
        .select('*')
        .limit(1);

    if (cmdError) {
        console.error('bot_commands table check FAILED:', cmdError.message);
    } else {
        console.log('bot_commands table exists.');
    }
}

checkSchema();
