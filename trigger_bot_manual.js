
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function trigger() {
    console.log('Inserting FORCE_RUN command...');
    const { data, error } = await supabase
        .from('bot_commands')
        .insert({ command: 'FORCE_RUN', status: 'PENDING' })
        .select();

    if (error) {
        console.error('Trigger failed:', error);
    } else {
        console.log('Trigger success:', data);
    }
}

trigger();
